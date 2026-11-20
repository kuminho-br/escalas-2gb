// Meta de ativação no banco: a meta padrão (versões por data) e os dias diferentes (lista própria por dia).
import type { DesfazerDesativacao, ItemDaMeta, MetaDoDia, VersaoDaMetaPadrao } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import { acumular, escalar, JA_ESCALADO_NO_TURNO, Recusa, remover } from '../escala/alocacoes.ts';

/** Os dados do "Desfazer" não batem com esta seção (400). */
export class DadosInvalidos extends Error {}

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

/** A meta padrão que vale no dia: a versão de maior `desde` até ele, ou vazia. */
export async function metaPadraoDoDia(c: Consulta, unidadeId: string, data: string): Promise<MetaDoDia> {
  const versao = (
    await c.query<{ id: string }>('select id from meta_padrao_versao where unidade_id = $1 and desde <= $2::date order by desde desc limit 1', [unidadeId, data])
  ).rows[0];
  return { data, origem: 'padrao', guarnicoes: versao ? await itensDaVersao(c, 'meta_padrao_item', 'versao_id', versao.id) : [] };
}

/** A meta que vale no dia: a lista própria do dia, se houver; senão a da meta padrão. */
export async function metaDoDia(c: Consulta, unidadeId: string, data: string): Promise<MetaDoDia> {
  const dia = (await c.query<{ id: string }>('select id from meta_dia where unidade_id = $1 and data = $2::date', [unidadeId, data])).rows[0];
  if (dia) return { data, origem: 'dia', guarnicoes: await itensDaVersao(c, 'meta_dia_item', 'meta_dia_id', dia.id) };
  return metaPadraoDoDia(c, unidadeId, data);
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
 * Desativa a guarnição no dia: ela sai da meta do dia (o dia que seguia o padrão passa a ter lista própria, o padrão sem ela; pode ficar
 * vazia) e quem está nela é desescalado: as alocações do dia nela, em qualquer escala da seção, com a marca de remoção, e os acúmulos nela
 * e os de quem saiu. Devolve o que tirou e a meta de antes, para o "Desfazer".
 */
export async function desativar(tx: Consulta, unidadeId: string, data: string, guarnicaoId: string, usuarioId: string): Promise<DesfazerDesativacao> {
  const atual = await metaDoDia(tx, unidadeId, data);
  if (!atual.guarnicoes.some((g) => g.guarnicaoId === guarnicaoId)) throw new Recusa('Esta guarnição não está na meta deste dia.');
  const metaAntes = { origem: atual.origem, guarnicoes: atual.guarnicoes.map((g) => g.guarnicaoId) };

  const alocacoes = (
    await tx.query<{ id: string; militar_id: string; escala_id: string; servico_id: string; turno_id: string; guarnicao_id: string | null; funcao_id: string | null; origem: DesfazerDesativacao['alocacoes'][number]['origem'] }>(
      `select a.id, a.militar_id, a.escala_id, a.servico_id, a.turno_id, a.guarnicao_id, a.funcao_id, a.origem
         from alocacao a join escala e on e.id = a.escala_id where e.unidade_id = $1 and a.data = $2::date and a.guarnicao_id = $3`,
      [unidadeId, data, guarnicaoId],
    )
  ).rows;
  // os acúmulos que saem: os nesta guarnição e os de quem sai (de qualquer guarnição)
  const acumulos = (
    await tx.query<{ id: string; alocacao_id: string; guarnicao_id: string; funcao_id: string }>(
      `select x.id, x.alocacao_id, x.guarnicao_id, x.funcao_id from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id join escala e on e.id = a.escala_id
        where e.unidade_id = $1 and a.data = $2::date and (x.guarnicao_id = $3 or a.id = any($4::uuid[]))`,
      [unidadeId, data, guarnicaoId, alocacoes.map((a) => a.id)],
    )
  ).rows;
  const desfeitas: DesfazerDesativacao['alocacoes'] = alocacoes.map((a) => ({
    alocacaoId: a.id, militarId: a.militar_id, escalaId: a.escala_id, servicoId: a.servico_id, turnoId: a.turno_id, data,
    guarnicaoId: a.guarnicao_id, funcaoId: a.funcao_id, origem: a.origem,
  }));

  await gravarMetaDoDia(tx, unidadeId, data, metaAntes.guarnicoes.filter((id) => id !== guarnicaoId));
  if (acumulos.length) await tx.query('delete from alocacao_acumulo where id = any($1::uuid[])', [acumulos.map((x) => x.id)]);
  for (const a of alocacoes) await remover(tx, a.id, usuarioId);
  return {
    guarnicaoId,
    metaAntes,
    alocacoes: desfeitas,
    acumulos: acumulos.map((x) => ({ alocacaoId: x.alocacao_id, guarnicaoId: x.guarnicao_id, funcaoId: x.funcao_id })),
  };
}

const NAO_DEU_PARA_DESFAZER = 'Não deu para desfazer: alguém já ocupa um desses lugares.';

/**
 * Desfaz a desativação, na mesma transação. O corpo vem do cliente, então nada nele vale por si: tudo precisa ser desta seção e deste dia, e
 * cada alocação e cada acúmulo é recriado pelas mesmas regras de "escalar" e "acumular" (militar lotado na seção, CNH, choque, vaga com a
 * função livre…). Devolve a meta (o dia que seguia o padrão volta a segui-lo). Qualquer recusa desfaz tudo e vira `Recusa` com o motivo.
 */
export async function desfazerDesativacao(tx: Consulta, unidadeId: string, data: string, d: DesfazerDesativacao): Promise<void> {
  // tudo precisa ser desta seção e deste dia (antes de gravar qualquer coisa)
  const contar = async (sql: string, ids: string[]) => (await tx.query<{ n: number }>(sql, [ids, unidadeId])).rows[0]!.n === ids.length;
  const unicos = (ids: string[]) => [...new Set(ids)];
  const escalas = unicos(d.alocacoes.map((a) => a.escalaId));
  const servicos = unicos(d.alocacoes.map((a) => a.servicoId));
  const guarnicoes = unicos([d.guarnicaoId, ...d.metaAntes.guarnicoes, ...d.alocacoes.flatMap((a) => (a.guarnicaoId ? [a.guarnicaoId] : [])), ...d.acumulos.map((x) => x.guarnicaoId)]);
  const turnosDoServico = unicos(d.alocacoes.map((a) => `${a.servicoId}|${a.turnoId}`));
  const voltam = new Set(d.alocacoes.map((a) => a.alocacaoId));
  // o acúmulo de uma alocação que não volta precisa estar numa alocação que existe nesta seção, neste dia
  const aoAcumuloDeFora = unicos(d.acumulos.map((x) => x.alocacaoId).filter((id) => !voltam.has(id)));
  const ok =
    d.alocacoes.every((a) => a.data === data && Boolean(a.guarnicaoId) === Boolean(a.funcaoId)) &&
    (!escalas.length || (await contar('select count(*)::int as n from escala where id = any($1::uuid[]) and unidade_id = $2', escalas))) &&
    (!servicos.length || (await contar('select count(*)::int as n from servico where id = any($1::uuid[]) and unidade_id = $2', servicos))) &&
    (await modelosForaDaSecao(tx, unidadeId, guarnicoes)) === null &&
    (await Promise.all(turnosDoServico.map(async (t) => (await tx.query('select 1 from turno where id = $1 and servico_id = $2', [t.split('|')[1], t.split('|')[0]])).rows.length === 1))).every(Boolean) &&
    (!aoAcumuloDeFora.length ||
      (
        await tx.query<{ n: number }>(
          `select count(*)::int as n from alocacao a join escala e on e.id = a.escala_id where a.id = any($1::uuid[]) and e.unidade_id = $2 and a.data = $3::date`,
          [aoAcumuloDeFora, unidadeId, data],
        )
      ).rows[0]!.n === aoAcumuloDeFora.length);
  if (!ok) throw new DadosInvalidos();

  if (d.metaAntes.origem === 'padrao') await voltarMetaAoPadrao(tx, unidadeId, data);
  else await gravarMetaDoDia(tx, unidadeId, data, d.metaAntes.guarnicoes);

  // a recusa de uma regra de escalar vira a frase do "Desfazer"; o lugar já ocupado pelo mesmo militar tem a frase própria
  const comoRecusaDoDesfazer = (e: unknown): never => {
    if (e instanceof Recusa) throw new Recusa(e.message === JA_ESCALADO_NO_TURNO ? NAO_DEU_PARA_DESFAZER : `Não deu para desfazer: ${e.message}`);
    const codigo = (e as { code?: string } | null)?.code;
    if (codigo === '23505') throw new Recusa(NAO_DEU_PARA_DESFAZER);
    // a alocação de um acúmulo que ficou já não existe: a escala mudou desde então
    if (codigo === '23503') throw new Recusa('Não deu para desfazer: a escala mudou desde então.');
    throw e;
  };
  const novos = new Map<string, string>();
  try {
    for (const a of d.alocacoes) {
      await escalar(tx, a.escalaId, { militarId: a.militarId, data: a.data, turnoId: a.turnoId, guarnicaoId: a.guarnicaoId, funcaoId: a.funcaoId });
      // a alocação volta com a origem que tinha (o `escalar` grava "manual")
      const { rows } = await tx.query<{ id: string }>(
        'update alocacao set origem = $5 where militar_id = $1 and data = $2::date and servico_id = $3 and turno_id = $4 returning id',
        [a.militarId, a.data, a.servicoId, a.turnoId, a.origem],
      );
      novos.set(a.alocacaoId, rows[0]!.id);
    }
    for (const x of d.acumulos) await acumular(tx, novos.get(x.alocacaoId) ?? x.alocacaoId, { guarnicaoId: x.guarnicaoId, funcaoId: x.funcaoId });
  } catch (e) {
    comoRecusaDoDesfazer(e);
  }
}

/** Tira a lista própria do dia: ele volta a valer a meta padrão. */
export async function voltarMetaAoPadrao(tx: Consulta, unidadeId: string, data: string): Promise<void> {
  await tx.query('delete from meta_dia where unidade_id = $1 and data = $2::date', [unidadeId, data]);
}
