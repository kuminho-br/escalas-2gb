import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { AlteracaoDeSituacao, EdicaoAfastamento, EdicaoMilitar, Equipe, FichaMilitar, LinhaMilitar, NovoAfastamento, NovoMilitar, Posto } from 'contratos';
import { pedir } from './cliente';

export const consultaMilitares = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['militares', unidadeId, mes], queryFn: () => pedir<LinhaMilitar[]>('GET', `/api/unidades/${unidadeId}/militares?mes=${mes}`) });

export const consultaFicha = (id: string) => queryOptions({ queryKey: ['militar', id], queryFn: () => pedir<FichaMilitar>('GET', `/api/militares/${id}`) });

export const consultaEquipes = (unidadeId: string) =>
  queryOptions({ queryKey: ['equipes', unidadeId], queryFn: () => pedir<Equipe[]>('GET', `/api/unidades/${unidadeId}/equipes`), staleTime: 300_000 });

export const consultaPostos = queryOptions({ queryKey: ['postos'], queryFn: () => pedir<Posto[]>('GET', '/api/postos'), staleTime: Infinity });

export const criarMilitar = (unidadeId: string, d: NovoMilitar) => pedir<FichaMilitar>('POST', `/api/unidades/${unidadeId}/militares`, d);
export const editarMilitar = (id: string, d: EdicaoMilitar) => pedir<FichaMilitar>('PATCH', `/api/militares/${id}`, d);
export const alterarSituacao = (id: string, d: AlteracaoDeSituacao) => pedir<FichaMilitar>('POST', `/api/militares/${id}/situacao`, d);
export const criarAfastamento = (militarId: string, d: NovoAfastamento) => pedir('POST', `/api/militares/${militarId}/afastamentos`, d);
export const editarAfastamento = (id: string, d: EdicaoAfastamento) => pedir('PATCH', `/api/afastamentos/${id}`, d);
export const apagarAfastamento = (id: string) => pedir('DELETE', `/api/afastamentos/${id}`);

/** Depois de gravar: lista, equipes (a importação cria) e fichas voltam a buscar. */
export function atualizarMilitares(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: ['militares'] });
  void queryClient.invalidateQueries({ queryKey: ['equipes'] });
  void queryClient.invalidateQueries({ queryKey: id ? ['militar', id] : ['militar'] });
}
