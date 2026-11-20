import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { OrdemDeEscalacao, VagaDaOrdem } from 'contratos';
import { pedir } from './cliente';

export const consultaOrdemDeEscalacao = (escalaId: string, mes: string) =>
  queryOptions({ queryKey: ['ordem-de-escalacao', escalaId, mes], queryFn: () => pedir<OrdemDeEscalacao>('GET', `/api/escalas/${escalaId}/ordem/${mes}`) });

/** Grava a ordem a partir do mês. A devolvida entra no lugar da que estava; os outros meses voltam a buscar (a vigência deles pode ter mudado) e os cards da escala do mês seguem a ordem nova. */
export async function gravarOrdemDeEscalacao(queryClient: QueryClient, escalaId: string, mes: string, itens: VagaDaOrdem[]): Promise<OrdemDeEscalacao> {
  const nova = await pedir<OrdemDeEscalacao>('PUT', `/api/escalas/${escalaId}/ordem/${mes}`, { itens });
  queryClient.setQueryData(['ordem-de-escalacao', escalaId, mes], nova);
  void queryClient.invalidateQueries({ queryKey: ['ordem-de-escalacao', escalaId], predicate: (q) => q.queryKey[2] !== mes });
  void queryClient.invalidateQueries({ queryKey: ['escala-do-mes', escalaId] });
  return nova;
}

/** A composição ou os vínculos mudaram: as vagas da ordem de qualquer mês podem ter mudado. */
export function atualizarOrdemDeEscalacao(queryClient: QueryClient, escalaId: string) {
  void queryClient.invalidateQueries({ queryKey: ['ordem-de-escalacao', escalaId] });
}
