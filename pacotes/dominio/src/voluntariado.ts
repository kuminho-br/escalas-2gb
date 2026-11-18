// Turno do serviço × turno padrão do voluntariado (adendo do design, 17/11/2026): vale o horário.
// O militar precisa ter marcado todo turno padrão que o turno do serviço toca
// (A = 08h às 20h; B = 20h às 08h). Regra só do sistema novo.
import { minutosDoDia } from './choques.ts';

/** Turno padrão, com o dia relativo ao dia em que o turno do serviço começa. */
export type TurnoPadrao = { dia: -1 | 0 | 1; turno: 'A' | 'B' };

// janelas em minutos a partir das 00h do dia em que o turno começa
const JANELAS: { ini: number; fim: number; padrao: TurnoPadrao }[] = [
  { ini: -240, fim: 480, padrao: { dia: -1, turno: 'B' } },
  { ini: 480, fim: 1200, padrao: { dia: 0, turno: 'A' } },
  { ini: 1200, fim: 1920, padrao: { dia: 0, turno: 'B' } },
  { ini: 1920, fim: 2640, padrao: { dia: 1, turno: 'A' } },
];

function minutos(texto: string): number {
  const m = minutosDoDia(texto);
  if (m === null) throw new Error(`Horário inválido: "${texto}".`);
  return m;
}

/** Duração em minutos; fim menor que o início atravessa a meia-noite, e igual dá 24h. */
export function duracaoMinutos(inicio: string, fim: string): number {
  const i = minutos(inicio);
  const f = minutos(fim);
  return f > i ? f - i : f + 1440 - i;
}

/** Os turnos padrão que o turno do serviço toca, em ordem cronológica. */
export function turnosPadraoExigidos(inicio: string, fim: string): TurnoPadrao[] {
  const i = minutos(inicio);
  const f = i + duracaoMinutos(inicio, fim);
  return JANELAS.filter((j) => Math.min(f, j.fim) - Math.max(i, j.ini) > 0).map((j) => ({ ...j.padrao }));
}

/** '8:00' -> '08:00', '24:00' -> '00:00'; null se ilegível. */
export function normalizarHora(texto: string): string | null {
  const m = minutosDoDia(texto);
  if (m === null) return null;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
