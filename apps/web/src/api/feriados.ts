import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EdicaoFeriado, Feriado, NovoFeriado, ResultadoDaCopia } from 'contratos';
import { pedir } from './cliente';

export const consultaFeriados = (unidadeId: string, ano: number) =>
  queryOptions({ queryKey: ['feriados', unidadeId, ano], queryFn: () => pedir<Feriado[]>('GET', `/api/unidades/${unidadeId}/feriados?ano=${ano}`) });

export const criarFeriado = (unidadeId: string, d: NovoFeriado) => pedir<Feriado>('POST', `/api/unidades/${unidadeId}/feriados`, d);
export const editarFeriado = (id: string, d: EdicaoFeriado) => pedir<Feriado>('PATCH', `/api/feriados/${id}`, d);
export const removerFeriado = (id: string) => pedir<null>('DELETE', `/api/feriados/${id}`);
export const copiarFeriadosFixos = (unidadeId: string, de: number, para: number) =>
  pedir<ResultadoDaCopia>('POST', `/api/unidades/${unidadeId}/feriados/copiar-fixos`, { de, para });

/** Depois de gravar (ou importar): a lista do ano volta a buscar. */
export function atualizarFeriados(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['feriados'] });
}
