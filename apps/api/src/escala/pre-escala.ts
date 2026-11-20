// Pré-escala do Pronto (entrega 3.1): a equipe do dia 1, a prévia do que entra e as alocações que a gravação criaria.
// O banco é traduzido para o que o motor recebe (matrícula = id do militar, equipe = nome do ciclo ALFA…DELTA pela ordem do ciclo).
import { mesParaData, textoFaixa, type PreviaDaPreEscala } from 'contratos';
import { CICLO_EQUIPES, detectarEquipeInicial, diasDoMes, equipeDoDia, mesAnterior, normalizar, preencherVagas, PRE_ESCALA, proximoMes, type Militar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { avaliarFaixa, porAntiguidade, type Avaliado } from './elegibilidade.ts';
import { ordemDoMes } from './ordem-do-mes.ts';
import { sequenciaDePreenchimento } from './ordem.ts';
import { nomeDaVaga } from './vagas.ts';

export type AlocacaoPlanejada = { militarId: string; data: string; servicoId: string; turnoId: string; guarnicaoId: string | null; funcaoId: string | null };

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
      `select distinct on (m.id) m.id, l.equipe_id from lotacao l join militar m on m.id = l.militar_id
        where l.unidade_id = $1 and l.jornada = 'pronto' and l.equipe_id is not null order by m.id, l.desde desc`,
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
       join lotacao l on l.militar_id = a.militar_id and l.unidade_id = $1 and l.jornada = 'pronto' and l.desde <= a.data and (l.ate is null or l.ate >= a.data)
      where s.unidade_id = $1 and t.letra = 'A' and a.data >= $2::date and a.data < $3::date`,
    [unidadeId, mesParaData(mes), mesParaData(proximoMes(mes))],
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
    entram: 0,
    vazias: [],
    semGuarnicao: [],
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
  const inicioDoSeguinte = mesParaData(proximoMes(mes));
  const membros = (
    await c.query<{ equipe_id: string; n: number }>(
      `select l.equipe_id, count(distinct l.militar_id)::int as n from lotacao l join militar m on m.id = l.militar_id
        where l.unidade_id = $1 and l.jornada = 'pronto' and m.ativo and l.desde < $3::date and (l.ate is null or l.ate >= $2::date) group by l.equipe_id`,
      [unidadeId, inicioDoMes, inicioDoSeguinte],
    )
  ).rows;
  for (const e of equipes) {
    if (!membros.some((m) => m.equipe_id === e.id)) previa.avisos.push(`A equipe ${e.nome} não tem militares do Pronto na seção; nenhum serviço foi gerado para os dias dela.`);
  }

  // as vagas: a ordem do mês (guarnições vinculadas à faixa no vínculo vigente); a CNH e o tamanho da composição vêm da versão do mês
  const vinculo = (await vinculosDaEscala(c, escalaId)).find((v) => v.vigencia <= mes);
  const versoes = await versoesDasGuarnicoes(c, [...new Set((vinculo?.itens ?? []).map((i) => i.guarnicaoId))]);
  const composicao = new Map<string, { cnhExigida: string | null; funcoes: number }>();
  for (const it of vinculo?.itens ?? []) {
    const v = versaoNoMes(versoes.get(it.guarnicaoId) ?? [], mes);
    for (const f of v?.ativa ? v.composicao : []) composicao.set(`${it.guarnicaoId}|${f.funcaoId}`, { cnhExigida: f.cnhExigida, funcoes: v!.composicao.length });
  }
  const sequencia = sequenciaDePreenchimento((await ordemDoMes(c, escalaId, mes)).vagas);

  // o que já está ocupado (alocações com guarnição e função, e acúmulos), por dia, faixa, guarnição e função
  const ocupados = new Map<string, number>();
  const ocupacao = (
    await c.query<{ data: string; inicio: string; fim: string; guarnicao_id: string; funcao_id: string; n: number }>(
      `select to_char(a.data, 'YYYY-MM-DD') as data, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, a.guarnicao_id, a.funcao_id, count(*)::int as n
         from alocacao a join turno t on t.id = a.turno_id
        where a.escala_id = $1 and a.data >= $2::date and a.data < $3::date and a.guarnicao_id is not null and a.funcao_id is not null group by 1, 2, 3, 4, 5
       union all
       select to_char(a.data, 'YYYY-MM-DD'), to_char(t.inicio, 'HH24:MI'), to_char(t.fim, 'HH24:MI'), x.guarnicao_id, x.funcao_id, count(*)::int
         from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id join turno t on t.id = a.turno_id
        where a.escala_id = $1 and a.data >= $2::date and a.data < $3::date group by 1, 2, 3, 4, 5`,
      [escalaId, inicioDoMes, inicioDoSeguinte],
    )
  ).rows;
  for (const o of ocupacao) {
    const k = `${o.data}|${o.inicio}|${o.fim}|${o.guarnicao_id}|${o.funcao_id}`;
    ocupados.set(k, (ocupados.get(k) ?? 0) + o.n);
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
      const faixa = textoFaixa(t.inicio, t.fim);
      const { avaliados } = await avaliarFaixa(c, { escalaId, data, inicio: t.inicio, fim: t.fim, guarnicaoId: null, funcaoId: null });
      const candidatos: Avaliado[] = [];
      for (const a of avaliados) {
        if (a.candidato.jornada !== 'pronto' || a.candidato.equipe !== daEquipe.nome || a.militarMotivo !== null) continue;
        if (a.porTurno.find((p) => p.turno.turnoId === t.turno_id)?.motivo !== null) continue;
        if (removidos.has(`${a.candidato.militarId}|${data}|${t.turno_id}`)) {
          previa.removidosQueNaoVoltam++;
          continue;
        }
        candidatos.push(a);
      }
      candidatos.sort(porAntiguidade);

      const aindaOcupadas = new Map<string, number>();
      const livres = sequencia
        .filter((v) => (vinculo?.itens ?? []).some((it) => it.guarnicaoId === v.guarnicaoId && it.inicio === t.inicio && it.fim === t.fim))
        .filter((v) => {
          const k = `${v.guarnicaoId}|${v.funcaoId}`;
          const restam = aindaOcupadas.get(k) ?? ocupados.get(`${data}|${t.inicio}|${t.fim}|${k}`) ?? 0;
          aindaOcupadas.set(k, Math.max(0, restam - 1));
          return restam <= 0;
        });
      const resultado = preencherVagas(
        livres.map((v) => ({ chave: `${v.guarnicaoId}|${v.funcaoId}|${v.vaga}`, cnhExigida: composicao.get(`${v.guarnicaoId}|${v.funcaoId}`)?.cnhExigida ?? null })),
        candidatos.map((a) => ({ id: a.candidato.militarId, cnh: a.cnh })),
      );
      for (const at of resultado.atribuicoes) {
        const [guarnicaoId, funcaoId] = at.chave.split('|') as [string, string];
        novas.push({ militarId: at.id, data, servicoId: t.servico_id, turnoId: t.turno_id, guarnicaoId, funcaoId });
      }
      for (const id of resultado.semVaga) {
        novas.push({ militarId: id, data, servicoId: t.servico_id, turnoId: t.turno_id, guarnicaoId: null, funcaoId: null });
        previa.semGuarnicao.push({ data, faixa, nomeGuerra: candidatos.find((a) => a.candidato.militarId === id)!.candidato.nomeGuerra });
      }
      for (const chave of resultado.vazias) {
        const v = livres.find((x) => `${x.guarnicaoId}|${x.funcaoId}|${x.vaga}` === chave)!;
        previa.vazias.push({ data, faixa, vaga: nomeDaVaga(v.guarnicao, v.funcao, composicao.get(`${v.guarnicaoId}|${v.funcaoId}`)?.funcoes ?? 1), obrigatoria: v.obrigatoria });
      }
    }
  }
  previa.entram = novas.length;
  return { previa, novas, conflito: null };
}
