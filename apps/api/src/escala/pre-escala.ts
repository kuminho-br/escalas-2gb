// Pré-escala (entrega 3.1; 6.40): a equipe do dia 1, a prévia do que entra e as alocações que a gravação criaria. Só os turnos do Pronto (sem guarnição) e o expediente do Adm.
// O banco é traduzido para o que o motor recebe (matrícula = id do militar, equipe = nome do ciclo ALFA…DELTA pela ordem do ciclo).
import { mesParaData, type PreviaDaPreEscala } from 'contratos';
import { CICLO_EQUIPES, detectarEquipeInicial, diaDaSemana, diasDoMes, equipeDoDia, intervaloDoTurno, mesAnterior, mesVizinho, normalizar, PRE_ESCALA, type Militar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { feriadosDoAno } from '../cadastros/feriados.ts';
import { avaliarFaixa, porAntiguidade, type Avaliado } from './elegibilidade.ts';
import { PODE_SER_ESCALADO, SO_QBMG_OU_SEM_QUADRO } from './quadros-da-escala.ts';

/** `escalaId` nulo: o expediente do Adm, que não entra em nenhuma escala (6.40). */
export type AlocacaoPlanejada = { militarId: string; data: string; servicoId: string; turnoId: string; guarnicaoId: string | null; funcaoId: string | null; escalaId?: null };

export const SEM_EXPEDIENTE = 'Sem o serviço Expediente na unidade: o expediente não foi gerado.';

/** O que o escalante pediu não cabe nesta seção (a rota devolve 400). */
export class PreEscalaInvalida extends Error {}

type EquipeDoCiclo = { id: string; nome: string; ordem: number };

/** As equipes do ciclo da seção (ordem do ciclo de 1 a 4, como ALFA, BRAVO, CHARLIE e DELTA do motor). */
async function equipesDoCiclo(c: Consulta, unidadeId: string): Promise<EquipeDoCiclo[]> {
  const { rows } = await c.query<{ id: string; nome: string; ordem_ciclo: number }>(
    'select id, nome, ordem_ciclo from equipe where unidade_id = $1 and ordem_ciclo between 1 and $2 order by ordem_ciclo',
    [unidadeId, CICLO_EQUIPES.length],
  );
  return rows.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem_ciclo }));
}
const cicloDaEquipe = (e: EquipeDoCiclo) => CICLO_EQUIPES[e.ordem - 1]!;

/** A equipe que trabalha no dia 1 do mês, descoberta pelo Pronto turno A dos últimos dias do mês anterior; sem saber, `equipeId` nulo e o motivo. */
export async function equipeDoDia1(c: Consulta, unidadeId: string, mes: string): Promise<{ equipeId: string | null; motivo: string }> {
  const equipes = await equipesDoCiclo(c, unidadeId);
  const cicloPorId = new Map(equipes.map((e) => [e.id, cicloDaEquipe(e)]));
  const lotados = (
    await c.query<{ id: string; equipe_id: string }>(
      `select distinct on (m.id) m.id, l.equipe_id from rastreio l join militar m on m.id = l.militar_id
        where l.unidade_id = $1 and l.jornada = 'pronto' and l.equipe_id is not null and ${SO_QBMG_OU_SEM_QUADRO} order by m.id, l.desde desc`,
      [unidadeId],
    )
  ).rows;
  const militares: Militar[] = lotados.filter((r) => cicloPorId.has(r.equipe_id)).map((r) => ({ mat: r.id, jornada: 'PRONTO', equipe: cicloPorId.get(r.equipe_id)! }));
  const alocacoes = (
    await c.query<{ militar_id: string; dia: string; nome: string; letra: string }>(
      `select a.militar_id, to_char(a.data, 'YYYY-MM-DD') as dia, s.nome, t.letra
         from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id
        where s.unidade_id = $1 and t.letra = 'A' and a.data >= $2::date and a.data < $3::date`,
      [unidadeId, mesParaData(mesAnterior(mes)), mesParaData(mes)],
    )
  ).rows.map((r) => ({ mat: r.militar_id, dia: r.dia, servico: normalizar(r.nome) === normalizar(PRE_ESCALA.SERVICO) ? PRE_ESCALA.SERVICO : r.nome, turno: r.letra }));
  const detectada = detectarEquipeInicial(alocacoes, militares, { mes });
  const equipe = detectada.equipe ? equipes.find((e) => cicloDaEquipe(e) === detectada.equipe) : undefined;
  return { equipeId: equipe?.id ?? null, motivo: equipe ? '' : detectada.motivo };
}

