// Cotas das operações: por mês e por serviço (PJES ou diária), com origem interna ou externa e prioridade.
// A chave natural é (mês, unidade, serviço, origem): a tabela não a impõe, então a API confere.
import { CopiaDeCotas, EdicaoCota, mesParaData, mesPorExtenso, NovaCota, Mes, type Cota, type ResultadoDaCopia } from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { distribuidasPorCota } from './cotas-regras.ts';

type Ctx = Context<AmbienteApi>;
const MSG_SERVICO = 'Use um serviço cadastrado nesta seção.';

type LinhaCota = Omit<Cota, 'distribuidas'>;

/** Cotas do mês da unidade, por prioridade, com as alocações distribuídas repartidas entre elas. */
async function cotasDoMes(c: Consulta, unidadeId: string, mes: string): Promise<Cota[]> {
  const { rows } = await c.query<LinhaCota>(
    `select c.id, to_char(c.mes, 'YYYY-MM') as mes, c.servico_id as "servicoId", c.quantidade, c.origem, c.prioridade,
            c.conta_meta as "contaMeta", s.nome as servico, s.cor
       from cota c join servico s on s.id = c.servico_id
      where c.unidade_id = $1 and c.mes = $2::date
      order by c.prioridade, s.nome, c.origem`,
    [unidadeId, mesParaData(mes)],
  );
  if (!rows.length) return [];
  const contagem = await c.query<{ servicoId: string; n: number }>(
    `select a.servico_id as "servicoId", count(*)::int as n
       from alocacao a join escala e on e.id = a.escala_id
      where e.unidade_id = $1 and a.data >= $2::date and a.data < ($2::date + interval '1 month') and a.servico_id = any($3)
      group by a.servico_id`,
    [unidadeId, mesParaData(mes), [...new Set(rows.map((r) => r.servicoId))]],
  );
  const reparto = distribuidasPorCota(rows, new Map(contagem.rows.map((x) => [x.servicoId, x.n])));
  return rows.map((r) => ({ ...r, distribuidas: reparto.get(r.id) ?? 0 }));
}

async function cotaPorId(c: Consulta, unidadeId: string, id: string): Promise<Cota> {
  const mes = (await c.query<{ mes: string }>("select to_char(mes, 'YYYY-MM') as mes from cota where id = $1", [id])).rows[0]!.mes;
  return (await cotasDoMes(c, unidadeId, mes)).find((x) => x.id === id)!;
}

/** 400 por campo se o serviço não é desta unidade; null se está certo. */
async function servicoForaDaUnidade(c: Consulta, unidadeId: string, servicoId: string): Promise<Record<string, string> | null> {
  const { rows } = await c.query('select 1 from servico where id = $1 and unidade_id = $2', [servicoId, unidadeId]);
  return rows.length ? null : { servicoId: MSG_SERVICO };
}

/** A cota do mês com o mesmo serviço e origem (fora a `exceto`), se houver. */
async function cotaIgual(c: Consulta, unidadeId: string, mes: string, servicoId: string, origem: string, exceto?: string): Promise<{ servico: string } | null> {
  const { rows } = await c.query<{ id: string; servico: string }>(
    `select c.id, s.nome as servico from cota c join servico s on s.id = c.servico_id
      where c.unidade_id = $1 and c.mes = $2::date and c.servico_id = $3 and c.origem = $4`,
    [unidadeId, mesParaData(mes), servicoId, origem],
  );
  return rows.find((x) => x.id !== exceto) ?? null;
}

const MSG_COTA_REPETIDA = { '23505': 'Já existe uma cota deste serviço e origem neste mês.' };

