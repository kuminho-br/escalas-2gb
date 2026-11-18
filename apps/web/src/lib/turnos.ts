import { minutosDoDia } from 'dominio';

/** 720 -> '12h', 510 -> '8h30'. */
export function textoDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export const ORDEM_LETRAS = ['A', 'B', 'C', 'U'] as const;

type TurnoHora = { letra: string; inicio: string; fim: string };
/** Segmento da régua: minutos a partir das 00h do dia D; `fim` passa de 1440 quando o turno vai ao dia seguinte. */
export type Segmento = { letra: string; ini: number; fim: number };

/** O trecho que o turno ocupa a partir do dia D (sem partir na meia-noite); null se o horário não vale. */
function trecho(t: TurnoHora): [number, number] | null {
  const ini = minutosDoDia(t.inicio);
  const fim = minutosDoDia(t.fim);
  if (ini === null || fim === null) return null;
  return [ini, fim > ini ? fim : fim + 1440];
}

/** Segmentos da régua do dia, em ordem de início. */
export function segmentosDoDia(turnos: TurnoHora[]): Segmento[] {
  return turnos
    .flatMap((t) => {
      const x = trecho(t);
      return x ? [{ letra: t.letra, ini: x[0], fim: x[1] }] : [];
    })
    .sort((a, b) => a.ini - b.ini);
}

/** Onde termina a régua: o fim do último turno, no mínimo 24h (1440). */
export function fimDaRegua(segmentos: Segmento[]): number {
  return Math.max(1440, ...segmentos.map((s) => s.fim));
}

/** Trechos em que dois turnos diferentes ocupam o mesmo horário. Os turnos se repetem a cada dia, então o segundo também é comparado com o dia anterior e o seguinte. Só se encostar não conta. */
export function sobreposicoes(turnos: TurnoHora[]): { letras: [string, string]; ini: number; fim: number }[] {
  const achados: { letras: [string, string]; ini: number; fim: number }[] = [];
  for (let i = 0; i < turnos.length; i++) {
    for (let j = i + 1; j < turnos.length; j++) {
      const a = trecho(turnos[i]!);
      const b = trecho(turnos[j]!);
      if (!a || !b) continue;
      for (const dia of [-1440, 0, 1440]) {
        const ini = Math.max(a[0], b[0] + dia);
        const fim = Math.min(a[1], b[1] + dia);
        if (fim > ini) achados.push({ letras: [turnos[i]!.letra, turnos[j]!.letra], ini, fim });
      }
    }
  }
  return achados.sort((a, b) => a.ini - b.ini);
}

/** 420 -> '07h', 1440 -> '00h'. */
export function textoMinutos(min: number): string {
  const m = min % 1440;
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  return m % 60 ? `${h}h${String(m % 60).padStart(2, '0')}` : `${h}h`;
}
