/**
 * O texto de um item bate com o que a pessoa digitou? Sem acento e sem caixa; e uma busca só de dígitos e hífen vale também como matrícula, com ou sem o
 * hífen ("9900011" acha "990001-1").
 */
export function correspondeABusca(item: string, busca: string): boolean {
  const b = normalizarBusca(busca);
  if (!b) return true;
  if (normalizarBusca(item).includes(b)) return true;
  const digitos = b.replace(/\D/g, '');
  return /^[\d.\-\s]+$/.test(b) && digitos !== '' && item.replace(/\D/g, '').includes(digitos);
}

/** Para buscar sem acento e sem caixa. */
export function normalizarBusca(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
