// Funções (catálogo da unidade, herdado pelas de baixo) e guarnições com versões por vigência.
import {
  EdicaoGuarnicao,
  Mes,
  mesParaData,
  mesPorExtenso,
  NovaFuncao,
  NovaGuarnicao,
  VersaoGuarnicao,
  type ComposicaoSalva,
  type FichaGuarnicao,
  type Funcao,
  type LinhaGuarnicao,
  type VersaoSalva,
} from 'contratos';
import { normalizar } from 'dominio';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { versaoNoMes } from './guarnicoes-regras.ts';

type Ctx = Context<AmbienteApi>;
const MSG_NOME = { '23505': 'Já existe uma guarnição com esse nome.' };
const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Funções da unidade e das de cima (RN-94), com a chave normalizada do nome. */
export async function funcoesVisiveis(c: Consulta, unidadeId: string): Promise<(Funcao & { chave: string })[]> {
  const { rows } = await c.query<Funcao>(
    `select f.id, f.nome, un.sigla as "unidadeSigla", f.unidade_id <> alvo.id as herdada
       from funcao f
       join unidade un on un.id = f.unidade_id
       join unidade alvo on alvo.id = $1
      where un.caminho @> alvo.caminho`,
    [unidadeId],
  );
  return rows.sort(porNome).map((f) => ({ ...f, chave: normalizar(f.nome) }));
}

/** Versões de cada guarnição, a mais recente primeiro, com a composição na ordem gravada. */
export async function versoesDasGuarnicoes(c: Consulta, ids: string[]): Promise<Map<string, VersaoSalva[]>> {
  const mapa = new Map<string, VersaoSalva[]>(ids.map((id) => [id, []]));
  if (!ids.length) return mapa;
  const vs = await c.query<{ id: string; guarnicao_id: string; vigencia: string; viatura: string | null; tipo_viatura: string | null; prioridade: number | null; ativa: boolean }>(
    `select id, guarnicao_id, to_char(vigencia_desde, 'YYYY-MM') as vigencia, viatura, tipo_viatura, prioridade, ativa
       from guarnicao_versao where guarnicao_id = any($1) order by vigencia_desde desc`,
    [ids],
  );
  const cs = vs.rows.length
    ? (
        await c.query<{ guarnicao_versao_id: string; funcao_id: string; funcao: string; minimo: number; maximo: number; cnh_exigida: string | null }>(
          `select co.guarnicao_versao_id, co.funcao_id, f.nome as funcao, co.minimo, co.maximo, co.cnh_exigida
             from composicao co join funcao f on f.id = co.funcao_id
            where co.guarnicao_versao_id = any($1) order by co.ordem`,
          [vs.rows.map((v) => v.id)],
        )
      ).rows
    : [];
  for (const v of vs.rows) {
    const composicao: ComposicaoSalva[] = cs
      .filter((x) => x.guarnicao_versao_id === v.id)
      .map((x) => ({ funcaoId: x.funcao_id, funcao: x.funcao, minimo: x.minimo, maximo: x.maximo, cnhExigida: x.cnh_exigida }));
    mapa.get(v.guarnicao_id)!.push({ vigencia: v.vigencia, viatura: v.viatura, tipoViatura: v.tipo_viatura, prioridade: v.prioridade, ativa: v.ativa, composicao });
  }
  return mapa;
}

/** Cria ou substitui a versão da vigência (aaaa-mm) e regrava a composição na ordem recebida. */
export async function gravarVersao(tx: Consulta, guarnicaoId: string, vigencia: string, v: VersaoGuarnicao): Promise<void> {
  const id = (
    await tx.query<{ id: string }>(
      `insert into guarnicao_versao (guarnicao_id, vigencia_desde, viatura, tipo_viatura, prioridade, ativa)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (guarnicao_id, vigencia_desde)
       do update set viatura = excluded.viatura, tipo_viatura = excluded.tipo_viatura, prioridade = excluded.prioridade, ativa = excluded.ativa
       returning id`,
      [guarnicaoId, mesParaData(vigencia), v.viatura, v.tipoViatura, v.prioridade, v.ativa],
    )
  ).rows[0]!.id;
  await tx.query('delete from composicao where guarnicao_versao_id = $1', [id]);
  for (const [i, l] of v.composicao.entries()) {
    await tx.query(
      'insert into composicao (guarnicao_versao_id, funcao_id, minimo, maximo, cnh_exigida, ordem) values ($1, $2, $3, $4, $5, $6)',
      [id, l.funcaoId, l.minimo, l.maximo, l.cnhExigida, i],
    );
  }
}

