import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EdicaoEscala, Escala, LinhaEscala, VinculosDaEscala } from 'contratos';
import { pedir } from './cliente';

export const consultaEscalas = (unidadeId: string) =>
  queryOptions({ queryKey: ['escalas', unidadeId], queryFn: () => pedir<LinhaEscala[]>('GET', `/api/unidades/${unidadeId}/escalas`) });
export const consultaEscala = (id: string) => queryOptions({ queryKey: ['escala', id], queryFn: () => pedir<Escala>('GET', `/api/escalas/${id}`) });

export const criarEscala = (unidadeId: string, nome: string) => pedir<Escala>('POST', `/api/unidades/${unidadeId}/escalas`, { nome });
export const editarEscala = (id: string, d: EdicaoEscala) => pedir<Escala>('PATCH', `/api/escalas/${id}`, d);
export const mudarSituacaoEscala = (id: string, ativa: boolean) => pedir<Escala>('POST', `/api/escalas/${id}/situacao`, { ativa });
export const salvarServicosDaEscala = (id: string, servicoIds: string[]) => pedir<Escala>('PUT', `/api/escalas/${id}/servicos`, { servicoIds });
export const salvarVinculos = (id: string, mes: string, d: VinculosDaEscala) => pedir<Escala>('PUT', `/api/escalas/${id}/vinculos/${mes}`, d);

export function atualizarEscalas(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['escalas'] });
  void queryClient.invalidateQueries({ queryKey: ['escala'] });
}