export function rotasCotas(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/cotas', '/unidades/:u/cotas/*', '/cotas/*']) r.use(caminho, sessao);

  /** Papel de cadastro na unidade da cota; 404 se ela não existe. */
  async function daCota(c: Ctx, id: string): Promise<{ resposta: Response } | { unidadeId: string }> {
    const unidadeId = await unidadeDoRegistro(dep.banco, 'cota', id);
    if (!unidadeId) return { resposta: c.json({ erro: 'Cota não encontrada.' }, 404) };
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    return negado ? { resposta: negado } : { unidadeId };
  }

  r.get('/unidades/:u/cotas', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const mes = c.req.query('mes') ?? hojeRecife().slice(0, 7);
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    return c.json(await cotasDoMes(dep.banco, u, mes));
  });

  r.post('/unidades/:u/cotas', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaCota);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const fora = await servicoForaDaUnidade(dep.banco, u, d.servicoId);
    if (fora) return c.json({ erro: 'Confira os campos destacados.', campos: fora }, 400);
    const igual = await cotaIgual(dep.banco, u, d.mes, d.servicoId, d.origem);
    if (igual) return c.json({ erro: `Já existe uma cota de ${igual.servico} (${d.origem}) em ${mesPorExtenso(d.mes)}.` }, 409);
    try {
      const cota = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            'insert into cota (mes, unidade_id, servico_id, quantidade, origem, prioridade, conta_meta) values ($1::date, $2, $3, $4, $5, $6, $7) returning id',
            [mesParaData(d.mes), u, d.servicoId, d.quantidade, d.origem, d.prioridade, d.contaMeta],
          )
        ).rows[0]!.id;
        return cotaPorId(tx, u, id);
      });
      return c.json(cota, 201);
    } catch (e) {
      // o gatilho do banco recusa cota de serviço ordinário, com a frase pronta; o índice único, a cota que já existe
      return respostaDoErroDoBanco(c, e, MSG_COTA_REPETIDA);
    }
  });

  r.patch('/cotas/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daCota(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, EdicaoCota);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    if (d.servicoId) {
      const fora = await servicoForaDaUnidade(dep.banco, acesso.unidadeId, d.servicoId);
      if (fora) return c.json({ erro: 'Confira os campos destacados.', campos: fora }, 400);
    }
    if (d.servicoId || d.origem) {
      const atual = (
        await dep.banco.query<{ mes: string; servico_id: string; origem: string }>("select to_char(mes, 'YYYY-MM') as mes, servico_id, origem from cota where id = $1", [id])
      ).rows[0]!;
      const igual = await cotaIgual(dep.banco, acesso.unidadeId, atual.mes, d.servicoId ?? atual.servico_id, d.origem ?? atual.origem, id);
      if (igual) return c.json({ erro: `Já existe uma cota de ${igual.servico} (${d.origem ?? atual.origem}) em ${mesPorExtenso(atual.mes)}.` }, 409);
    }
    try {
      const cota = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query(
          `update cota set servico_id = coalesce($2::uuid, servico_id), quantidade = coalesce($3::int, quantidade), origem = coalesce($4::text, origem),
                           prioridade = coalesce($5::int, prioridade), conta_meta = coalesce($6::boolean, conta_meta)
            where id = $1`,
          [id, d.servicoId ?? null, d.quantidade ?? null, d.origem ?? null, d.prioridade ?? null, d.contaMeta ?? null],
        );
        return cotaPorId(tx, acesso.unidadeId, id);
      });
      return c.json(cota);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_COTA_REPETIDA);
    }
  });

  r.delete('/cotas/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daCota(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) => tx.query('delete from cota where id = $1', [id]));
    return c.body(null, 204);
  });

  r.post('/unidades/:u/cotas/copiar', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, CopiaDeCotas);
    if (!corpo.ok) return corpo.resposta;
    const { de, para } = corpo.dados;
    try {
      const copiados = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        // as do mês de origem, menos as que o destino já tem (mesmo serviço e origem)
        const feito = await tx.query(
          `insert into cota (mes, unidade_id, servico_id, quantidade, origem, prioridade, conta_meta)
           select $3::date, o.unidade_id, o.servico_id, o.quantidade, o.origem, o.prioridade, o.conta_meta
             from cota o
            where o.unidade_id = $1 and o.mes = $2::date
              and not exists (select 1 from cota x where x.unidade_id = o.unidade_id and x.mes = $3::date and x.servico_id = o.servico_id and x.origem = o.origem)
           on conflict (unidade_id, mes, servico_id, origem) do nothing
           returning id`,
          [u, mesParaData(de), mesParaData(para)],
        );
        return feito.rows.length;
      });
      const resultado: ResultadoDaCopia = { copiados };
      return c.json(resultado);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  return r;
}