async function carregarFicha(c: Consulta, id: string): Promise<FichaGuarnicao | null> {
  const g = (
    await c.query<{ id: string; nome: string }>(
      'select id, nome from guarnicao where id = $1',
      [id],
    )
  ).rows[0];
  if (!g) return null;
  const versoes = (await versoesDasGuarnicoes(c, [id])).get(id)!;
  const { rows } = await c.query<{ escalaId: string; escala: string; turno_letra: string | null }>(
    `select e.id as "escalaId", e.nome as escala, eg.turno_letra
       from escala_guarnicao eg
       join escala_vinculo_versao v on v.id = eg.versao_id
       join escala e on e.id = v.escala_id
      where eg.guarnicao_id = $1
        and v.vigencia_desde = (select max(v2.vigencia_desde) from escala_vinculo_versao v2 where v2.escala_id = v.escala_id and v2.vigencia_desde <= $2)
      order by e.nome, eg.turno_letra`,
    [id, mesParaData(hojeRecife().slice(0, 7))],
  );
  const usadaEm: FichaGuarnicao['usadaEm'] = [];
  for (const r of rows) {
    let item = usadaEm.find((u) => u.escalaId === r.escalaId);
    if (!item) usadaEm.push((item = { escalaId: r.escalaId, escala: r.escala, turnos: [] }));
    item.turnos.push(r.turno_letra ?? 'todos');
  }
  return { id: g.id, nome: g.nome, versoes, usadaEm };
}

/** 400 por campo para as funções que a unidade não enxerga. */
async function funcoesForaDoCatalogo(c: Consulta, unidadeId: string, v: VersaoGuarnicao, prefixo = ''): Promise<Record<string, string>> {
  const ids = new Set((await funcoesVisiveis(c, unidadeId)).map((f) => f.id));
  const campos: Record<string, string> = {};
  v.composicao.forEach((l, i) => {
    if (!ids.has(l.funcaoId)) campos[`${prefixo}composicao.${i}.funcaoId`] = 'Esta função não está no catálogo da seção.';
  });
  return campos;
}


async function nomeJaUsado(c: Consulta, unidadeId: string, nome: string, exceto?: string): Promise<boolean> {
  const { rows } = await c.query<{ id: string; nome: string }>('select id, nome from guarnicao where unidade_id = $1', [unidadeId]);
  return rows.some((g) => g.id !== exceto && normalizar(g.nome) === normalizar(nome));
}

function mesPassado(c: Ctx, vigencia: string): Response | null {
  const atual = hojeRecife().slice(0, 7);
  return vigencia < atual ? c.json({ erro: `Só dá para mudar a partir de ${mesPorExtenso(atual)}.` }, 409) : null;
}

