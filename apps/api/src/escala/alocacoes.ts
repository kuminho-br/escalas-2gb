// Escalar, remover e desfazer a remoção (telas: "Escolher militar", "Remover", "Desfazer").
// A conferência e a gravação acontecem na mesma transação; a recusa sai como Recusa (409) com a frase que a tela mostra.
import type { NovaAlocacao, NovoAcumulo } from 'contratos';
import { cnhParaEscala } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { motivoDeFora, SEM_VOLUNTARIADO } from './elegibilidade.ts';

/** A frase de quando o militar já está escalado naquele serviço e turno (o "Desfazer" da desativação a reconhece). */
export const JA_ESCALADO_NO_TURNO = 'Este militar já está escalado neste turno.';

export class Recusa extends Error {
  constructor(mensagem: string) {
    super(mensagem);
  }
}

type VagaConferida = { funcao: string; maximo: number; cnhExigida: string | null };

/** A vaga existe nesta faixa neste mês: guarnição vinculada à faixa (vínculo vigente), ativa, e função da composição dela. */
async function conferirVaga(tx: Consulta, escalaId: string, mes: string, faixa: { inicio: string; fim: string }, guarnicaoId: string, funcaoId: string): Promise<VagaConferida> {
  const vinculo = (await vinculosDaEscala(tx, escalaId)).find((v) => v.vigencia <= mes);
  const naFaixa = vinculo?.itens.some((i) => i.guarnicaoId === guarnicaoId && i.inicio === faixa.inicio && i.fim === faixa.fim);
  const versao = versaoNoMes((await versoesDasGuarnicoes(tx, [guarnicaoId])).get(guarnicaoId) ?? [], mes);
  if (!naFaixa || !versao?.ativa) throw new Recusa('Esta guarnição não está nesta faixa neste mês.');
  const f = versao.composicao.find((x) => x.funcaoId === funcaoId);
  if (!f) throw new Recusa('Esta função não está na composição da guarnição.');
  return { funcao: f.funcao, maximo: f.maximo, cnhExigida: f.cnhExigida };
}

/** Quantos ocupam a vaga na faixa do dia: as alocações com ela como posto e os acúmulos dela (um acúmulo ocupa a função como qualquer outro). */
export async function ocupantesDaFuncao(tx: Consulta, escalaId: string, data: string, faixa: { inicio: string; fim: string }, guarnicaoId: string, funcaoId: string): Promise<number> {
  const { rows } = await tx.query<{ n: number }>(
    `select (
       (select count(*) from alocacao a join turno t on t.id = a.turno_id
         where a.escala_id = $1 and a.data = $2::date and a.guarnicao_id = $3 and a.funcao_id = $4 and t.inicio = $5::time and t.fim = $6::time)
     + (select count(*) from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id join turno t on t.id = a.turno_id
         where a.escala_id = $1 and a.data = $2::date and x.guarnicao_id = $3 and x.funcao_id = $4 and t.inicio = $5::time and t.fim = $6::time)
     )::int as n`,
    [escalaId, data, guarnicaoId, funcaoId, faixa.inicio, faixa.fim],
  );
  return rows[0]!.n;
}

/**
 * Devolver um militar a uma vaga: a vaga ainda existe na faixa do dia, ele tem (no quadro de motoristas) a CNH que a função exige e a função tem lugar para mais um.
 * `Recusa` se a vaga já não existe ou se falta a CNH; false se a função está completa.
 */
export async function vagaTemLugar(tx: Consulta, escalaId: string, data: string, faixa: { inicio: string; fim: string }, guarnicaoId: string, funcaoId: string, militar: { motorista: boolean; cnh: string[] }): Promise<boolean> {
  const vaga = await conferirVaga(tx, escalaId, data.slice(0, 7), faixa, guarnicaoId, funcaoId);
  if (vaga.cnhExigida && !cnhParaEscala(militar).includes(vaga.cnhExigida)) throw new Recusa('Sem a CNH exigida');
  await travaDaFaixa(tx, escalaId, data, faixa);
  return (await ocupantesDaFuncao(tx, escalaId, data, faixa, guarnicaoId, funcaoId)) < vaga.maximo;
}

