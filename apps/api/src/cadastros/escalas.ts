// Escalas: serviços reunidos na ordem de preenchimento, publicação e guarnições por turno, com versões
// por vigência (RN-93). Excluir escala é desativar.
import {
  EdicaoEscala,
  Mes,
  mesParaData,
  NovaEscala,
  ServicosDaEscala,
  MarcaDeBlocos,
  SituacaoEscala,
  textoFaixa,
  tituloPadraoEscala,
  VinculosDaEscala,
  type Escala,
  type LinhaEscala,
  type VinculoSalvo,
} from 'contratos';
import { normalizar } from 'dominio';
import { Hono, type Context } from 'hono';
import { CADASTRO, GESTAO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { mesPassado, versoesDasGuarnicoes } from './guarnicoes.ts';
import { faixasDosTurnos } from './escalas-regras.ts';
import { versaoNoMes } from './guarnicoes-regras.ts';

type Ctx = Context<AmbienteApi>;
const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Serviços da escala na ordem de preenchimento. */
async function servicosDaEscala(c: Consulta, escalaId: string) {
  return (
    await c.query<{ id: string; nome: string; cor: string; ativo: boolean }>(
      `select s.id, s.nome, s.cor, s.ativo from escala_servico es join servico s on s.id = es.servico_id
        where es.escala_id = $1 order by es.ordem`,
      [escalaId],
    )
  ).rows;
}

/** Faixas de horário dos turnos dos serviços (cada coluna da matriz) e se a letra acompanha a faixa. */
export async function faixasDaEscala(c: Consulta, servicoIds: string[]) {
  if (!servicoIds.length) return faixasDosTurnos([]);
  const { rows } = await c.query<{ servico: string; letra: 'A' | 'B' | 'C'; inicio: string; fim: string }>(
    `select s.nome as servico, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
       from turno t join servico s on s.id = t.servico_id
      where t.servico_id = any($1)`,
    [servicoIds],
  );
  return faixasDosTurnos(rows);
}

/** Versões de vínculos, a mais recente primeiro, com a situação da guarnição em cada vigência. */
export async function vinculosDaEscala(c: Consulta, escalaId: string): Promise<Escala['vinculos']> {
  const vs = (
    await c.query<{ id: string; vigencia: string }>(
      `select id, to_char(vigencia_desde, 'YYYY-MM') as vigencia from escala_vinculo_versao where escala_id = $1 order by vigencia_desde desc`,
      [escalaId],
    )
  ).rows;
  if (!vs.length) return [];
  const itens = (
    await c.query<{ versao_id: string; guarnicao_id: string; guarnicao: string; inicio: string; fim: string }>(
      `select eg.versao_id, eg.guarnicao_id, g.nome as guarnicao, to_char(eg.inicio, 'HH24:MI') as inicio, to_char(eg.fim, 'HH24:MI') as fim
         from escala_guarnicao eg join guarnicao g on g.id = eg.guarnicao_id
        where eg.versao_id = any($1) order by g.nome, eg.inicio, eg.fim`,
      [vs.map((v) => v.id)],
    )
  ).rows;
  const versoesG = await versoesDasGuarnicoes(c, [...new Set(itens.map((i) => i.guarnicao_id))]);
  return vs.map((v) => ({
    vigencia: v.vigencia,
    itens: itens
      .filter((i) => i.versao_id === v.id)
      .map(
        (i): VinculoSalvo => ({
          guarnicaoId: i.guarnicao_id,
          guarnicao: i.guarnicao,
          // guarnição que só começa depois não está desativada
          ativaNoMes: versaoNoMes(versoesG.get(i.guarnicao_id) ?? [], v.vigencia)?.ativa ?? true,
          inicio: i.inicio,
          fim: i.fim,
        }),
      ),
  }));
}

async function carregarEscala(c: Consulta, id: string): Promise<Escala> {
  const e = (
    await c.query<{ id: string; nome: string; titulo: string; militares_doc: Escala['militaresDoc']; dias_doc: Escala['diasDoc']; ativa: boolean; monta_blocos_voluntariado: boolean }>(
      'select id, nome, titulo, militares_doc, dias_doc, ativa, monta_blocos_voluntariado from escala where id = $1',
      [id],
    )
  ).rows[0]!;
  const servicos = await servicosDaEscala(c, id);
  return {
    id: e.id,
    nome: e.nome,
    titulo: e.titulo,
    militaresDoc: e.militares_doc,
    diasDoc: e.dias_doc,
    ativa: e.ativa,
    montaBlocosVoluntariado: e.monta_blocos_voluntariado,
    servicos,
    ...(await faixasDaEscala(c, servicos.map((s) => s.id))),
    vinculos: await vinculosDaEscala(c, id),
  };
}

/** A escala da unidade com o mesmo nome (sem caixa nem acento), fora a própria. */
async function escalaComNome(c: Consulta, unidadeId: string, nome: string, exceto?: string): Promise<string | null> {
  const { rows } = await c.query<{ id: string; nome: string }>('select id, nome from escala where unidade_id = $1', [unidadeId]);
  return rows.find((e) => e.id !== exceto && normalizar(e.nome) === normalizar(nome))?.nome ?? null;
}

/** Substitui os serviços da escala, regravando a ordem de 1 em diante. */
export async function gravarServicosDaEscala(tx: Consulta, escalaId: string, servicoIds: string[]): Promise<void> {
  await tx.query('delete from escala_servico where escala_id = $1', [escalaId]);
  for (const [i, s] of servicoIds.entries()) {
    await tx.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, $3)', [escalaId, s, i + 1]);
  }
}