export function rotasGuarnicoes(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/funcoes', '/unidades/:u/guarnicoes', '/guarnicoes/*']) r.use(caminho, sessao);

  /** Papel de cadastro na unidade da guarnição; 404 se ela não existe. */
  async function daGuarnicao(c: Ctx, id: string): Promise<{ resposta: Response } | { unidadeId: string }> {
    const unidadeId = await unidadeDoRegistro(dep.banco, 'guarnicao', id);
    if (!unidadeId) return { resposta: c.json({ erro: 'Guarnição não encontrada.' }, 404) };
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    return negado ? { resposta: negado } : { unidadeId };
  }

  r.get('/unidades/:u/funcoes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    return c.json((await funcoesVisiveis(dep.banco, u)).map(({ chave: _chave, ...f }) => f));
  });

  r.post('/unidades/:u/funcoes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaFuncao);
    if (!corpo.ok) return corpo.resposta;
    const igual = (await funcoesVisiveis(dep.banco, u)).find((f) => f.chave === normalizar(corpo.dados.nome));
    if (igual) return c.json({ erro: `Já existe a função "${igual.nome}" (${igual.unidadeSigla}).` }, 409);
    try {
      const funcao = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (await tx.query<{ id: string }>('insert into funcao (unidade_id, nome) values ($1, $2) returning id', [u, corpo.dados.nome])).rows[0]!.id;
        const sigla = (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [u])).rows[0]!.sigla;
        const f: Funcao = { id, nome: corpo.dados.nome, unidadeSigla: sigla, herdada: false };
        return f;
      });
      return c.json(funcao, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.get('/unidades/:u/guarnicoes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const mes = c.req.query('mes') ?? hojeRecife().slice(0, 7);
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const { rows } = await dep.banco.query<{ id: string; nome: string }>(
      'select id, nome from guarnicao where unidade_id = $1',
      [u],
    );
    const versoes = await versoesDasGuarnicoes(dep.banco, rows.map((g) => g.id));
    const linhas: LinhaGuarnicao[] = rows.map((g) => {
      const todas = versoes.get(g.id)!;
      const vigente = versaoNoMes(todas, mes);
      const v = vigente ?? todas[todas.length - 1] ?? null;
      return {
        id: g.id,
        nome: g.nome,
        viatura: v?.viatura ?? null,
        prioridade: v?.prioridade ?? null,
        ativa: v?.ativa ?? true,
        minimo: v ? v.composicao.reduce((s, x) => s + x.minimo, 0) : 0,
        maximo: v ? v.composicao.reduce((s, x) => s + x.maximo, 0) : 0,
        aPartirDe: !vigente && v ? v.vigencia : null,
      };
    });
    linhas.sort((a, b) => (a.prioridade ?? Infinity) - (b.prioridade ?? Infinity) || porNome(a, b));
    return c.json(linhas);
  });

  r.post('/unidades/:u/guarnicoes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaGuarnicao);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const passado = mesPassado(c, d.vigencia);
    if (passado) return passado;
    const campos = await funcoesForaDoCatalogo(dep.banco, u, d.versao, 'versao.');
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    if (await nomeJaUsado(dep.banco, u, d.nome)) return c.json({ erro: MSG_NOME['23505'] }, 409);
    try {
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (
          await tx.query<{ id: string }>('insert into guarnicao (unidade_id, nome) values ($1, $2) returning id', [u, d.nome])
        ).rows[0]!.id;
        await gravarVersao(tx, id, d.vigencia, d.versao);
        return carregarFicha(tx, id);
      });
      return c.json(ficha, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_NOME);
    }
  });

  r.get('/guarnicoes/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daGuarnicao(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    return c.json(await carregarFicha(dep.banco, id));
  });

  r.patch('/guarnicoes/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daGuarnicao(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, EdicaoGuarnicao);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const atual = (await dep.banco.query<{ nome: string }>('select nome from guarnicao where id = $1', [id])).rows[0]!;
    if (d.nome && (await nomeJaUsado(dep.banco, acesso.unidadeId, d.nome, id))) return c.json({ erro: MSG_NOME['23505'] }, 409);
    try {
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('update guarnicao set nome = $2 where id = $1', [id, d.nome ?? atual.nome]);
        return carregarFicha(tx, id);
      });
      return c.json(ficha);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_NOME);
    }
  });

  r.put('/guarnicoes/:id/versoes/:mes', async (c) => {
    const id = c.req.param('id');
    const acesso = await daGuarnicao(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const corpo = await lerCorpo(c, VersaoGuarnicao);
    if (!corpo.ok) return corpo.resposta;
    const passado = mesPassado(c, mes);
    if (passado) return passado;
    const campos = await funcoesForaDoCatalogo(dep.banco, acesso.unidadeId, corpo.dados);
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      await gravarVersao(tx, id, mes, corpo.dados);
      return carregarFicha(tx, id);
    });
    return c.json(ficha);
  });

  return r;
}
