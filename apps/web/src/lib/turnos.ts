import type { TurnoPadrao } from 'contratos';

const NOME_DO_PADRAO = (t: TurnoPadrao) => (t.dia === -1 ? `${t.turno} da noite anterior` : t.dia === 1 ? `${t.turno} do dia seguinte` : t.turno);

/** [{0,A},{0,B}] -> 'A e B'; [{-1,B}] -> 'B da noite anterior'; [{0,B},{1,A}] -> 'B e A do dia seguinte'. */
export function descreverTurnosPadrao(t: TurnoPadrao[]): string {
  const nomes = t.map(NOME_DO_PADRAO);
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/** 720 -> '12h', 510 -> '8h30'. */
export function textoDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export const ORDEM_LETRAS = ['A', 'B', 'C', 'U'] as const;