/** Nome do primeiro serviço que sairia da escala e já tem militares escalados nela; null se nenhum. */
export async function servicoComAlocacaoQueSai(c: Consulta, escalaId: string, ficam: string[]): Promise<string | null> {
  const { rows } = await c.query<{ nome: string }>(
    `select s.nome from escala_servico es join servico s on s.id = es.servico_id
      where es.escala_id = $1 and not (es.servico_id = any($2))
        and exists (select 1 from alocacao a where a.escala_id = es.escala_id and a.servico_id = es.servico_id)
      order by es.ordem limit 1`,
    [escalaId, ficam],
  );
  return rows[0]?.nome ?? null;
}
export const mensagemServicoComAlocacao = (nome: string) => `O serviço ${nome} já tem militares escalados nesta escala.`;

/** Cria ou substitui a versão de vínculos da vigência (aaaa-mm). */
export async function gravarVinculos(tx: Consulta, escalaId: string, vigencia: string, itens: VinculosDaEscala['itens']): Promise<void> {
  const id = (
    await tx.query<{ id: string }>(
      `insert into escala_vinculo_versao (escala_id, vigencia_desde) values ($1, $2)
       on conflict (escala_id, vigencia_desde) do update set vigencia_desde = excluded.vigencia_desde returning id`,
      [escalaId, mesParaData(vigencia)],
    )
  ).rows[0]!.id;
  await tx.query('delete from escala_guarnicao where versao_id = $1', [id]);
  for (const it of itens) {
    await tx.query('insert into escala_guarnicao (versao_id, guarnicao_id, inicio, fim) values ($1, $2, $3, $4)', [id, it.guarnicaoId, it.inicio, it.fim]);
  }
}

