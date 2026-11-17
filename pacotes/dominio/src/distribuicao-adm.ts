// Distribuição do Adm (porte de prototipo/distribuicao_adm.js), com as remoções do escalante.
// Reparte os turnos do serviço normal do Adm pelos dias úteis do mês, procurando equalizar, nesta
// ordem: a cobertura de cada dia, a distribuição de cada militar pelas semanas, pelos dias da
// semana e o espaçamento entre os turnos. Todos recebem o mesmo número de turnos. Determinístico.
import { diaDaSemana, normalizar } from './nucleo.ts';
import type { Remocao } from './pre-escala.ts';

// quanto cada critério pesa na escolha (maior = mais importante)
export const ADM_PESO = { cobertura: 10, semana: 3, diaSemana: 1, posicao: 0.5 };

/** Índice da semana (segunda a domingo) em que o dia cai, contando da primeira semana do mês. */
export function semanaDoMes(dia: string): number {
  const dom = Number(dia.slice(8));
  const primeira = (diaDaSemana(`${dia.slice(0, 8)}01`) + 6) % 7; // 0 = segunda
  return Math.floor((dom - 1 + primeira) / 7);
}

export interface MilitarAdm {
  mat: string;
  /** dias úteis em que o turno do Adm bateria com outro serviço dele */
  ocupados?: Record<string, unknown> | null;
  /** dias em que ele já está no Adm neste mês */
  jaTem?: string[] | null;
}

export interface EntradaAdm {
  /** dias úteis do mês (sem fins de semana e feriados), em ordem */
  dias: string[];
  /** turnos Adm que cada militar deve ter no mês (inclui os que já tem) */
  turnos: number;
  militares: MilitarAdm[];
  /** serviço e turno do Adm: só as remoções deles contam (regra nova) */
  servico?: string;
  turno?: string;
  /** vagas de onde o escalante tirou o militar; as do Adm não são escolhidas de novo */
  remocoes?: Remocao[] | null;
}

interface Estado { mat: string; fixos: number[]; ja: number; livres: number[]; precisa: number; faltou: number; escolhidos: number[]; deslocamento: number }

