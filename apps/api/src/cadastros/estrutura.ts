// A estrutura de um grupamento (entrega 6.10): as divisões ficam entre o grupamento e as seções. Quem vê e mexe é quem tem o nível de gestor
// (ou de administrador) no grupamento: o chefe de divisão não mexe na estrutura, nem na própria divisão. Mover uma seção muda na hora quem a
// alcança pela hierarquia, porque o acesso é conferido pelo caminho da unidade a cada pedido.
import { DivisaoDaSecao, NovaDivisao, type NoDaEstrutura, type TipoDoNo } from 'contratos';
import { Hono, type Context } from 'hono';
import { exigirPapel, exigirSessao, type AmbienteApi, type Papel } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife, inicioDoMes } from '../datas.ts';
import { lerCorpo } from '../erros.ts';

const DA_ESTRUTURA: Papel[] = ['gestor', 'administrador'];
const MSG_GRUPAMENTO = 'A estrutura é a de um grupamento.';
const MSG_SIGLA = 'Já existe uma unidade com esta sigla neste grupamento.';
const MSG_DIVISAO = 'Escolha uma divisão deste grupamento.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDEM = new Intl.Collator('pt-BR', { numeric: true });

type Linha = { id: string; sigla: string; nome: string; tipo: TipoDoNo; mae_id: string | null; proprios: number | null };

/** O grupamento com as divisões e as seções vigentes, as filhas na ordem das siglas. null se a unidade não é um grupamento. */
export async function estruturaDoGrupamento(c: Consulta, grupamentoId: string, hoje: string): Promise<NoDaEstrutura | null> {
  const { rows } = await c.query<Linha>(
    `select u.id, u.sigla, u.nome, u.tipo, u.mae_id,
            case when u.tipo = 'divisao' then (select count(*)::int from parametro x where x.unidade_id = u.id)
                                           + (select count(*)::int from feriado x where x.unidade_id = u.id)
                                           + (select count(*)::int from funcao x where x.unidade_id = u.id) end as proprios
       from unidade g join unidade u on u.caminho <@ g.caminho
      where g.id = $1 and g.tipo = 'grupamento' and (u.id = g.id or u.ate is null or u.ate >= $2::date)`,
    [grupamentoId, hoje],
  );
  const no = (l: Linha): NoDaEstrutura => ({
    id: l.id, sigla: l.sigla, nome: l.nome, tipo: l.tipo,
    ...(l.tipo === 'divisao' ? { cadastrosProprios: l.proprios ?? 0 } : {}),
    filhas: rows.filter((f) => f.mae_id === l.id).sort((a, b) => ORDEM.compare(a.sigla, b.sigla)).map(no),
  });
  const raiz = rows.find((l) => l.id === grupamentoId);
  return raiz ? no(raiz) : null;
}

/** A sigla já é de outra unidade vigente do grupamento (divisão ou seção), sem diferenciar maiúsculas? */
async function siglaRepetida(c: Consulta, grupamentoId: string, sigla: string, menosId: string | null, hoje: string): Promise<boolean> {
  const { rows } = await c.query(
    `select 1 from unidade g join unidade u on u.caminho <@ g.caminho
      where g.id = $1 and lower(u.sigla) = lower($2) and u.id::text is distinct from $3 and (u.ate is null or u.ate >= $4::date) limit 1`,
    [grupamentoId, sigla, menosId, hoje],
  );
  return rows.length > 0;
}

/** O grupamento de cima de uma unidade (o mais próximo); null se não há. */
async function grupamentoDe(c: Consulta, unidadeId: string): Promise<string | null> {
  const { rows } = await c.query<{ id: string }>(
    `select g.id from unidade u join unidade g on g.caminho @> u.caminho and g.tipo = 'grupamento' where u.id = $1 order by nlevel(g.caminho) desc limit 1`,
    [unidadeId],
  );
  return rows[0]?.id ?? null;
}

/** A unidade pelo id, só se for do tipo pedido. */
async function unidadeDoTipo(c: Consulta, id: string, tipo: TipoDoNo): Promise<{ id: string; mae_id: string } | undefined> {
  if (!UUID.test(id)) return undefined;
  return (await c.query<{ id: string; mae_id: string }>('select id, mae_id from unidade where id = $1 and tipo = $2', [id, tipo])).rows[0];
}

/** 404 e 403 pelo nível de acesso no grupamento; depois, 400 se a unidade não é um grupamento. */
async function exigirGestaoDoGrupamento(c: Context<AmbienteApi>, unidadeId: string): Promise<Response | null> {
  const negado = await exigirPapel(c, unidadeId, DA_ESTRUTURA);
  if (negado) return negado;
  const { rows } = await c.get('banco').query<{ tipo: string }>('select tipo from unidade where id = $1', [unidadeId]);
  return rows[0]!.tipo === 'grupamento' ? null : c.json({ erro: MSG_GRUPAMENTO }, 400);
}

