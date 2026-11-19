// Disponibilidade por faixa de horário (adendo de 19/11/2026): o militar marca o que pode em blocos do dia, tirados dos horários
// dos serviços que pedem voluntariado. Minutos do dia, de 0 (00h) a 1440 (24h). Regra só do sistema novo.
import { minutosDoDia } from './choques.ts';
import { duracaoMinutos } from './voluntariado.ts';

/** Um trecho do dia, em minutos: [início, fim). */
export type Faixa = { inicio: number; fim: number };

const DIA = 1440;

function minutos(texto: string): number {
  const m = minutosDoDia(texto);
  if (m === null) throw new Error(`Horário inválido: "${texto}".`);
  return m;
}

/** O dia seguinte a 'aaaa-mm-dd'. */
function diaSeguinte(data: string): string {
  return new Date(new Date(`${data}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

/** Os cortes do dia: início e fim de cada turno, mais 00h e 24h, sem repetir e em ordem. Fim às 00h vale 24h. */
export function cortesDoDia(turnos: { inicio: string; fim: string }[]): number[] {
  const cortes = new Set([0, DIA]);
  for (const t of turnos) {
    cortes.add(minutos(t.inicio));
    const fim = minutos(t.fim);
    cortes.add(fim === 0 ? DIA : fim);
  }
  return [...cortes].sort((a, b) => a - b);
}

/** Os blocos do dia: os intervalos entre cortes vizinhos. */
export function blocosDoDia(cortes: number[]): Faixa[] {
  return cortes.slice(0, -1).map((inicio, i) => ({ inicio, fim: cortes[i + 1]! }));
}

/** As faixas em ordem, unindo as encostadas e as sobrepostas. Não altera a entrada. */
export function unirFaixas(faixas: Faixa[]): Faixa[] {
  const unidas: Faixa[] = [];
  for (const f of [...faixas].sort((a, b) => a.inicio - b.inicio || a.fim - b.fim)) {
    const ultima = unidas[unidas.length - 1];
    if (ultima && f.inicio <= ultima.fim) ultima.fim = Math.max(ultima.fim, f.fim);
    else unidas.push({ ...f });
  }
  return unidas;
}

const cobre = (faixas: Faixa[], inicio: number, fim: number) => unirFaixas(faixas).some((f) => f.inicio <= inicio && f.fim >= fim);

/**
 * O turno de serviço, que começa em `data`, cabe na disponibilidade? Toda a duração precisa estar coberta; o que passa da meia-noite
 * usa o dia seguinte (o turno pertence ao dia em que começa). `faixasDoDia` devolve as faixas marcadas num dia.
 */
export function turnoCoberto(faixasDoDia: (data: string) => Faixa[], data: string, inicio: string, fim: string): boolean {
  const i = minutos(inicio);
  const f = i + duracaoMinutos(inicio, fim);
  if (!cobre(faixasDoDia(data), i, Math.min(f, DIA))) return false;
  return f <= DIA || cobre(faixasDoDia(diaSeguinte(data)), 0, f - DIA);
}
