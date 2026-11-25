import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { FaixaDeDisponibilidade, MeuVoluntariado } from 'contratos';
import { pedir } from './cliente';

/** O voluntariado da própria conta no mês: as marcações, os blocos da seção dela e se a coleta está aberta (7.1). */
export const consultaMeuVoluntariado = (mes: string) =>
  queryOptions({ queryKey: ['meu-voluntariado', mes], queryFn: () => pedir<MeuVoluntariado>('GET', `/api/eu/voluntariado/${mes}`) });

/** O militar marca o próprio mês (substitui o que havia). A API devolve o mês como ele ficou, que entra no lugar do que estava. */
export async function salvarMeuVoluntariado(queryClient: QueryClient, mes: string, faixas: FaixaDeDisponibilidade[]): Promise<MeuVoluntariado> {
  try {
    const novo = await pedir<MeuVoluntariado>('PUT', `/api/eu/voluntariado/${mes}`, { faixas });
    queryClient.setQueryData(['meu-voluntariado', mes], novo);
    return novo;
  } catch (e) {
    // a coleta pode ter fechado enquanto a pessoa marcava: a tela busca o estado de novo
    void queryClient.invalidateQueries({ queryKey: ['meu-voluntariado', mes] });
    throw e;
  }
}