export function rotasEstrutura(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/estrutura', '/unidades/:u/divisoes', '/divisoes/*', '/secoes/*']) r.use(caminho, sessao);

  r.get('/unidades/:u/estrutura', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirGestaoDoGrupamento(c, u);
    if (negado) return negado;
    return c.json((await estruturaDoGrupamento(c.get('banco'), u, hojeRecife()))!);
  });

  r.post('/unidades/:u/divisoes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirGestaoDoGrupamento(c, u);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaDivisao);
    if (!corpo.ok) return corpo.resposta;
    const { sigla, nome } = corpo.dados;
    const hoje = hojeRecife();
    const nova = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) => {
      // a trava no grupamento põe em fila dois pedidos com a mesma sigla
      await tx.query('select 1 from unidade where id = $1 for update', [u]);
      if (await siglaRepetida(tx, u, sigla, null, hoje)) return null;
      return (await tx.query<{ id: string }>("insert into unidade (tipo, sigla, nome, mae_id, desde) values ('divisao', $1, $2, $3, $4) returning id", [sigla, nome, u, inicioDoMes(hoje)])).rows[0]!.id;
    });
    if (!nova) return c.json({ erro: MSG_SIGLA, campos: { sigla: MSG_SIGLA } }, 409);
    return c.json({ id: nova, sigla, nome, tipo: 'divisao', filhas: [], cadastrosProprios: 0 } satisfies NoDaEstrutura, 201);
  });

  r.patch('/divisoes/:id', async (c) => {
    const banco = c.get('banco');
    const divisao = await unidadeDoTipo(banco, c.req.param('id'), 'divisao');
    if (!divisao) return c.json({ erro: 'Divisão não encontrada.' }, 404);
    const negado = await exigirPapel(c, divisao.mae_id, DA_ESTRUTURA);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaDivisao);
    if (!corpo.ok) return corpo.resposta;
    const { sigla, nome } = corpo.dados;
    const hoje = hojeRecife();
    const grupamento = (await grupamentoDe(banco, divisao.id)) ?? divisao.mae_id;
    const gravou = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
      await tx.query('select 1 from unidade where id = $1 for update', [grupamento]);
      if (await siglaRepetida(tx, grupamento, sigla, divisao.id, hoje)) return false;
      await tx.query('update unidade set sigla = $2, nome = $3 where id = $1 and (sigla, nome) is distinct from ($2, $3)', [divisao.id, sigla, nome]);
      return true;
    });
    if (!gravou) return c.json({ erro: MSG_SIGLA, campos: { sigla: MSG_SIGLA } }, 409);
    const arvore = (await estruturaDoGrupamento(banco, grupamento, hoje))!;
    return c.json(arvore.filhas.find((f) => f.id === divisao.id)!);
  });

  // põe a seção dentro de uma divisão do mesmo grupamento; `null` devolve a seção ao grupamento
  r.put('/secoes/:id/divisao', async (c) => {
    const banco = c.get('banco');
    const secao = await unidadeDoTipo(banco, c.req.param('id'), 'secao');
    const grupamento = secao ? await grupamentoDe(banco, secao.id) : null;
    if (!secao || !grupamento) return c.json({ erro: 'Seção não encontrada.' }, 404);
    const negado = await exigirPapel(c, grupamento, DA_ESTRUTURA);
    if (negado) return negado;
    const corpo = await lerCorpo(c, DivisaoDaSecao);
    if (!corpo.ok) return corpo.resposta;
    const { divisaoId } = corpo.dados;
    const hoje = hojeRecife();
    if (divisaoId) {
      const { rows } = await banco.query(
        "select 1 from unidade where id = $1 and tipo = 'divisao' and mae_id = $2 and (ate is null or ate >= $3::date)", [divisaoId, grupamento, hoje]);
      if (!rows.length) return c.json({ erro: MSG_DIVISAO, campos: { divisaoId: MSG_DIVISAO } }, 400);
    }
    const destino = divisaoId ?? grupamento;
    // o caminho da seção é refeito pelo gatilho do banco; quem tinha acesso só pela divisão antiga o perde no pedido seguinte
    await comUsuario(banco, c.get('usuarioId'), (tx) => tx.query('update unidade set mae_id = $2 where id = $1 and mae_id is distinct from $2', [secao.id, destino]));
    return c.json((await estruturaDoGrupamento(banco, grupamento, hoje))!);
  });

  return r;
}
