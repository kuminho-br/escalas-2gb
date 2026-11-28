// A conferência da cota de um serviço PJES ou diária num mês (6.72). Função pura: quem chama conta os escalados (a API, em `escalar` e em `opcoesDoDia`).

export interface DiaDaCotaRegra { data: string; minimo: number; maximo: number | null }

export type RecusaDaCota = 'esgotada' | 'maximo_do_dia' | 'reservada';

/**
 * Cabe mais um militar neste serviço neste dia? Devolve a razão da recusa ou null.
 * - `esgotada`: o mês já tem a quantidade da cota (vem primeiro; vale também quando a cota foi reduzida abaixo do que já estava escalado);
 * - `maximo_do_dia`: o dia tem máximo e já o atingiu;
 * - `reservada`: o que resta da cota está reservado para as metas dos outros dias: Σ max(0, mínimo − escalados) dos dias com meta diferentes de `data`
 *   (a meta já cumprida não reserva, e o próprio dia pedido não reserva para si).
 * Sem dias, só o total vale.
 */
export function conferirCota(d: {
  quantidade: number;
  dias: DiaDaCotaRegra[];
  escaladosNoMes: number;
  escaladosPorDia: Record<string, number>;
  data: string;
}): RecusaDaCota | null {
  if (d.escaladosNoMes >= d.quantidade) return 'esgotada';
  const doDia = d.dias.find((x) => x.data === d.data);
  if (doDia?.maximo != null && (d.escaladosPorDia[d.data] ?? 0) >= doDia.maximo) return 'maximo_do_dia';
  const reservado = d.dias.filter((x) => x.data !== d.data).reduce((soma, x) => soma + Math.max(0, x.minimo - (d.escaladosPorDia[x.data] ?? 0)), 0);
  if (d.escaladosNoMes + reservado >= d.quantidade) return 'reservada';
  return null;
}