/**
 * A equipe do dia 1 que o Pronto já gravado neste mês implica: cada Pronto A de um militar de uma equipe do ciclo num dia vota na
 * equipe que estaria no dia 1; empate não decide. Vale antes da detecção pelo mês anterior (gerar de novo não pode mudar de equipe).
 */
async function equipeJaNoMes(c: Consulta, unidadeId: string, mes: string, equipes: EquipeDoCiclo[]): Promise<EquipeDoCiclo | null> {
  const { rows } = await c.query<{ dia: number; equipe_id: string; nome: string }>(
    `select extract(day from a.data)::int as dia, l.equipe_id, s.nome
       from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id
       join rastreio l on l.militar_id = a.militar_id and l.unidade_id = $1 and l.jornada = 'pronto' and l.desde <= a.data and (l.ate is null or l.ate >= a.data)
      where s.unidade_id = $1 and t.letra = 'A' and a.data >= $2::date and a.data < $3::date`,
    [unidadeId, mesParaData(mes), mesParaData(mesVizinho(mes, 1))],
  );
  const votos = new Map<string, number>();
  for (const r of rows) {
    if (normalizar(r.nome) !== normalizar(PRE_ESCALA.SERVICO)) continue;
    const e = equipes.find((x) => x.id === r.equipe_id);
    if (!e) continue;
    const n = CICLO_EQUIPES.length;
    const doDia1 = CICLO_EQUIPES[(((e.ordem - 1 - (r.dia - 1)) % n) + n) % n]!;
    votos.set(doDia1, (votos.get(doDia1) ?? 0) + 1);
  }
  const ordem = [...votos.entries()].sort((a, b) => b[1] - a[1]);
  if (!ordem.length || (ordem.length > 1 && ordem[0]![1] === ordem[1]![1])) return null;
  return equipes.find((e) => cicloDaEquipe(e) === ordem[0]![0]) ?? null;
}

/**
 * A prévia da pré-escala do Pronto e as alocações que a gravação criaria. Nunca mexe no que já está escalado: a vaga ocupada
 * (inclusive por acúmulo) sai da lista, quem já está no horário não é candidato e quem o escalante removeu não volta ao dia e turno de onde saiu.
 * `equipeDia1Id` nulo vale a equipe que já está no Pronto do mês e, sem ela, a detectada pelo mês anterior; sem nenhuma, a prévia vem
 * vazia e pede a escolha. Outra equipe que a do Pronto já gravado no mês dá `conflito` (a gravação recusa: seriam duas equipes por dia).
 */
