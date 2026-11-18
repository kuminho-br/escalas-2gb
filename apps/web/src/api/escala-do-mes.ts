import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EscalaDoMes } from 'contratos';
import { pedir } from './cliente';

export const consultaEscalaDoMes = (escalaId: string, mes: string) =>
  queryOptions({ queryKey: ['escala-do-mes', escalaId, mes], queryFn: () => pedir<EscalaDoMes>('GET', `/api/escalas/${escalaId}/mes/${mes}`) });

/** Depois de escalar, remover ou desfazer: a API devolve a escala do mês inteira, e ela entra no lugar da que estava. */
export function atualizarEscalaDoMes(queryClient: QueryClient, escalaId: string, mes: string, dados: EscalaDoMes) {
  queryClient.setQueryData(['escala-do-mes', escalaId, mes], dados);
}
