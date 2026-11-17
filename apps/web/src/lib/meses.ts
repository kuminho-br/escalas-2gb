/** Mês corrente no relógio do navegador, 'aaaa-mm'. */
export function mesAtual(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}
