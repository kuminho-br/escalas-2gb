import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EdicaoGuarnicao, FichaGuarnicao, Funcao, LinhaGuarnicao, NovaGuarnicao, VersaoGuarnicao } from 'contratos';
import { pedir } from './cliente';

export const consultaGuarnicoes = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['guarnicoes', unidadeId, mes], queryFn: () => pedir<LinhaGuarnicao[]>('GET', `/api/unidades/${unidadeId}/guarnicoes?mes=${mes}`) });

export const consultaGuarnicao = (id: string) => queryOptions({ queryKey: ['guarnicao', id], queryFn: () => pedir<FichaGuarnicao>('GET', `/api/guarnicoes/${id}`) });

export const consultaFuncoes = (unidadeId: string) =>
  queryOptions({ queryKey: ['funcoes', unidadeId], queryFn: () => pedir<Funcao[]>('GET', `/api/unidades/${unidadeId}/funcoes`), staleTime: 300_000 });

export const criarGuarnicao = (unidadeId: string, d: NovaGuarnicao) => pedir<FichaGuarnicao>('POST', `/api/unidades/${unidadeId}/guarnicoes`, d);
export const editarGuarnicao = (id: string, d: EdicaoGuarnicao) => pedir<FichaGuarnicao>('PATCH', `/api/guarnicoes/${id}`, d);
export const salvarVersao = (id: string, mes: string, v: VersaoGuarnicao) => pedir<FichaGuarnicao>('PUT', `/api/guarnicoes/${id}/versoes/${mes}`, v);
export const criarFuncao = (unidadeId: string, nome: string) => pedir<Funcao>('POST', `/api/unidades/${unidadeId}/funcoes`, { nome });

/** Depois de gravar: lista, funções (a importação cria) e fichas abertas voltam a buscar. */
export function atualizarGuarnicoes(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: ['guarnicoes'] });
  void queryClient.invalidateQueries({ queryKey: ['funcoes'] });
  void queryClient.invalidateQueries({ queryKey: id ? ['guarnicao', id] : ['guarnicao'] });
}
