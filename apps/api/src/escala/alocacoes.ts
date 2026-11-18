// Escalar, remover e desfazer a remoção (telas: "Escolher militar", "Remover", "Desfazer").
// A conferência e a gravação acontecem na mesma transação; a recusa sai como Recusa (409) com a frase que a tela mostra.
import type { NovaAlocacao } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { motivoDeFora } from './elegibilidade.ts';

export class Recusa extends Error {
  constructor(mensagem: string) {
    super(mensagem);
  }
}

/** Escala o militar na vaga e devolve o mês da alocação. */
export async function escalar(tx: Consulta, escalaId: string, d: NovaAlocacao): Promise<string> {
  const turno = (
    await tx.query<{ servico_id: string; inicio: string; fim: string }>(
      `select t.servico_id, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from turno t join escala_servico es on es.servico_id = t.servico_id and es.escala_id = $1 where t.id = $2`,
      [escalaId, d.turnoId],
    )
  ).rows[0];
  if (!turno) throw new Recusa('Este turno não faz parte desta escala.');
  const mes = d.data.slice(0, 7);

  // a vaga: guarnição vinculada a esta faixa no mês (vínculo vigente), ativa, e função da composição dela
  let funcaoDaVaga: { funcao: string; maximo: number } | null = null;
  if (d.guarnicaoId && d.funcaoId) {
    const vinculo = (await vinculosDaEscala(tx, escalaId)).find((v) => v.vigencia <= mes);
    const naFaixa = vinculo?.itens.some((i) => i.guarnicaoId === d.guarnicaoId && i.inicio === turno.inicio && i.fim === turno.fim);
    const versao = versaoNoMes((await versoesDasGuarnicoes(tx, [d.guarnicaoId])).get(d.guarnicaoId) ?? [], mes);
    if (!naFaixa || !versao?.ativa) throw new Recusa('Esta guarnição não está nesta faixa neste mês.');
    const f = versao.composicao.find((x) => x.funcaoId === d.funcaoId);
    if (!f) throw new Recusa('Esta função não está na composição da guarnição.');
    funcaoDaVaga = { funcao: f.funcao, maximo: f.maximo };
  }

  // dois escalantes na mesma vaga ao mesmo tempo: o segundo espera o primeiro e confere de novo
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`${escalaId}|${d.data}|${turno.inicio}|${turno.fim}`]);
  if (funcaoDaVaga) {
    const n = (
      await tx.query<{ n: number }>(
        `select count(*)::int as n from alocacao a join turno t on t.id = a.turno_id
          where a.escala_id = $1 and a.data = $2::date and a.guarnicao_id = $3 and a.funcao_id = $4 and t.inicio = $5::time and t.fim = $6::time`,
        [escalaId, d.data, d.guarnicaoId, d.funcaoId, turno.inicio, turno.fim],
      )
    ).rows[0]!.n;
    if (n >= funcaoDaVaga.maximo) throw new Recusa(`A função ${funcaoDaVaga.funcao} já está completa nesta guarnição.`);
  }
  const igual = (
    await tx.query('select 1 from alocacao where militar_id = $1 and data = $2::date and servico_id = $3 and turno_id = $4', [d.militarId, d.data, turno.servico_id, d.turnoId])
  ).rows.length;
  if (igual) throw new Recusa('Este militar já está escalado neste turno.');
  const motivo = await motivoDeFora(tx, { escalaId, data: d.data, inicio: turno.inicio, fim: turno.fim, guarnicaoId: d.guarnicaoId, funcaoId: d.funcaoId, militarId: d.militarId, turnoId: d.turnoId });
  if (motivo) throw new Recusa(motivo);

  try {
    await tx.query(
      `insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, guarnicao_id, funcao_id, origem) values ($1, $2, $3, $4, $5::date, $6, $7, 'manual')`,
      [d.militarId, escalaId, turno.servico_id, d.turnoId, d.data, d.guarnicaoId, d.funcaoId],
    );
  } catch (e) {
    if ((e as { code?: string } | null)?.code === '23505') throw new Recusa('Este militar já está escalado neste turno.');
    throw e;
  }
  return mes;
}

/** Tira o militar da vaga e guarda a remoção (a pré-escala não o põe de volta nessa combinação). Devolve a escala e o mês. */
export async function remover(tx: Consulta, alocacaoId: string, usuarioId: string): Promise<{ escalaId: string; mes: string }> {
  const a = (
    await tx.query<{ escala_id: string; militar_id: string; servico_id: string; turno_id: string; data: string }>(
      `delete from alocacao where id = $1 returning escala_id, militar_id, servico_id, turno_id, to_char(data, 'YYYY-MM-DD') as data`,
      [alocacaoId],
    )
  ).rows[0]!;
  await tx.query(
    `insert into remocao (militar_id, escala_id, servico_id, turno_id, data, removida_por) values ($1, $2, $3, $4, $5::date, $6)
       on conflict (militar_id, data, servico_id, turno_id) do nothing`,
    [a.militar_id, a.escala_id, a.servico_id, a.turno_id, a.data, usuarioId],
  );
  return { escalaId: a.escala_id, mes: a.data.slice(0, 7) };
}

/** Desfaz a remoção. Devolve a escala e o mês. */
export async function desfazerRemocao(tx: Consulta, remocaoId: string): Promise<{ escalaId: string; mes: string }> {
  const r = (await tx.query<{ escala_id: string; data: string }>(`delete from remocao where id = $1 returning escala_id, to_char(data, 'YYYY-MM-DD') as data`, [remocaoId])).rows[0]!;
  return { escalaId: r.escala_id, mes: r.data.slice(0, 7) };
}
