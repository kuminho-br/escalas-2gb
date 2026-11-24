// Choques de horário (porte de prototipo/choques.js).
// Um choque é a sobreposição real de horários do mesmo militar: cada alocação vira um intervalo
// (dia + início do turno, com a duração de início a fim, atravessando a meia-noite quando for o
// caso). Encostar não é choque. A letra do turno não entra na conta: os horários vêm do cadastro.
// Regras extras: EMENDA (JES terminando quando o Pronto começa) e EXPEDIENTE implícito do Adm.
import { chaveAloc, normalizar, numeroDoDia, partesDaChave } from './nucleo.ts';

// emenda proibida: o serviço 'de' terminando exatamente quando o serviço 'para' começa
export const EMENDA_PROIBIDA = { de: 'JES', para: 'PRONTO' };
// serviços que ocupam o lugar do expediente no dia em que se sobrepõem a ele (a regra do protótipo; o sistema novo usa
// `op.tiramDoExpediente`, a lista dos serviços cadastrados com essa opção)
export const SUBSTITUEM_EXPEDIENTE = ['SALDO'];

export interface Horario { ini: number; fim: number; dur: number }
export type Horarios = Record<string, Horario>;

/** 'HH:mm', 'H:mm', 'HH:mm:ss', '8h', '8h30' -> minutos desde 00:00 (24:00 vira 0). null se ilegível. */
export function minutosDoDia(txt: unknown): number | null {
  const m = String(txt == null ? '' : txt).trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 24 || mn > 59 || (h === 24 && mn > 0)) return null;
  const total = h * 60 + mn;
  return total === 1440 ? 0 : total;
}

export function horasTexto(minutos: number): string {
  return String(Math.round(minutos / 6) / 10).replace('.', ',');
}

export interface LinhaTurno { servico?: string; turno?: string; inicio?: unknown; fim?: unknown; duracao?: unknown }

/**
 * Horários do cadastro de turnos, por 'Serviço|Turno'. A duração vem do início e do fim; se a
 * duração declarada discordar, avisa.
 */
export function montarHorarios(linhas: LinhaTurno[]): { porChave: Horarios; avisos: string[] } {
  const porChave: Horarios = Object.create(null);
  const avisos: string[] = [];
  linhas.forEach((l) => {
    if (!l.servico || !l.turno) return;
    const nome = `${l.servico} ${l.turno}`;
    const ini = minutosDoDia(l.inicio);
    const fim = minutosDoDia(l.fim);
    if (ini === null || fim === null) {
      avisos.push(`TURNOS: "${nome}" tem início ou fim ilegível ("${l.inicio}" / "${l.fim}"); esse turno fica fora da checagem.`);
      return;
    }
    const dur = (fim - ini + 1440) % 1440 || 1440;
    const declarada = parseFloat(String(l.duracao == null ? '' : l.duracao).replace(',', '.'));
    if (isFinite(declarada) && Math.abs(declarada * 60 - dur) > 1) {
      avisos.push(`TURNOS: "${nome}" vai de ${l.inicio} a ${l.fim} (${horasTexto(dur)} h), mas a coluna DURAÇÃO diz ${declarada} h. A checagem usa início e fim.`);
    }
    porChave[`${l.servico}|${l.turno}`] = { ini, fim, dur };
  });
  return { porChave, avisos };
}

export interface AlocChoque { mat: string; dia: string; turno: string; servico: string; implicito?: boolean }
interface Intervalo { dia: string; turno: string; servico: string; chave: string; ini: number; fim: number; implicito: boolean }
export interface LadoDoChoque { dia: string; turno: string; servico: string; chave: string; implicito: boolean }
export interface Choque { mat: string; tipo: 'duplicata' | 'sobreposicao' | 'expediente' | 'emenda'; a: LadoDoChoque; b: LadoDoChoque; minutos: number }

const lado = (x: Intervalo, implicito: boolean): LadoDoChoque => ({ dia: x.dia, turno: x.turno, servico: x.servico, chave: x.chave, implicito });

/**
 * Procura sobreposições entre as alocações de cada militar (passe todos os meses: assim o dia 31
 * enxerga o dia 01).
 * op.mes: só relata choques em que pelo menos uma das duas alocações é desse mês.
 * op.tipos: { 'Serviço': 'Tipo' }; com ele, o expediente implícito só choca com Diária (regra do protótipo).
 * op.tiramDoExpediente: a regra do sistema novo (6.37), a que vale na API. Lista dos nomes dos serviços que podem tirar o militar do expediente. O
 * expediente implícito choca com **qualquer** serviço (op.tipos é ignorado) e some do dia só sob um serviço real da lista que se sobrepõe a ele
 * (ou sob o próprio Adm real do dia). Sem a opção, vale a regra do protótipo.
 */
