import type { LinhaGuarnicao } from 'contratos';

/** "de 2 a 4 militares", "3 militares" ou "sem composição". */
export function limites(g: Pick<LinhaGuarnicao, 'minimo' | 'maximo'>): string {
  if (g.maximo === 0) return 'sem composição';
  return g.minimo === g.maximo ? `${g.minimo} militares` : `de ${g.minimo} a ${g.maximo} militares`;
}