const travaDaFaixa = (tx: Consulta, escalaId: string, data: string, faixa: { inicio: string; fim: string }) =>
  // dois escalantes na mesma vaga ao mesmo tempo: o segundo espera o primeiro e confere de novo
  tx.query('select pg_advisory_xact_lock(hashtext($1))', [`${escalaId}|${data}|${faixa.inicio}|${faixa.fim}`]);

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
  const funcaoDaVaga = d.guarnicaoId && d.funcaoId ? await conferirVaga(tx, escalaId, mes, turno, d.guarnicaoId, d.funcaoId) : null;

  await travaDaFaixa(tx, escalaId, d.data, turno);
  if (funcaoDaVaga && d.guarnicaoId && d.funcaoId) {
    const n = await ocupantesDaFuncao(tx, escalaId, d.data, turno, d.guarnicaoId, d.funcaoId);
    if (n >= funcaoDaVaga.maximo) throw new Recusa(`A função ${funcaoDaVaga.funcao} já está completa nesta guarnição.`);
  }
  const igual = (
    await tx.query('select 1 from alocacao where militar_id = $1 and data = $2::date and servico_id = $3 and turno_id = $4', [d.militarId, d.data, turno.servico_id, d.turnoId])
  ).rows.length;
  if (igual) throw new Recusa(JA_ESCALADO_NO_TURNO);
  const motivo = await motivoDeFora(tx, { escalaId, data: d.data, inicio: turno.inicio, fim: turno.fim, guarnicaoId: d.guarnicaoId, funcaoId: d.funcaoId, militarId: d.militarId, turnoId: d.turnoId });
  // só o voluntariado pode ser contornado: o escalante combina direto com o militar; as demais regras continuam recusando
  if (motivo && motivo !== SEM_VOLUNTARIADO) throw new Recusa(motivo);

  try {
    await tx.query(
      `insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, guarnicao_id, funcao_id, origem) values ($1, $2, $3, $4, $5::date, $6, $7, 'manual')`,
      [d.militarId, escalaId, turno.servico_id, d.turnoId, d.data, d.guarnicaoId, d.funcaoId],
    );
  } catch (e) {
    if ((e as { code?: string } | null)?.code === '23505') throw new Recusa(JA_ESCALADO_NO_TURNO);
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

/** O militar de uma alocação ocupa também esta vaga (acúmulo de funções). Devolve a escala e o mês. */
export async function acumular(tx: Consulta, alocacaoId: string, d: NovoAcumulo): Promise<{ escalaId: string; mes: string }> {
  const a = (
    await tx.query<{ escala_id: string; data: string; guarnicao_id: string | null; funcao_id: string | null; motorista: boolean; cnh: string[]; inicio: string; fim: string }>(
      `select a.escala_id, to_char(a.data, 'YYYY-MM-DD') as data, a.guarnicao_id, a.funcao_id, m.motorista, m.cnh, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from alocacao a join turno t on t.id = a.turno_id join militar m on m.id = a.militar_id where a.id = $1`,
      [alocacaoId],
    )
  ).rows[0]!;
  const mes = a.data.slice(0, 7);
  if (!a.guarnicao_id || !a.funcao_id) throw new Recusa('Escolha uma vaga de guarnição para este militar antes de acumular.');
  // a vaga que ele já ocupa precisa ser de um card (vinculada à faixa neste mês, guarnição ativa, função na composição); senão ele está em "Sem guarnição"
  await conferirVaga(tx, a.escala_id, mes, a, a.guarnicao_id, a.funcao_id).catch((e) => {
    throw e instanceof Recusa ? new Recusa('Escolha uma vaga de guarnição para este militar antes de acumular.') : e;
  });
  const vaga = await conferirVaga(tx, a.escala_id, mes, a, d.guarnicaoId, d.funcaoId);

  await travaDaFaixa(tx, a.escala_id, a.data, a);
  const jaOcupaMsg = `Este militar já ocupa uma vaga de ${vaga.funcao} nesta guarnição.`;
  const naOriginal = a.guarnicao_id === d.guarnicaoId && a.funcao_id === d.funcaoId;
  const emAcumulo = (await tx.query('select 1 from alocacao_acumulo where alocacao_id = $1 and guarnicao_id = $2 and funcao_id = $3', [alocacaoId, d.guarnicaoId, d.funcaoId])).rows.length > 0;
  if (naOriginal || emAcumulo) throw new Recusa(jaOcupaMsg);
  if (vaga.cnhExigida && !cnhParaEscala(a).includes(vaga.cnhExigida)) throw new Recusa('Sem a CNH exigida');
  if ((await ocupantesDaFuncao(tx, a.escala_id, a.data, a, d.guarnicaoId, d.funcaoId)) >= vaga.maximo) {
    throw new Recusa(`A função ${vaga.funcao} já está completa nesta guarnição.`);
  }
  try {
    await tx.query('insert into alocacao_acumulo (alocacao_id, guarnicao_id, funcao_id) values ($1, $2, $3)', [alocacaoId, d.guarnicaoId, d.funcaoId]);
  } catch (e) {
    if ((e as { code?: string } | null)?.code === '23505') throw new Recusa(jaOcupaMsg);
    throw e;
  }
  return { escalaId: a.escala_id, mes };
}

/** Tira só a vaga acumulada: o militar continua na vaga original e não há remoção. Devolve a escala e o mês. */
export async function tirarAcumulo(tx: Consulta, acumuloId: string): Promise<{ escalaId: string; mes: string }> {
  const a = (
    await tx.query<{ escala_id: string; data: string }>(
      `select a.escala_id, to_char(a.data, 'YYYY-MM-DD') as data from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id where x.id = $1`,
      [acumuloId],
    )
  ).rows[0]!;
  await tx.query('delete from alocacao_acumulo where id = $1', [acumuloId]);
  return { escalaId: a.escala_id, mes: a.data.slice(0, 7) };
}
