// Escalar, remover e desfazer a remoção (telas: "Escolher militar", "Remover", "Desfazer").
// A conferência e a gravação acontecem na mesma transação; a recusa sai como Recusa (409) com a frase que a tela mostra.
import type { DesfazerResolucao, NovaAlocacao, NovoAcumulo, ResolverChoque } from 'contratos';
import { motivoDaCnh } from 'dominio';
import { CADASTRO, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { avaliarFaixa, motivoDeFora, podeTirarDe, SEM_VOLUNTARIADO } from './elegibilidade.ts';

/** A frase de quando o militar já está escalado naquele serviço e turno (o "Desfazer" da desativação a reconhece). */
export const JA_ESCALADO_NO_TURNO = 'Este militar já está escalado neste turno.';

export class Recusa extends Error {
  constructor(mensagem: string) {
    super(mensagem);
  }
}

/** A recusa por falta de nível de acesso (403), como a de `exigirPapel`, mas dentro da transação. */
export class Proibida extends Error {}

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
  if (vaga.cnhExigida) {
    const motivo = motivoDaCnh(militar, vaga.cnhExigida);
    if (motivo) throw new Recusa(motivo);
  }
  await travaDaFaixa(tx, escalaId, data, faixa);
  return (await ocupantesDaFuncao(tx, escalaId, data, faixa, guarnicaoId, funcaoId)) < vaga.maximo;
}

const travaDaFaixa = (tx: Consulta, escalaId: string, data: string, faixa: { inicio: string; fim: string }) =>
  // dois escalantes na mesma vaga ao mesmo tempo: o segundo espera o primeiro e confere de novo
  tx.query('select pg_advisory_xact_lock(hashtext($1))', [`${escalaId}|${data}|${faixa.inicio}|${faixa.fim}`]);

/** Escala o militar na vaga e devolve o mês da alocação. */
export async function escalar(tx: Consulta, escalaId: string, d: Omit<NovaAlocacao, 'resolverChoque'>, opcoes: { tirarDoExpediente?: boolean } = {}): Promise<string> {
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
    await tx.query<{ id: string; escala_id: string | null; guarnicao_id: string | null }>('select id, escala_id, guarnicao_id from alocacao where militar_id = $1 and data = $2::date and servico_id = $3 and turno_id = $4', [d.militarId, d.data, turno.servico_id, d.turnoId])
  ).rows[0];
  // quem a pré-escala pôs neste turno desta escala sem guarnição (6.40) é movido para a vaga; qualquer outro caso é "já escalado"
  const mover = igual && igual.escala_id === escalaId && igual.guarnicao_id === null && d.guarnicaoId !== null ? igual : null;
  if (igual && !mover) throw new Recusa(JA_ESCALADO_NO_TURNO);
  const motivo = await motivoDeFora(tx, { escalaId, data: d.data, inicio: turno.inicio, fim: turno.fim, guarnicaoId: d.guarnicaoId, funcaoId: d.funcaoId, militarId: d.militarId, turnoId: d.turnoId, tirarDoExpediente: opcoes.tirarDoExpediente });
  // só o voluntariado pode ser contornado: o escalante combina direto com o militar; as demais regras continuam recusando
  if (motivo && motivo !== SEM_VOLUNTARIADO) throw new Recusa(motivo);

  if (mover) {
    await tx.query('update alocacao set guarnicao_id = $2, funcao_id = $3 where id = $1', [mover.id, d.guarnicaoId, d.funcaoId]);
    return mes;
  }
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

/**
 * Tira o militar da vaga e guarda a remoção (a pré-escala não o põe de volta nessa combinação), com a vaga de onde ele saiu: guarnição, função e as vagas acumuladas,
 * para o "Desfazer" devolvê-lo ao mesmo lugar. Devolve a escala, o mês e o id da remoção.
 */
