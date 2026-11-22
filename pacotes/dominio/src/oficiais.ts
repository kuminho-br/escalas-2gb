// Escala dos oficiais (QOC e QOA): turnos de 12 h, cota proporcional à presença e saldo mês a mês.
// Funções puras. Datas 'aaaa-mm-dd' e mês 'aaaa-mm', como no resto do motor.
import { diasDoMes } from './nucleo.ts';

/** "Dia" se o turno começa entre 05:00 e 17:59; senão, "Noite". `inicio` no formato HH:MM (ou HH:MM:SS). */
export function rotuloDoTurno(inicio: string): 'Dia' | 'Noite' {
  const minutos = Number(inicio.slice(0, 2)) * 60 + Number(inicio.slice(3, 5));
  return minutos >= 5 * 60 && minutos < 18 * 60 ? 'Dia' : 'Noite';
}

export interface OficialParaOrdem {
  militarId: string;
  postoOrdem: number;
  antiguidade: number | null;
  nomeGuerra: string;
}

/** Posto mais alto primeiro; no mesmo posto, antiguidade crescente; os sem antiguidade depois, na ordem manual e, fora dela, pelo nome de guerra. */
export function ordemDeEscolha(oficiais: OficialParaOrdem[], ordemManual: string[]): string[] {
  const posManual = new Map(ordemManual.map((id, i) => [id, i] as const));
  return [...oficiais]
    .sort((a, b) => {
      if (a.postoOrdem !== b.postoOrdem) return a.postoOrdem - b.postoOrdem;
      if (a.antiguidade !== null && b.antiguidade !== null) return a.antiguidade - b.antiguidade;
      if (a.antiguidade !== null) return -1;
      if (b.antiguidade !== null) return 1;
      const ma = posManual.get(a.militarId);
      const mb = posManual.get(b.militarId);
      if (ma !== undefined && mb !== undefined) return ma - mb;
      if (ma !== undefined) return -1;
      if (mb !== undefined) return 1;
      return a.nomeGuerra.localeCompare(b.nomeGuerra, 'pt');
    })
    .map((o) => o.militarId);
}

/** Dias do mês (AAAA-MM) cobertos por algum período e fora de todo afastamento. `ate` null = em aberto. */
export function diasPresentes(
  mes: string,
  periodos: { desde: string; ate: string | null }[],
  afastamentos: { inicio: string; fim: string }[],
): number {
  let n = 0;
  for (const dia of diasDoMes(mes)) {
    const noPeriodo = periodos.some((p) => p.desde <= dia && (p.ate === null || dia <= p.ate));
    if (noPeriodo && !afastamentos.some((a) => a.inicio <= dia && dia <= a.fim)) n++;
  }
  return n;
}

export interface CotaDeOficial {
  militarId: string;
  dias: number;
  devido: number;
  cota: number;
  sobra: boolean;
}

/** `participantes` na ordem de escolha. Devido = turnos × dias ÷ soma dos dias; cota = piso; a sobra, um a um, do mais moderno com dias > 0 para cima. */
export function calcularCotas(turnos: number, participantes: { militarId: string; dias: number }[]): CotaDeOficial[] {
  const soma = participantes.reduce((s, p) => s + p.dias, 0);
  const r: CotaDeOficial[] = participantes.map((p) => ({
    militarId: p.militarId,
    dias: p.dias,
    devido: soma > 0 ? (turnos * p.dias) / soma : 0,
    cota: soma > 0 ? Math.floor((turnos * p.dias) / soma) : 0,
    sobra: false,
  }));
  let resto = soma > 0 ? turnos - r.reduce((s, x) => s + x.cota, 0) : 0;
  const elegiveis = r.filter((x) => x.dias > 0).reverse();
  for (let i = 0; resto > 0 && elegiveis.length > 0; i++, resto--) {
    const x = elegiveis[i % elegiveis.length];
    x.cota++;
    x.sobra = true;
  }
  return r;
}

export interface TurnoDoMes {
  dia: string;
  turnoId: string;
  militarId: string | null;
  saiuMilitarId: string | null;
}

export interface SaldoDoMes {
  militarId: string;
  tirado: number;
  devido: number;
  valor: number;
  /** Quantos turnos de cada `turnoId` o militar tirou (só os em que está). */
  porTurno: Record<string, number>;
}

/** Tirados = turnos com nome. Devido = tirados × dias ÷ soma dos dias (dias da cota gravada). Tirado de cada um = os turnos em que está + os de que saiu (cobertura). */
export function saldoDoMes(turnos: TurnoDoMes[], cotas: { militarId: string; dias: number }[]): SaldoDoMes[] {
  const comNome = turnos.filter((t) => t.militarId !== null).length;
  const soma = cotas.reduce((s, c) => s + c.dias, 0);
  return cotas.map((c) => {
    const nele = turnos.filter((t) => t.militarId === c.militarId);
    const saiu = turnos.filter((t) => t.saiuMilitarId === c.militarId).length;
    const tirado = nele.length + saiu;
    const devido = soma > 0 ? (comNome * c.dias) / soma : 0;
    return {
      militarId: c.militarId,
      tirado,
      devido,
      valor: tirado - devido,
      porTurno: nele.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.turnoId]: (acc[t.turnoId] ?? 0) + 1 }), {}),
    };
  });
}

/** Média exata dos acumulados de quem já tem saldo; lista vazia → 0. */
export function saldoDeEntrada(acumuladosDeQuemJaEsta: number[]): number {
  if (acumuladosDeQuemJaEsta.length === 0) return 0;
  return acumuladosDeQuemJaEsta.reduce((s, v) => s + v, 0) / acumuladosDeQuemJaEsta.length;
}