export function detectarChoques(
  alocs: AlocChoque[],
  horarios: Horarios,
  op?: { mes?: string; tipos?: Record<string, string> | null; tiramDoExpediente?: string[] | null } | null,
): { choques: Choque[]; semHorario: { servico: string; turno: string; qtd: number }[] } {
  const o = op || {};
  const porMat: Record<string, Intervalo[]> = Object.create(null);
  const sem: Record<string, number> = Object.create(null);
  alocs.forEach((a) => {
    const k = `${a.servico}|${a.turno}`;
    const h = horarios[k];
    if (!h) {
      sem[k] = (sem[k] || 0) + 1;
      return;
    }
    const ini = numeroDoDia(a.dia) * 1440 + h.ini;
    if (!porMat[a.mat]) porMat[a.mat] = [];
    porMat[a.mat].push({
      dia: a.dia, turno: a.turno, servico: a.servico, chave: chaveAloc(a) + (a.implicito ? '|expediente' : ''), ini, fim: ini + h.dur, implicito: !!a.implicito,
    });
  });

  // o expediente implícito de um dia some se o militar tem Adm de verdade nesse dia ou um serviço que tira do expediente no mesmo horário
  // (regra nova: os da lista `tiramDoExpediente`; regra do protótipo: o Saldo, pelo nome)
  const substituem = o.tiramDoExpediente ? o.tiramDoExpediente.map(normalizar) : SUBSTITUEM_EXPEDIENTE;
  const universal = !!o.tiramDoExpediente;
  Object.keys(porMat).forEach((mat) => {
    const reais = porMat[mat].filter((x) => !x.implicito);
    porMat[mat] = porMat[mat].filter((x) => {
      if (!x.implicito) return true;
      return !reais.some((r) => {
        if (r.dia === x.dia && r.servico === x.servico) return true;
        return substituem.indexOf(normalizar(r.servico)) >= 0 && r.ini < x.fim && x.ini < r.fim;
      });
    });
  });

  const choques: Choque[] = [];
  Object.keys(porMat).sort().forEach((mat) => {
    const l = porMat[mat].sort((x, y) => x.ini - y.ini || x.fim - y.fim);
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length && l[j].ini < l[i].fim; j++) {
        const x = l[i];
        const y = l[j];
        if (o.mes && x.dia.slice(0, 7) !== o.mes && y.dia.slice(0, 7) !== o.mes) continue;
        if (x.implicito && y.implicito) continue;
        if (!universal && !expedienteChocaCom(x, y, o.tipos)) continue;
        choques.push({
          mat,
          tipo: x.implicito || y.implicito ? 'expediente' : x.chave === y.chave ? 'duplicata' : 'sobreposicao',
          a: lado(x, x.implicito),
          b: lado(y, y.implicito),
          minutos: Math.min(x.fim, y.fim) - y.ini,
        });
      }
      // emenda proibida: o fim de uma alocação encosta no início da outra
      for (let j = i + 1; j < l.length && l[j].ini <= l[i].fim; j++) {
        const x = l[i];
        const y = l[j];
        if (y.ini !== x.fim) continue;
        if (normalizar(x.servico) !== EMENDA_PROIBIDA.de || normalizar(y.servico) !== EMENDA_PROIBIDA.para) continue;
        if (o.mes && x.dia.slice(0, 7) !== o.mes && y.dia.slice(0, 7) !== o.mes) continue;
        choques.push({ mat, tipo: 'emenda', a: lado(x, false), b: lado(y, false), minutos: 0 });
      }
    }
  });

  const semHorario = Object.keys(sem).sort().map((k) => {
    const p = k.split('|');
    return { servico: p[0], turno: p[1], qtd: sem[k] };
  });
  return { choques, semHorario };
}

/**
 * O par (x, y) conta como choque do expediente implícito? Só quando o outro lado é Diária
 * (RN-25, RN-17). Par sem expediente implícito, ou sem a lista de tipos: sempre conta.
 */
export function expedienteChocaCom(
  x: { servico: string; implicito?: boolean },
  y: { servico: string; implicito?: boolean },
  tipos?: Record<string, string> | null,
): boolean {
  if (!x.implicito && !y.implicito) return true;
  if (!tipos) return true;
  const real = x.implicito ? y : x;
  return normalizar(tipos[real.servico] || '') === normalizar('Diária');
}

