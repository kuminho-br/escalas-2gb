// Quem vê cada estado da escala (fase 7.3.1). Quem já lê a escala em montagem pelo nível de acesso na unidade (ou pelas camadas de visão da 6.12) lê em qualquer estado, o rascunho
// inclusive. Para os demais: o rascunho ninguém; a prévia, o militar lotado hoje na unidade da escala ou abaixo dela, ou escalado nela naquele mês (e, na escala dos oficiais, só se é oficial);
// a publicada, a retificada e a remessada, toda conta.
import { mesParaData } from 'contratos';
import { CADASTRO, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { blocosDaUnidade, ehOficial } from '../visao/visao.ts';
import { estadoDoMes } from './estado.ts';

export type EscalaParaVer = { id: string; unidadeId: string; dosOficiais: boolean; estado: 'rascunho' | 'previa' | 'publicada' | 'retificada' | 'remessada' };

/**
 * A regra de visibilidade para uma conta e um mês, pronta para várias escalas: a lotação do militar, se ele é oficial, em quais escalas está escalado no mês e a leitura por nível de acesso de
 * cada unidade são calculadas uma vez por pedido (e só se a conta precisar), e não uma vez por escala.
 */
export function visibilidadeDoMes(c: Consulta, usuarioId: string, mes: string): (e: EscalaParaVer) => Promise<boolean> {
  const hoje = hojeRecife();
  const dados = {
    militar: undefined as Promise<{ militarId: string | null; unidadeDeHoje: string | null }> | undefined,
    oficial: undefined as Promise<boolean> | undefined,
    escaladas: undefined as Promise<Set<string>> | undefined,
    porNivel: new Map<string, Promise<boolean>>(),
    abaixo: new Map<string, Promise<boolean>>(),
  };
  const militar = () =>
    (dados.militar ??= (async () => {
      const m = (await c.query<{ militar_id: string | null }>('select militar_id from usuario where id = $1 and ativo', [usuarioId])).rows[0]?.militar_id ?? null;
      if (!m) return { militarId: null, unidadeDeHoje: null };
      const u = (await c.query<{ unidade_id: string }>('select unidade_id from rastreio where militar_id = $1 and desde <= $2::date and (ate is null or ate >= $2::date) limit 1', [m, hoje])).rows[0]?.unidade_id ?? null;
      return { militarId: m, unidadeDeHoje: u };
    })());
  const oficial = () => (dados.oficial ??= ehOficial(c, usuarioId, hoje));
  const escaladas = () =>
    (dados.escaladas ??= (async () => {
      const { militarId } = await militar();
      if (!militarId) return new Set<string>();
      const { rows } = await c.query<{ escala_id: string }>(
        "select distinct escala_id from alocacao where militar_id = $1 and escala_id is not null and data >= $2::date and data < ($2::date + interval '1 month')", [militarId, mesParaData(mes)],
      );
      return new Set(rows.map((r) => r.escala_id));
    })());
  const lePorNivel = (unidadeId: string) => {
    if (!dados.porNivel.has(unidadeId)) {
      dados.porNivel.set(unidadeId, (async () => (await temPapel(c, usuarioId, unidadeId, CADASTRO, hoje)) || (await blocosDaUnidade(c, usuarioId, unidadeId, hoje)).has('escala_em_montagem'))());
    }
    return dados.porNivel.get(unidadeId)!;
  };
  /** O militar está lotado hoje na unidade ou numa de baixo dela? */
  const lotadoAbaixo = (unidadeId: string) => {
    if (!dados.abaixo.has(unidadeId)) {
      dados.abaixo.set(unidadeId, (async () => {
        const { unidadeDeHoje } = await militar();
        if (!unidadeDeHoje) return false;
        return (await c.query<{ ok: boolean }>('select a.caminho @> l.caminho as ok from unidade a, unidade l where a.id = $1 and l.id = $2', [unidadeId, unidadeDeHoje])).rows[0]?.ok ?? false;
      })());
    }
    return dados.abaixo.get(unidadeId)!;
  };
  return async (e) => {
    if (await lePorNivel(e.unidadeId)) return true;
    if (e.estado === 'rascunho') return false;
    if (e.estado !== 'previa') return true;
    if (e.dosOficiais && !(await oficial())) return false;
    return (await lotadoAbaixo(e.unidadeId)) || (await escaladas()).has(e.id);
  };
}

/** A conta pode ver a escala neste mês? */
export async function podeVerEscala(c: Consulta, usuarioId: string, escalaId: string, mes: string): Promise<boolean> {
  const e = (await c.query<{ unidade_id: string; oficiais: boolean }>("select unidade_id, (distribuicao <> 'pre_escala') as oficiais from escala where id = $1", [escalaId])).rows[0];
  if (!e) return false;
  const { estado } = await estadoDoMes(c, escalaId, mes);
  return visibilidadeDoMes(c, usuarioId, mes)({ id: escalaId, unidadeId: e.unidade_id, dosOficiais: e.oficiais, estado });
}