export function distribuirAdm(entrada: EntradaAdm) {
  const dias = entrada.dias;
  const D = dias.length;
  const M = entrada.militares.length;
  const idx: Record<string, number> = Object.create(null);
  dias.forEach((d, i) => {
    idx[d] = i;
  });
  const semana = dias.map(semanaDoMes);
  const dow = dias.map(diaDaSemana);
  const nSem = D ? Math.max(...semana) + 1 : 0;
  const diasSem: number[] = new Array(nSem).fill(0);
  const diasDow: number[] = new Array(7).fill(0);
  for (let i = 0; i < D; i++) {
    diasSem[semana[i]]++;
    diasDow[dow[i]]++;
  }

  // remoções do Adm: matrícula|dia (remoção de outro serviço não bloqueia o Adm)
  const removida: Record<string, boolean> = Object.create(null);
  (entrada.remocoes || []).forEach((r) => {
    if (normalizar(r.servico) !== normalizar(entrada.servico)) return;
    if (entrada.turno && normalizar(r.turno) !== normalizar(entrada.turno)) return;
    removida[`${r.mat}|${r.dia}`] = true;
  });

  const est: Estado[] = entrada.militares.map((m, q) => {
    const fixos: number[] = [];
    let fora = 0;
    (m.jaTem || []).forEach((d) => {
      if (d in idx) {
        if (fixos.indexOf(idx[d]) < 0) fixos.push(idx[d]);
      } else fora++;
    });
    const ja = fixos.length + fora;
    let precisa = Math.max(0, entrada.turnos - ja);
    const livres: number[] = [];
    for (let i = 0; i < D; i++) {
      if (fixos.indexOf(i) < 0 && !(m.ocupados && m.ocupados[dias[i]]) && !removida[`${m.mat}|${dias[i]}`]) livres.push(i);
    }
    const faltou = Math.max(0, precisa - livres.length);
    precisa -= faltou;
    return { mat: m.mat, fixos, ja, livres, precisa, faltou, escolhidos: [], deslocamento: M ? Math.floor((q * D) / M) : 0 };
  });

  // custo individual: quão longe o conjunto de dias do militar está do ideal
  const personal = (set: number[]) => {
    const K = set.length;
    if (!K) return 0;
    const sw: number[] = new Array(nSem).fill(0);
    const sd: number[] = new Array(7).fill(0);
    set.forEach((i) => {
      sw[semana[i]]++;
      sd[dow[i]]++;
    });
    let c = 0;
    for (let w = 0; w < nSem; w++) c += ADM_PESO.semana * Math.pow(sw[w] - (K * diasSem[w]) / D, 2);
    for (let w = 1; w <= 5; w++) c += ADM_PESO.diaSemana * Math.pow(sd[w] - (K * diasDow[w]) / D, 2);
    const ordem = set.slice().sort((a, b) => a - b);
    const g = D / K;
    ordem.forEach((p, j) => {
      c += (ADM_PESO.posicao * Math.pow(p - ((j + 0.5) * g - 0.5), 2)) / g;
    });
    return c;
  };
  const conjunto = (e: Estado) => e.fixos.concat(e.escolhidos);

  const cob: number[] = new Array(D).fill(0);
  est.forEach((e) => e.fixos.forEach((i) => {
    cob[i]++;
  }));

  // 1. montagem inicial: em cada rodada, cada militar leva o dia que menos piora o conjunto
  const maior = est.reduce((m, e) => Math.max(m, e.precisa), 0);
  for (let r = 0; r < maior; r++) {
    for (let q = 0; q < M; q++) {
      const e = est[(q + r) % M];
      if (e.escolhidos.length >= e.precisa) continue;
      const atual = personal(conjunto(e));
      let melhor: { d: number; custo: number; desempate: number } | null = null;
      for (const d of e.livres) {
        if (e.escolhidos.indexOf(d) >= 0) continue;
        const custo = ADM_PESO.cobertura * (2 * cob[d] + 1) + personal(conjunto(e).concat([d])) - atual;
        const desempate = (d - e.deslocamento + D) % D;
        if (!melhor || custo < melhor.custo - 1e-9 || (Math.abs(custo - melhor.custo) <= 1e-9 && desempate < melhor.desempate)) melhor = { d, custo, desempate };
      }
      if (melhor) {
        e.escolhidos.push(melhor.d);
        cob[melhor.d]++;
      }
    }
  }

  // 2. refinamento: troca o dia de um turno por outro enquanto isso melhorar o conjunto
  for (let passada = 0, melhorou = true; melhorou && passada < 60; passada++) {
    melhorou = false;
    for (const e of est) {
      for (const a of e.escolhidos.slice()) {
        const base = personal(conjunto(e));
        let melhor: { b: number; delta: number } | null = null;
        for (const b of e.livres) {
          if (e.escolhidos.indexOf(b) >= 0) continue;
          const novo = e.fixos.concat(e.escolhidos.filter((x) => x !== a)).concat([b]);
          const delta = ADM_PESO.cobertura * (2 * (cob[b] - cob[a]) + 2) + personal(novo) - base;
          if (delta < -1e-9 && (!melhor || delta < melhor.delta)) melhor = { b, delta };
        }
        if (melhor) {
          e.escolhidos[e.escolhidos.indexOf(a)] = melhor.b;
          cob[a]--;
          cob[melhor.b]++;
          melhorou = true;
        }
      }
    }
  }

  const novas: { mat: string; dia: string }[] = [];
  const porMilitar: Record<string, { ja: number; novas: number; total: number; faltou: number }> = Object.create(null);
  const cobertura: Record<string, number> = Object.create(null);
  est.forEach((e) => {
    e.escolhidos
      .slice()
      .sort((a, b) => a - b)
      .forEach((i) => novas.push({ mat: e.mat, dia: dias[i] }));
    porMilitar[e.mat] = { ja: e.ja, novas: e.escolhidos.length, total: e.ja + e.escolhidos.length, faltou: e.faltou };
  });
  dias.forEach((d, i) => {
    cobertura[d] = cob[i];
  });
  return { novas, porMilitar, cobertura };
}
