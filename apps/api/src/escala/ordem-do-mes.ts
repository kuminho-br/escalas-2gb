// Ordem de escala no banco: a ordem em vigor num mês (maior vigência até ele) e a gravação de uma versão nova.
import { mesParaData, type OrdemDeEscala, type VagaDaOrdem } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { aplicarOrdem, vagasDoMes, type ModeloDaGuarnicao } from './ordem.ts';

/** As vagas da escala no mês: vínculo vigente, guarnições ativas na versão do mês, composição delas. */
async function vagasDaEscala(c: Consulta, escalaId: string, mes: string) {
  const vinculo = (await vinculosDaEscala(c, escalaId)).find((v) => v.vigencia <= mes);
  const itens = vinculo?.itens ?? [];
  const versoes = await versoesDasGuarnicoes(c, [...new Set(itens.map((i) => i.guarnicaoId))]);
  const modelos: ModeloDaGuarnicao[] = [];
  for (const it of itens) {
    const v = versaoNoMes(versoes.get(it.guarnicaoId) ?? [], mes);
    if (v?.ativa) modelos.push({ guarnicaoId: it.guarnicaoId, guarnicao: it.guarnicao, prioridade: v.prioridade, composicao: v.composicao });
  }
  return vagasDoMes(modelos);
}

/** A ordem em vigor no mês; sem nenhuma versão até ele, `vigencia: null` e a sugestão pela prioridade antiga das guarnições. */
export async function ordemDoMes(c: Consulta, escalaId: string, mes: string): Promise<OrdemDeEscala> {
  const vagas = await vagasDaEscala(c, escalaId, mes);
  const versao = (
    await c.query<{ id: string; vigencia: string }>(
      `select id, to_char(vigencia_desde, 'YYYY-MM') as vigencia from ordem_escala_versao
        where escala_id = $1 and vigencia_desde <= $2::date order by vigencia_desde desc limit 1`,
      [escalaId, mesParaData(mes)],
    )
  ).rows[0];
  const itens = versao
    ? (await c.query<VagaDaOrdem>(`select guarnicao_id as "guarnicaoId", funcao_id as "funcaoId", vaga from ordem_escala_item where versao_id = $1 order by posicao`, [versao.id])).rows
    : null;
  return { escalaId, mes, vigencia: versao?.vigencia ?? null, vagas: aplicarOrdem(vagas, itens) };
}

/** Grava a ordem a partir do mês, no lugar da versão do mesmo mês (se houver). Lista vazia vale: todas as vagas ficam sem número. */
export async function gravarOrdem(tx: Consulta, escalaId: string, mes: string, itens: VagaDaOrdem[]): Promise<void> {
  const desde = mesParaData(mes);
  await tx.query('delete from ordem_escala_versao where escala_id = $1 and vigencia_desde = $2::date', [escalaId, desde]);
  const id = (await tx.query<{ id: string }>('insert into ordem_escala_versao (escala_id, vigencia_desde) values ($1, $2::date) returning id', [escalaId, desde])).rows[0]!.id;
  if (!itens.length) return;
  await tx.query(
    `insert into ordem_escala_item (versao_id, posicao, guarnicao_id, funcao_id, vaga)
     select $1, x.p::int, x.g, x.f, x.v from unnest($2::uuid[], $3::uuid[], $4::int[]) with ordinality as x(g, f, v, p)`,
    [id, itens.map((i) => i.guarnicaoId), itens.map((i) => i.funcaoId), itens.map((i) => i.vaga)],
  );
}