export async function planejarPreEscala(
  c: Consulta,
  escalaId: string,
  mes: string,
  equipeDia1Id: string | null,
): Promise<{ previa: PreviaDaPreEscala; novas: AlocacaoPlanejada[]; conflito: string | null }> {
  const unidadeId = (await c.query<{ unidade_id: string }>('select unidade_id from escala where id = $1', [escalaId])).rows[0]!.unidade_id;
  const equipes = await equipesDoCiclo(c, unidadeId);
  if (equipeDia1Id && !equipes.some((e) => e.id === equipeDia1Id)) throw new PreEscalaInvalida('Esta equipe não é do ciclo desta seção.');
  const detectada = await equipeDoDia1(c, unidadeId, mes);
  const noMes = await equipeJaNoMes(c, unidadeId, mes, equipes);
  const usada = equipes.find((e) => e.id === (equipeDia1Id ?? noMes?.id ?? detectada.equipeId));
  const previa: PreviaDaPreEscala = {
    mes,
    equipes: equipes.map((e) => ({ id: e.id, nome: e.nome })),
    equipeDetectada: detectada,
    equipeNoMes: noMes ? { id: noMes.id, nome: noMes.nome } : null,
    equipeUsada: usada ? { id: usada.id, nome: usada.nome } : null,
    entramNoTurno: 0,
    entramNoExpediente: 0,
    removidosQueNaoVoltam: 0,
    avisos: [],
  };
  if (!usada) {
    previa.avisos.push('Escolha a equipe do dia 1.');
    return { previa, novas: [], conflito: null };
  }
  if (noMes && noMes.id !== usada.id) {
    const conflito = `O Pronto deste mês já começa com a equipe ${noMes.nome} no dia 1. Gerar com outra equipe poria duas equipes no mesmo dia.`;
    previa.avisos.push(conflito);
    return { previa, novas: [], conflito };
  }

  // o Pronto da escala: o serviço ordinário com esse nome e os turnos A e B dele
  const turnosDoPronto = (
    await c.query<{ servico_id: string; nome: string; turno_id: string; letra: string; inicio: string; fim: string }>(
      `select s.id as servico_id, s.nome, t.id as turno_id, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from escala_servico es join servico s on s.id = es.servico_id join turno t on t.servico_id = s.id
        where es.escala_id = $1 and s.tipo = 'ordinario' and t.letra = any($2) order by t.letra`,
      [escalaId, PRE_ESCALA.TURNOS],
    )
  ).rows.filter((t) => normalizar(t.nome) === normalizar(PRE_ESCALA.SERVICO));
  if (!turnosDoPronto.length) {
    previa.avisos.push('Esta escala não tem o serviço Pronto: não há o que gerar.');
    return { previa, novas: [], conflito: null };
  }

  const inicioDoMes = mesParaData(mes);
  const inicioDoSeguinte = mesParaData(mesVizinho(mes, 1));
  const membros = (
    await c.query<{ equipe_id: string; n: number }>(
      `select l.equipe_id, count(distinct l.militar_id)::int as n from rastreio l join militar m on m.id = l.militar_id
        where l.unidade_id = $1 and l.jornada = 'pronto' and ${PODE_SER_ESCALADO} and ${SO_QBMG_OU_SEM_QUADRO} and l.desde < $3::date and (l.ate is null or l.ate >= $2::date) group by l.equipe_id`,
      [unidadeId, inicioDoMes, inicioDoSeguinte],
    )
  ).rows;
  for (const e of equipes) {
    if (!membros.some((m) => m.equipe_id === e.id)) previa.avisos.push(`A equipe ${e.nome} não tem militares do Pronto na seção; nenhum serviço foi gerado para os dias dela.`);
  }

  const removidos = new Set(
    (
      await c.query<{ militar_id: string; data: string; turno_id: string }>(
        // a remoção vale para militar, dia, serviço e turno, em qualquer escala que tenha o mesmo Pronto (adendo de 17/11)
        `select militar_id, to_char(data, 'YYYY-MM-DD') as data, turno_id from remocao where servico_id = any($1) and data >= $2::date and data < $3::date`,
        [[...new Set(turnosDoPronto.map((t) => t.servico_id))], inicioDoMes, inicioDoSeguinte],
      )
    ).rows.map((r) => `${r.militar_id}|${r.data}|${r.turno_id}`),
  );

  const novas: AlocacaoPlanejada[] = [];
  const cicloDoDia1 = cicloDaEquipe(usada);
  for (const [i, data] of diasDoMes(mes).entries()) {
    const daEquipe = equipes.find((e) => cicloDaEquipe(e) === equipeDoDia(cicloDoDia1, i));
    if (!daEquipe) continue;
    for (const t of turnosDoPronto) {
      const { avaliados } = await avaliarFaixa(c, { escalaId, data, inicio: t.inicio, fim: t.fim, guarnicaoId: null, funcaoId: null });
      const candidatos: Avaliado[] = [];
      for (const a of avaliados) {
        // o externo (de outra unidade, trazido pelo gestor) é lançado só à mão: a pré-escala do Pronto nunca o põe
        if (a.externo || a.candidato.jornada !== 'pronto' || a.candidato.equipe !== daEquipe.nome || a.militarMotivo !== null) continue;
        if (a.porTurno.find((p) => p.turno.turnoId === t.turno_id)?.motivo !== null) continue;
        if (removidos.has(`${a.candidato.militarId}|${data}|${t.turno_id}`)) {
          previa.removidosQueNaoVoltam++;
          continue;
        }
        candidatos.push(a);
      }
      candidatos.sort(porAntiguidade);
      // a pré-escala só põe a equipe do dia no turno: sem guarnição e sem função (o escalante move cada um para uma vaga, à mão)
      for (const a of candidatos) novas.push({ militarId: a.candidato.militarId, data, servicoId: t.servico_id, turnoId: t.turno_id, guarnicaoId: null, funcaoId: null });
    }
  }
  previa.entramNoTurno = novas.length;
  const expediente = await planejarExpediente(c, unidadeId, mes, previa);
  previa.entramNoExpediente = expediente.length;
  return { previa, novas: [...novas, ...expediente], conflito: null };
}

/**
 * O expediente do Adm (6.40): uma alocação do serviço Expediente, sem escala, em cada dia útil, para cada militar lotado na unidade com jornada Adm no período que vale no dia
 * (mesmo filtro de situação e de quadro do Pronto). Não vai no fim de semana, no feriado da unidade (nem no de uma unidade de cima), no dia de afastamento, no dia em que ele já
 * tem expediente nem no dia em que já tem, no horário do expediente, um serviço que tira do expediente (o Saldo). O expediente que o escalante removeu não volta.
 */