export async function remover(tx: Consulta, alocacaoId: string, usuarioId: string): Promise<{ escalaId: string | null; mes: string; remocaoId: string }> {
  const acumulos = (await tx.query<{ guarnicaoId: string; funcaoId: string }>('select guarnicao_id as "guarnicaoId", funcao_id as "funcaoId" from alocacao_acumulo where alocacao_id = $1', [alocacaoId])).rows;
  const a = (
    await tx.query<{ escala_id: string; militar_id: string; servico_id: string; turno_id: string; data: string; guarnicao_id: string | null; funcao_id: string | null }>(
      `delete from alocacao where id = $1 returning escala_id, militar_id, servico_id, turno_id, to_char(data, 'YYYY-MM-DD') as data, guarnicao_id, funcao_id`,
      [alocacaoId],
    )
  ).rows[0]!;
  const remocaoId = (
    await tx.query<{ id: string }>(
      `insert into remocao (militar_id, escala_id, servico_id, turno_id, data, removida_por, guarnicao_id, funcao_id, acumulos, devolvivel) values ($1, $2, $3, $4, $5::date, $6, $7, $8, $9::jsonb, true)
         on conflict (militar_id, data, servico_id, turno_id) do update set removida_por = excluded.removida_por, guarnicao_id = excluded.guarnicao_id, funcao_id = excluded.funcao_id, acumulos = excluded.acumulos, devolvivel = true
         returning id`,
      [a.militar_id, a.escala_id, a.servico_id, a.turno_id, a.data, usuarioId, a.guarnicao_id, a.funcao_id, JSON.stringify(acumulos)],
    )
  ).rows[0]!.id;
  return { escalaId: a.escala_id, mes: a.data.slice(0, 7), remocaoId };
}

/** Desfaz a remoção. Devolve a escala e o mês. */
export async function desfazerRemocao(tx: Consulta, remocaoId: string): Promise<{ escalaId: string | null; mes: string }> {
  const r = (await tx.query<{ escala_id: string | null; data: string }>(`delete from remocao where id = $1 returning escala_id, to_char(data, 'YYYY-MM-DD') as data`, [remocaoId])).rows[0]!;
  return { escalaId: r.escala_id, mes: r.data.slice(0, 7) };
}

export const NAO_DA_PARA_DESFAZER = 'A escala mudou desde então. Não dá mais para desfazer.';

/**
 * "Desfazer" a remoção: devolve o militar à vaga de onde saiu (mesmo dia, turno, guarnição e função) e às vagas que acumulava, tirando a marca de removido, numa transação.
 * As mesmas regras de escalar valem de novo: se a vaga já foi ocupada, a guarnição saiu da faixa ou o militar já não pode ocupá-la, recusa com NAO_DA_PARA_DESFAZER e nada muda.
 * A remoção antiga, que não guardou a vaga, também recusa: nela só vale "Permitir de novo".
 */