/** Expediente implícito do Adm: uma alocação do serviço Adm em cada dia útil, para cada militar. */
export function expedienteImplicito(op: { mats: string[]; dias: string[]; servico: string; turno: string }) {
  const lista: { mat: string; dia: string; turno: string; servico: string; implicito: true }[] = [];
  op.mats.forEach((mat) => {
    op.dias.forEach((dia) => lista.push({ mat, dia, turno: op.turno, servico: op.servico, implicito: true }));
  });
  return lista;
}

export interface InclusaoSincronia { chave: string; mat: string; dia: string; turno: string; servico: string; troca?: string; [campo: string]: unknown }
export interface BloqueioPorChoque {
  chave: string;
  mat: string;
  dia: string;
  servico: string;
  turno: string;
  tipo: 'alteracao' | 'inclusao';
  de: { servico: string; turno: string } | null;
  para: { servico: string; turno: string };
  com: { dia: string; turno: string; servico: string; minutos: number; tipo: string; implicito: boolean }[];
  [campo: string]: unknown;
}

/**
 * Simula a tabela depois de aplicar as mudanças e bloqueia as inclusões (e trocas) que criariam
 * um choque de horário (porte de bloquearPorChoque_, de sincronia.js). Choques que já existiam
 * entre alocações não mexidas não bloqueiam nada. Duas mudanças que colidem entre si são as duas
 * bloqueadas; numa troca bloqueada, a linha antiga fica como está. Altera res.
 * todas: todas as linhas da tabela, de todos os meses.
 */
export function bloquearPorChoque(
  res: { inserir: InclusaoSincronia[]; remover: { chave: string; linhas: unknown[] }[]; choques: BloqueioPorChoque[]; aplicadas: string[] },
  todas: { mat: string; dia: string; turno: string; servico: string; linha?: unknown; implicito?: boolean }[],
  horarios: Horarios,
  tipos?: Record<string, string> | null,
): void {
  const mudadas: Record<string, boolean> = Object.create(null);
  res.inserir.forEach((i) => {
    mudadas[i.chave] = true;
  });
  const mats: Record<string, boolean> = Object.create(null);
  Object.keys(mudadas).forEach((k) => {
    mats[partesDaChave(k).mat] = true;
  });
  if (Object.keys(mudadas).length === 0) return;

  const removidas: Record<string, boolean> = Object.create(null);
  res.remover.forEach((r) => r.linhas.forEach((l) => {
    removidas[String(l)] = true;
  }));

  const estado: AlocChoque[] = [];
  todas.forEach((a) => {
    if (!mats[a.mat] || removidas[String(a.linha)]) return;
    estado.push({ mat: a.mat, dia: a.dia, turno: a.turno, servico: a.servico, implicito: !!a.implicito });
  });
  res.inserir.forEach((i) => estado.push({ mat: i.mat, dia: i.dia, turno: i.turno, servico: i.servico }));

  const bloqueadas: Record<string, BloqueioPorChoque['com']> = Object.create(null);
  detectarChoques(estado, horarios, { tipos }).choques.forEach((c) => {
    [[c.a, c.b], [c.b, c.a]].forEach(([eu, outro]) => {
      if (!mudadas[eu.chave]) return;
      if (!bloqueadas[eu.chave]) bloqueadas[eu.chave] = [];
      bloqueadas[eu.chave].push({ dia: outro.dia, turno: outro.turno, servico: outro.servico, minutos: c.minutos, tipo: c.tipo, implicito: !!outro.implicito });
    });
  });
  if (Object.keys(bloqueadas).length === 0) return;

  const antigas: Record<string, boolean> = Object.create(null);
  res.inserir = res.inserir.filter((i) => {
    if (!bloqueadas[i.chave]) return true;
    const p = partesDaChave(i.chave);
    const de = i.troca ? { servico: partesDaChave(i.troca).servico, turno: partesDaChave(i.troca).turno } : null;
    if (i.troca) antigas[i.troca] = true;
    res.choques.push({
      chave: i.chave, mat: p.mat, dia: p.dia, servico: p.servico, turno: p.turno, tipo: i.troca ? 'alteracao' : 'inclusao', de, para: { servico: p.servico, turno: p.turno }, com: bloqueadas[i.chave],
    });
    return false;
  });
  res.remover = res.remover.filter((r) => !antigas[r.chave]);
  res.aplicadas = res.aplicadas.filter((k) => !bloqueadas[k] && !antigas[k]);
  res.choques.sort((x, y) => (x.chave < y.chave ? -1 : 1));
}
