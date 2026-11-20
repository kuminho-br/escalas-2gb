import type { Cota, CotaRestante } from 'contratos';

/**
 * As cotas do mês somadas por serviço (a interna e a externa viram uma só), na ordem em que vêm (a de prioridade).
 * Com `servicoIds`, só os serviços dados (a Escala do mês mostra as cotas dos serviços dela).
 */
export function restantesPorServico(cotas: Cota[], servicoIds?: string[]): CotaRestante[] {
  const porServico = new Map<string, CotaRestante>();
  for (const c of cotas) {
    if (servicoIds && !servicoIds.includes(c.servicoId)) continue;
    const atual = porServico.get(c.servicoId) ?? { servicoId: c.servicoId, servico: c.servico, cor: c.cor, quantidade: 0, usadas: 0 };
    atual.quantidade += c.quantidade;
    atual.usadas += c.distribuidas;
    porServico.set(c.servicoId, atual);
  }
  return [...porServico.values()];
}
