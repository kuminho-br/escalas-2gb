// Meta de ativação no banco: a meta padrão (versões por data) e os dias diferentes (lista própria por dia).
import type { ItemDaMeta, MetaDoDia, VersaoDaMetaPadrao } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import { Recusa, remover, tirarAcumulo } from '../escala/alocacoes.ts';

/** Os ids que não são modelos desta seção (a mensagem do campo, ou null se está tudo certo). */
export async function modelosForaDaSecao(c: Consulta, unidadeId: string, ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const { rows } = await c.query<{ n: number }>('select count(*)::int as n from guarnicao where unidade_id = $1 and id = any($2::uuid[])', [unidadeId, ids]);
  return rows[0]!.n === new Set(ids).size ? null : 'Use modelos de guarnição desta seção.';
}

async function itensDaVersao(c: Consulta, tabela: 'meta_padrao_item' | 'meta_dia_item', coluna: 'versao_id' | 'meta_dia_id', pai: string): Promise<ItemDaMeta[]> {
  const { rows } = await c.query<ItemDaMeta>(
    `select i.guarnicao_id as "guarnicaoId", g.nome from ${tabela} i join guarnicao g on g.id = i.guarnicao_id where i.${coluna} = $1 order by i.ordem`,
    [pai],
  );
  return rows;
}

/** Todas as versões da meta padrão, da mais nova para a mais antiga. */
export async function versoesDaMetaPadrao(c: Consulta, unidadeId: string): Promise<VersaoDaMetaPadrao[]> {
  const { rows } = await c.query<{ id: string; desde: string }>(
    "select id, to_char(desde, 'YYYY-MM-DD') as desde from meta_padrao_versao where unidade_id = $1 order by desde desc",
    [unidadeId],
  );
  const versoes: VersaoDaMetaPadrao[] = [];
  for (const v of rows) versoes.push({ desde: v.desde, guarnicoes: await itensDaVersao(c, 'meta_padrao_item', 'versao_id', v.id) });
  return versoes;
}

/** A meta que vale no dia: a lista própria do dia, se houver; senão a versão da meta padrão de maior `desde` até ele; senão vazia. */
export async function metaDoDia(c: Consulta, unidadeId: string, data: string): Promise<MetaDoDia> {
  const dia = (await c.query<{ id: string }>('select id from meta_dia where unidade_id = $1 and data = $2::date', [unidadeId, data])).rows[0];
  if (dia) return { data, origem: 'dia', guarnicoes: await itensDaVersao(c, 'meta_dia_item', 'meta_dia_id', dia.id) };
  const versao = (
    await c.query<{ id: string }>('select id from meta_padrao_versao where unidade_id = $1 and desde <= $2::date order by desde desc limit 1', [unidadeId, data])
  ).rows[0];
  return { data, origem: 'padrao', guarnicoes: versao ? await itensDaVersao(c, 'meta_padrao_item', 'versao_id', versao.id) : [] };
}

/** Grava a meta padrão a partir de `desde`, no lugar da versão do mesmo `desde` (se houver). Lista vazia vale. */
export async function gravarMetaPadrao(tx: Consulta, unidadeId: string, desde: string, guarnicoes: string[]): Promise<void> {
  await tx.query('delete from meta_padrao_versao where unidade_id = $1 and desde = $2::date', [unidadeId, desde]);
  const id = (await tx.query<{ id: string }>('insert into meta_padrao_versao (unidade_id, desde) values ($1, $2::date) returning id', [unidadeId, desde])).rows[0]!.id;
  if (!guarnicoes.length) return;
  await tx.query(
    'insert into meta_padrao_item (versao_id, guarnicao_id, ordem) select $1, x.g, x.p::int from unnest($2::uuid[]) with ordinality as x(g, p)',
    [id, guarnicoes],
  );
}

/** Dá ao dia a lista própria, no lugar da que ele já tinha. Lista vazia vale: dia sem meta. */
export async function gravarMetaDoDia(tx: Consulta, unidadeId: string, data: string, guarnicoes: string[]): Promise<void> {
  await tx.query('delete from meta_dia where unidade_id = $1 and data = $2::date', [unidadeId, data]);
  const id = (await tx.query<{ id: string }>('insert into meta_dia (unidade_id, data) values ($1, $2::date) returning id', [unidadeId, data])).rows[0]!.id;
  if (!guarnicoes.length) return;
  await tx.query(
    'insert into meta_dia_item (meta_dia_id, guarnicao_id, ordem) select $1, x.g, x.p::int from unnest($2::uuid[]) with ordinality as x(g, p)',
    [id, guarnicoes],
  );
}

/**
 * Tira a guarnição da meta do dia (o dia que seguia o padrão passa a ter lista própria, o padrão sem ela; pode ficar vazia). Com
 * `desescalar`, saem também os acúmulos nela e as alocações do dia nela, em qualquer escala da seção, com a marca de remoção.
 */
export async function tirarDaMeta(tx: Consulta, unidadeId: string, data: string, guarnicaoId: string, desescalar: boolean, usuarioId: string): Promise<void> {
  const atual = await metaDoDia(tx, unidadeId, data);
  if (!atual.guarnicoes.some((g) => g.guarnicaoId === guarnicaoId)) throw new Recusa('Esta guarnição não está na meta deste dia.');
  await gravarMetaDoDia(tx, unidadeId, data, atual.guarnicoes.map((g) => g.guarnicaoId).filter((id) => id !== guarnicaoId));
  if (!desescalar) return;
  const acumulos = (
    await tx.query<{ id: string }>(
      `select x.id from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id join escala e on e.id = a.escala_id
        where e.unidade_id = $1 and a.data = $2::date and x.guarnicao_id = $3`,
      [unidadeId, data, guarnicaoId],
    )
  ).rows;
  for (const x of acumulos) await tirarAcumulo(tx, x.id);
  const alocacoes = (
    await tx.query<{ id: string }>(
      `select a.id from alocacao a join escala e on e.id = a.escala_id where e.unidade_id = $1 and a.data = $2::date and a.guarnicao_id = $3`,
      [unidadeId, data, guarnicaoId],
    )
  ).rows;
  for (const a of alocacoes) await remover(tx, a.id, usuarioId);
}

/** Tira a lista própria do dia: ele volta a valer a meta padrão. */
export async function voltarMetaAoPadrao(tx: Consulta, unidadeId: string, data: string): Promise<void> {
  await tx.query('delete from meta_dia where unidade_id = $1 and data = $2::date', [unidadeId, data]);
}
