import { minutosDoDia } from 'dominio';

/** 720 -> '12h', 510 -> '8h30'. */
export function textoDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export const ORDEM_LETRAS = ['A', 'B', 'C', 'U'] as const;

type TurnoHora = { letra: string; inicio: string; fim: string };
export type Segmento = { letra: string; ini: number; fim: number };

/** Trechos do dia (minutos de 0 a 1440) que um turno ocupa: atravessar a meia-noite parte em dois, e 24h é o dia todo. */
function trechos(t: TurnoHora): [number, number][] {
  const ini = minutosDoDia(t.inicio);
  const fim = minutosDoDia(t.fim);
  if (ini === null || fim === null) return [];
  if (fim === ini) return [[0, 1440]];
  if (fim > ini) return [[ini, fim]];
  return fim === 0 ? [[ini, 1440]] : [[0, fim], [ini, 1440]];
}

/** Segmentos da régua do dia, em ordem de início. */
export function segmentosDoDia(turnos: TurnoHora[]): Segmento[] {
  return turnos.flatMap((t) => trechos(t).map(([ini, fim]) => ({ letra: t.letra, ini, fim }))).sort((a, b) => a.ini - b.ini);
}

/** Trechos em que dois turnos diferentes ocupam o mesmo horário (só se encostar não conta). */
export function sobreposicoes(turnos: TurnoHora[]): { letras: [string, string]; ini: number; fim: number }[] {
  const achados: { letras: [string, string]; ini: number; fim: number }[] = [];
  for (let i = 0; i < turnos.length; i++) {
    for (let j = i + 1; j < turnos.length; j++) {
      for (const [a0, a1] of trechos(turnos[i]!)) {
        for (const [b0, b1] of trechos(turnos[j]!)) {
          const ini = Math.max(a0, b0);
          const fim = Math.min(a1, b1);
          if (fim > ini) achados.push({ letras: [turnos[i]!.letra, turnos[j]!.letra], ini, fim });
        }
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