export function rotasEscalas(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/escalas', '/escalas/*']) r.use(caminho, sessao);

  async function daEscala(c: Ctx, id: string): Promise<{ resposta: Response } | { unidadeId: string }> {
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return { resposta: c.json({ erro: 'Escala não encontrada.' }, 404) };
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    return negado ? { resposta: negado } : { unidadeId };
  }

  r.get('/unidades/:u/escalas', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const escalas = (
      await dep.banco.query<{ id: string; nome: string; ativa: boolean; montaBlocosVoluntariado: boolean }>(
        'select id, nome, ativa, monta_blocos_voluntariado as "montaBlocosVoluntariado" from escala where unidade_id = $1',
        [u],
      )
    ).rows;
    const servicos = (
      await dep.banco.query<{ escala_id: string; nome: string }>(
        `select es.escala_id, s.nome from escala_servico es join servico s on s.id = es.servico_id
          where es.escala_id = any($1) order by es.ordem`,
        [escalas.map((e) => e.id)],
      )
    ).rows;
    const linhas: LinhaEscala[] = escalas
      .map((e) => ({ ...e, servicos: servicos.filter((s) => s.escala_id === e.id).map((s) => s.nome) }))
      .sort(porNome);
    return c.json(linhas);
  });

  r.post('/unidades/:u/escalas', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaEscala);
    if (!corpo.ok) return corpo.resposta;
    const nome = corpo.dados.nome;
    const igual = await escalaComNome(dep.banco, u, nome);
    if (igual) return c.json({ erro: `Já existe a escala "${igual}".` }, 409);
    try {
      const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            `insert into escala (unidade_id, nome, titulo, militares_doc, dias_doc) values ($1, $2, $3, 'escalados', 'todos') returning id`,
            [u, nome, tituloPadraoEscala(nome)],
          )
        ).rows[0]!.id;
        return carregarEscala(tx, id);
      });
      return c.json(e, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.get('/escalas/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daEscala(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    return c.json(await carregarEscala(dep.banco, id));
  });

  r.patch('/escalas/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daEscala(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, EdicaoEscala);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const igual = await escalaComNome(dep.banco, acesso.unidadeId, d.nome, id);
    if (igual) return c.json({ erro: `Já existe a escala "${igual}".` }, 409);
    try {
      const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('update escala set nome = $2, titulo = $3, militares_doc = $4, dias_doc = $5 where id = $1', [id, d.nome, d.titulo, d.militaresDoc, d.diasDoc]);
        return carregarEscala(tx, id);
      });
      return c.json(e);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.post('/escalas/:id/situacao', async (c) => {
    const id = c.req.param('id');
    const acesso = await daEscala(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, SituacaoEscala);
    if (!corpo.ok) return corpo.resposta;
    const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      await tx.query('update escala set ativa = $2 where id = $1', [id, corpo.dados.ativa]);
      return carregarEscala(tx, id);
    });
    return c.json(e);
  });

  // só o gestor e o administrador decidem quais escalas montam os blocos do dia no voluntariado
  r.patch('/escalas/:id/blocos-do-voluntariado', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, GESTAO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, MarcaDeBlocos);
    if (!corpo.ok) return corpo.resposta;
    const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      await tx.query('update escala set monta_blocos_voluntariado = $2 where id = $1', [id, corpo.dados.montaBlocos]);
      return carregarEscala(tx, id);
    });
    return c.json(e);
  });

  r.put('/escalas/:id/servicos', async (c) => {
    const id = c.req.param('id');
    const acesso = await daEscala(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, ServicosDaEscala);
    if (!corpo.ok) return corpo.resposta;
    const ids = corpo.dados.servicoIds;
    const daUnidade = (await dep.banco.query<{ id: string }>('select id from servico where unidade_id = $1 and id = any($2)', [acesso.unidadeId, ids])).rows;
    if (daUnidade.length !== ids.length) {
      return c.json({ erro: 'Confira os campos destacados.', campos: { servicoIds: 'Use só serviços cadastrados nesta seção.' } }, 400);
    }
    const sai = await servicoComAlocacaoQueSai(dep.banco, id, ids);
    if (sai) return c.json({ erro: mensagemServicoComAlocacao(sai) }, 409);
    const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      await gravarServicosDaEscala(tx, id, ids);
      return carregarEscala(tx, id);
    });
    return c.json(e);
  });

  r.put('/escalas/:id/vinculos/:mes', async (c) => {
    const id = c.req.param('id');
    const acesso = await daEscala(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const corpo = await lerCorpo(c, VinculosDaEscala);
    if (!corpo.ok) return corpo.resposta;
    const passado = mesPassado(c, mes);
    if (passado) return passado;
    const itens = corpo.dados.itens;
    const { faixas } = await faixasDaEscala(dep.banco, (await servicosDaEscala(dep.banco, id)).map((s) => s.id));
    const existentes = new Set(faixas.map((f) => `${f.inicio}|${f.fim}`));
    const daUnidade = new Set(
      (await dep.banco.query<{ id: string }>('select id from guarnicao where unidade_id = $1 and id = any($2)', [acesso.unidadeId, itens.map((i) => i.guarnicaoId)])).rows.map((g) => g.id),
    );
    const campos: Record<string, string> = {};
    itens.forEach((it, i) => {
      if (!daUnidade.has(it.guarnicaoId)) campos[`itens.${i}.guarnicaoId`] = 'Use só guarnições cadastradas nesta seção.';
      else if (!existentes.has(`${it.inicio}|${it.fim}`)) campos[`itens.${i}.inicio`] = `A faixa ${textoFaixa(it.inicio, it.fim)} não existe nos serviços desta escala.`;
    });
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      await gravarVinculos(tx, id, mes, itens);
      return carregarEscala(tx, id);
    });
    return c.json(e);
  });

  return r;
}
