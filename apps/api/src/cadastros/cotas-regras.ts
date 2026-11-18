// Regras puras das cotas (sem banco).

/**
 * Reparte a contagem de alocações de cada serviço entre as cotas dele, na ordem recebida (a de prioridade):
 * cada cota recebe até a própria quantidade, e o que passa da soma fica na última, para a tela mostrar o estouro.
 */
export function distribuidasPorCota(
  cotas: { id: string; servicoId: string; quantidade: number }[],
  totais: Map<string, number>,
): Map<string, number> {
  const restante = new Map(totais);
  const ultima = new Map<string, string>();
  for (const c of cotas) ultima.set(c.servicoId, c.id);
  const resultado = new Map<string, number>();
  for (const c of cotas) {
    const sobra = restante.get(c.servicoId) ?? 0;
    const parte = c.id === ultima.get(c.servicoId) ? sobra : Math.min(c.quantidade, sobra);
    resultado.set(c.id, parte);
    restante.set(c.servicoId, sobra - parte);
  }
  return resultado;
}
