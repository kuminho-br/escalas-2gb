// Os números do saldo na tela: duas casas, vírgula e, no saldo, o sinal sempre visível (o de menos é o U+2212).

const arredondar = (v: number) => Math.round(Math.abs(v) * 100) / 100;
const texto = (v: number) => v.toFixed(2).replace('.', ',');

/** +0,75 · −0,25 · 0,00 */
export function formatarSaldo(v: number): string {
  const n = arredondar(v);
  if (n === 0) return '0,00';
  return `${v > 0 ? '+' : '−'}${texto(n)}`;
}

/** 8,25 */
export function formatarDevido(v: number): string {
  return texto(arredondar(v));
}