async function planejarExpediente(c: Consulta, unidadeId: string, mes: string, previa: PreviaDaPreEscala): Promise<AlocacaoPlanejada[]> {
  const exp = (
    await c.query<{ servico_id: string; turno_id: string; inicio: string; fim: string }>(
      `select s.id as servico_id, t.id as turno_id, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from servico s join turno t on t.servico_id = s.id where s.unidade_id = $1 and lower(btrim(s.nome)) = 'expediente' and t.letra = 'A'`,
      [unidadeId],
    )
  ).rows[0];
  if (!exp) {
    previa.semExpediente = SEM_EXPEDIENTE;
    previa.avisos.push(SEM_EXPEDIENTE);
    return [];
  }
  const horario = intervaloDoTurno(exp.inicio, exp.fim);
  const inicioDoMes = mesParaData(mes);
  const inicioDoSeguinte = mesParaData(mesVizinho(mes, 1));
  const periodos = (
    await c.query<{ militar_id: string; desde: string; ate: string | null }>(
      `select l.militar_id, to_char(l.desde, 'YYYY-MM-DD') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate
         from rastreio l join militar m on m.id = l.militar_id
        where l.unidade_id = $1 and l.jornada = 'adm' and ${PODE_SER_ESCALADO} and ${SO_QBMG_OU_SEM_QUADRO} and l.desde < $3::date and (l.ate is null or l.ate >= $2::date)`,
      [unidadeId, inicioDoMes, inicioDoSeguinte],
    )
  ).rows;
  if (!periodos.length) return [];
  const ids = [...new Set(periodos.map((p) => p.militar_id))];
  const afastamentos = (
    await c.query<{ militar_id: string; inicio: string; fim: string }>(
      "select militar_id, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim from afastamento where militar_id = any($1::uuid[]) and inicio < $3::date and fim >= $2::date",
      [ids, inicioDoMes, inicioDoSeguinte],
    )
  ).rows;
  // o que já está lançado (em qualquer escala e unidade) do dia anterior ao seguinte: o expediente que já existe e os serviços que tiram do expediente
  const lancados = (
    await c.query<{ militar_id: string; data: string; expediente: boolean; tira: boolean; inicio: string; fim: string }>(
      `select a.militar_id, to_char(a.data, 'YYYY-MM-DD') as data, lower(btrim(s.nome)) = 'expediente' as expediente, s.tira_do_expediente as tira,
              to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id
        where a.militar_id = any($1::uuid[]) and a.data >= $2::date - 1 and a.data <= $3::date and (lower(btrim(s.nome)) = 'expediente' or s.tira_do_expediente)`,
      [ids, inicioDoMes, inicioDoSeguinte],
    )
  ).rows;
  const removidos = new Set(
    (
      await c.query<{ militar_id: string; data: string }>(
        "select militar_id, to_char(data, 'YYYY-MM-DD') as data from remocao where servico_id = $1 and data >= $2::date and data < $3::date",
        [exp.servico_id, inicioDoMes, inicioDoSeguinte],
      )
    ).rows.map((r) => `${r.militar_id}|${r.data}`),
  );
  const feriados = new Set((await feriadosDoAno(c, unidadeId, Number(mes.slice(0, 4)))).map((f) => f.data));
  const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);

  const novas: AlocacaoPlanejada[] = [];
  for (const data of diasDoMes(mes)) {
    if (diaDaSemana(data) < 1 || diaDaSemana(data) > 5 || feriados.has(data)) continue;
    for (const id of ids) {
      if (!periodos.some((p) => p.militar_id === id && p.desde <= data && (p.ate === null || p.ate >= data))) continue;
      if (afastamentos.some((a) => a.militar_id === id && a.inicio <= data && a.fim >= data)) continue;
      const dele = lancados.filter((l) => l.militar_id === id);
      if (dele.some((l) => l.expediente && l.data === data)) continue;
      // um serviço que tira do expediente, no horário dele: o turno do dia anterior que passa da meia-noite também conta
      const cobre = dele.some((l) => {
        if (!l.tira) return false;
        const i = intervaloDoTurno(l.inicio, l.fim);
        const d = diasEntre(data, l.data) * 1440;
        return i.inicio + d < horario.fim && horario.inicio < i.fim + d;
      });
      if (cobre) continue;
      if (removidos.has(`${id}|${data}`)) {
        previa.removidosQueNaoVoltam++;
        continue;
      }
      novas.push({ militarId: id, data, servicoId: exp.servico_id, turnoId: exp.turno_id, guarnicaoId: null, funcaoId: null, escalaId: null });
    }
  }
  return novas;
}