export async function devolverRemocao(tx: Consulta, remocaoId: string): Promise<{ escalaId: string | null; mes: string }> {
  const r = (
    await tx.query<{ escala_id: string | null; militar_id: string; servico_id: string; turno_id: string; data: string; guarnicao_id: string | null; funcao_id: string | null; acumulos: { guarnicaoId: string; funcaoId: string }[]; devolvivel: boolean }>(
      `select escala_id, militar_id, servico_id, turno_id, to_char(data, 'YYYY-MM-DD') as data, guarnicao_id, funcao_id, acumulos, devolvivel from remocao where id = $1 for update`,
      [remocaoId],
    )
  ).rows[0];
  if (!r || !r.devolvivel) throw new Recusa(NAO_DA_PARA_DESFAZER);
  // o expediente do Adm lançado pela pré-escala (6.40) não tem escala: volta como estava, sem vaga nem acúmulo
  if (r.escala_id === null) {
    const ocupado = (await tx.query('select 1 from alocacao where militar_id = $1 and data = $2::date and servico_id = $3 and turno_id = $4', [r.militar_id, r.data, r.servico_id, r.turno_id])).rows.length;
    if (ocupado) throw new Recusa(NAO_DA_PARA_DESFAZER);
    await tx.query("insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, origem) values ($1, null, $2, $3, $4::date, 'pre_escala')", [r.militar_id, r.servico_id, r.turno_id, r.data]);
    return { escalaId: null, mes: r.data.slice(0, 7) };
  }
  try {
    await escalar(tx, r.escala_id, { militarId: r.militar_id, data: r.data, turnoId: r.turno_id, guarnicaoId: r.guarnicao_id, funcaoId: r.funcao_id });
  } catch (e) {
    throw e instanceof Recusa ? new Recusa(NAO_DA_PARA_DESFAZER) : e;
  }
  // as vagas acumuladas voltam se ainda couberem: o que não cabe mais fica de fora, sem desfazer o resto
  const nova = (await tx.query<{ id: string }>('select id from alocacao where militar_id = $1 and data = $2::date and servico_id = $3 and turno_id = $4', [r.militar_id, r.data, r.servico_id, r.turno_id])).rows[0]!.id;
  for (const x of r.acumulos) {
    await tx.query('savepoint acumulo_devolvido');
    try {
      await acumular(tx, nova, x);
      await tx.query('release savepoint acumulo_devolvido');
    } catch {
      await tx.query('rollback to savepoint acumulo_devolvido');
    }
  }
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
  if (vaga.cnhExigida) {
    const motivo = motivoDaCnh(a, vaga.cnhExigida);
    if (motivo) throw new Recusa(motivo);
  }
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

export const MSG_NAO_CHOCA = 'Este serviço não choca com esta vaga. Atualize a lista e tente de novo.';
export const MSG_SEM_PODER_LA = 'Você não pode tirar o militar deste serviço: ele é de uma escala de fora da sua unidade ou de uma unidade acima da sua.';
export const MSG_SEM_PODER_NA_LOTACAO = 'Você não pode tirar o militar do expediente: ele é de uma unidade em que você não tem nível de acesso.';

/**
 * Escala o militar na vaga resolvendo o choque (6.38), numa transação só (a do chamador): ou as duas coisas, ou nenhuma.
 * `alocacaoId`: tira o militar do serviço que choca (pela remoção devolvível) e o escala aqui; `expediente`: escala por cima do expediente do dia.
 * Devolve o mês e o que o "Desfazer" precisa. Recusa (409) quando o serviço de lá não choca de verdade ou quando a vaga já não aceita o militar; Proibida (403) quando
 * quem pede não pode mexer lá.
 */
export async function escalarResolvendo(
  tx: Consulta, escalaId: string, d: Omit<NovaAlocacao, 'resolverChoque'>, resolver: ResolverChoque, usuarioId: string, hoje: string,
): Promise<{ mes: string; desfazer: { alocacaoId: string; remocaoId: string | null } }> {
  const novaAlocacao = async () => (await tx.query<{ id: string }>('select id from alocacao where militar_id = $1 and data = $2::date and turno_id = $3', [d.militarId, d.data, d.turnoId])).rows[0]!.id;
  const turnoDaVaga = (await tx.query<{ inicio: string; fim: string; tira: boolean }>(
    "select to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, s.tira_do_expediente as tira from turno t join servico s on s.id = t.servico_id where t.id = $1", [d.turnoId],
  )).rows[0];
  if (!turnoDaVaga) throw new Recusa('Este turno não faz parte desta escala.');
  const doTurno = async () => (await avaliarFaixa(tx, { escalaId, data: d.data, inicio: turnoDaVaga.inicio, fim: turnoDaVaga.fim, guarnicaoId: d.guarnicaoId, funcaoId: d.funcaoId }, d.militarId)).avaliados[0]?.porTurno.find((t) => t.turno.turnoId === d.turnoId);

  if ('expediente' in resolver) {
    const lotacao = (await tx.query<{ unidade_id: string }>('select unidade_id from rastreio where militar_id = $1 and desde <= $2::date and (ate is null or ate >= $2::date) limit 1', [d.militarId, d.data])).rows[0];
    // o pedido só muda o que acontece quando o serviço pode tirar do expediente; o motivo "De expediente" de quem não pode continua valendo
    if (turnoDaVaga.tira && lotacao && !(await temPapel(tx, usuarioId, lotacao.unidade_id, CADASTRO, hoje))) throw new Proibida(MSG_SEM_PODER_NA_LOTACAO);
    // o expediente que a pré-escala lançou (6.40) sai antes, pela remoção devolvível; o expediente calculado some sozinho sob o serviço
    let remocaoId: string | null = null;
    const lancado = turnoDaVaga.tira ? (await doTurno())?.conflito?.expedienteLancado : undefined;
    if (lancado) remocaoId = (await remover(tx, lancado.id, usuarioId)).remocaoId;
    const mes = await escalar(tx, escalaId, d, { tirarDoExpediente: true });
    return { mes, desfazer: { alocacaoId: await novaAlocacao(), remocaoId } };
  }

  // o serviço de lá precisa chocar de verdade com esta vaga, e ser do mesmo militar (senão o pedido removeria um serviço qualquer)
  const noTurno = await doTurno();
  const ali = noTurno?.conflito?.alocacoes.find((a) => a.id === resolver.alocacaoId);
  if (!ali) throw new Recusa(noTurno?.motivo && !noTurno.conflito ? noTurno.motivo : MSG_NAO_CHOCA);
  const unidadeDaEscala = (await tx.query<{ unidade_id: string }>('select unidade_id from escala where id = $1', [escalaId])).rows[0]!.unidade_id;
  if (!(await podeTirarDe(tx, { usuarioId, hoje }, ali, unidadeDaEscala))) throw new Proibida(MSG_SEM_PODER_LA);
  const { remocaoId } = await remover(tx, ali.id, usuarioId);
  await escalar(tx, escalaId, d);
  return { mes: d.data.slice(0, 7), desfazer: { alocacaoId: await novaAlocacao(), remocaoId } };
}

/** "Desfazer" a resolução (6.38): tira a alocação nova (sem deixar marca de remoção) e devolve a de lá; nada muda se a escala mudou desde então. */
export async function desfazerResolucao(tx: Consulta, d: DesfazerResolucao): Promise<{ escalaId: string; mes: string }> {
  const nova = (await tx.query<{ escala_id: string; data: string }>("delete from alocacao where id = $1 returning escala_id, to_char(data, 'YYYY-MM-DD') as data", [d.alocacaoId])).rows[0];
  if (!nova) throw new Recusa(NAO_DA_PARA_DESFAZER);
  if (d.remocaoId) await devolverRemocao(tx, d.remocaoId);
  return { escalaId: nova.escala_id!, mes: nova.data.slice(0, 7) };
}

/**
 * "Desfazer" o movimento do turno para a vaga (6.40): devolve a alocação ao turno sem guarnição, se ela continua na vaga para onde foi movida e sem acúmulos;
 * senão a escala mudou desde então e nada muda. Devolve a escala e o mês.
 */
export async function voltarAoTurno(tx: Consulta, alocacaoId: string, vaga: { guarnicaoId: string; funcaoId: string }): Promise<{ escalaId: string; mes: string }> {
  const a = (
    await tx.query<{ escala_id: string | null; data: string }>(
      `select escala_id, to_char(data, 'YYYY-MM-DD') as data from alocacao a where id = $1 and guarnicao_id = $2 and funcao_id = $3
          and not exists (select 1 from alocacao_acumulo x where x.alocacao_id = a.id) for update`,
      [alocacaoId, vaga.guarnicaoId, vaga.funcaoId],
    )
  ).rows[0];
  if (!a || !a.escala_id) throw new Recusa(NAO_DA_PARA_DESFAZER);
  await tx.query('update alocacao set guarnicao_id = null, funcao_id = null where id = $1', [alocacaoId]);
  return { escalaId: a.escala_id, mes: a.data.slice(0, 7) };
}
