// Feriados: da própria unidade, mais os herdados das unidades acima (um dia é feriado para a unidade se houver
// feriado nela ou em qualquer unidade acima). Só se edita o da própria unidade.
import { CopiaDeFeriados, EdicaoFeriado, NovoFeriado, type Feriado, type ResultadoDaCopia } from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';

type Ctx = Context<AmbienteApi>;
const MSG_DATA = { '23505': 'Já existe um feriado nesta data.' };

const SELECT = `select f.id, to_char(f.data, 'YYYY-MM-DD') as data, f.descricao, f.fixo, un.sigla as "unidadeSigla", f.unidade_id <> alvo.id as herdado
                  from feriado f
                  join unidade un on un.id = f.unidade_id
                  join unidade alvo on alvo.id = $1`;

/** Feriados do ano da unidade (próprios e herdados de cima), em ordem de data. */
async function feriadosDoAno(c: Consulta, unidadeId: string, ano: number): Promise<Feriado[]> {
  const { rows } = await c.query<Feriado>(
    `${SELECT} where un.caminho @> alvo.caminho and extract(year from f.data) = $2 order by f.data, herdado desc, f.descricao`,
    [unidadeId, ano],
  );
  return rows;
}

async function feriadoDaUnidade(c: Consulta, unidadeId: string, id: string): Promise<Feriado> {
  return (await c.query<Feriado>(`${SELECT} where f.id = $2`, [unidadeId, id])).rows[0]!;
}

/** O feriado da unidade nessa data (fora o `exceto`), se houver. */
async function feriadoNaData(c: Consulta, unidadeId: string, data: string, exceto?: string): Promise<{ descricao: string } | null> {
  const { rows } = await c.query<{ id: string; descricao: string }>('select id, descricao from feriado where unidade_id = $1 and data = $2::date', [unidadeId, data]);
  return rows.find((f) => f.id !== exceto) ?? null;
}

/** O mesmo dia e mês no outro ano; null quando não existe (29 de fevereiro em ano comum). */
export function mesmoDiaEmOutroAno(data: string, ano: number): string | null {
  const alvo = `${String(ano).padStart(4, '0')}${data.slice(4)}`;
  const d = new Date(`${alvo}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === alvo ? alvo : null;
}

export function rotasFeriados(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/feriados', '/unidades/:u/feriados/*', '/feriados/*']) r.use(caminho, sessao);

  /** Papel de cadastro na unidade dona do feriado; 404 se ele não existe. */
  async function doFeriado(c: Ctx, id: string): Promise<{ resposta: Response } | { unidadeId: string }> {
    const unidadeId = await unidadeDoRegistro(dep.banco, 'feriado', id);
    if (!unidadeId) return { resposta: c.json({ erro: 'Feriado não encontrado.' }, 404) };
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    return negado ? { resposta: negado } : { unidadeId };
  }

  r.get('/unidades/:u/feriados', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const bruto = c.req.query('ano') ?? hojeRecife().slice(0, 4);
    if (!/^\d{4}$/.test(bruto)) return c.json({ erro: 'Ano inválido: use 4 dígitos (ex.: 2026).' }, 400);
    return c.json(await feriadosDoAno(dep.banco, u, Number(bruto)));
  });

  r.post('/unidades/:u/feriados', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoFeriado);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const igual = await feriadoNaData(dep.banco, u, d.data);
    if (igual) return c.json({ erro: `Já existe um feriado nesta data: "${igual.descricao}".` }, 409);
    try {
      const f = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (await tx.query<{ id: string }>('insert into feriado (unidade_id, data, descricao, fixo) values ($1, $2::date, $3, $4) returning id', [u, d.data, d.descricao, d.fixo])).rows[0]!.id;
        return feriadoDaUnidade(tx, u, id);
      });
      return c.json(f, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_DATA);
    }
  });

  r.patch('/feriados/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await doFeriado(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, EdicaoFeriado);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    if (d.data) {
      const igual = await feriadoNaData(dep.banco, acesso.unidadeId, d.data, id);
      if (igual) return c.json({ erro: `Já existe um feriado nesta data: "${igual.descricao}".` }, 409);
    }
    try {
      const f = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('update feriado set data = coalesce($2::date, data), descricao = coalesce($3::text, descricao), fixo = coalesce($4::boolean, fixo) where id = $1', [
          id, d.data ?? null, d.descricao ?? null, d.fixo ?? null,
        ]);
        return feriadoDaUnidade(tx, acesso.unidadeId, id);
      });
      return c.json(f);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_DATA);
    }
  });

  r.delete('/feriados/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await doFeriado(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) => tx.query('delete from feriado where id = $1', [id]));
    return c.body(null, 204);
  });

  r.post('/unidades/:u/feriados/copiar-fixos', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, CopiaDeFeriados);
    if (!corpo.ok) return corpo.resposta;
    const { de, para } = corpo.dados;
    const copiados = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      // só os fixos da própria unidade; os herdados continuam vindo de cima
      const { rows } = await tx.query<{ data: string; descricao: string }>(
        "select to_char(data, 'YYYY-MM-DD') as data, descricao from feriado where unidade_id = $1 and fixo and extract(year from data) = $2 order by data",
        [u, de],
      );
      let n = 0;
      for (const f of rows) {
        const nova = mesmoDiaEmOutroAno(f.data, para);
        if (!nova) continue;
        const feito = await tx.query('insert into feriado (unidade_id, data, descricao, fixo) values ($1, $2::date, $3, true) on conflict (unidade_id, data) do nothing returning id', [u, nova, f.descricao]);
        n += feito.rows.length;
      }
      return n;
    });
    const resultado: ResultadoDaCopia = { copiados };
    return c.json(resultado);
  });

  return r;
}
