/** Para buscar sem acento e sem caixa. */
export function normalizarBusca(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
