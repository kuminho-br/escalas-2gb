import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Cota, DiaDaCota, EdicaoCota, NovaCota, ResultadoDaCopiaDeCotas } from 'contratos';
import { pedir } from './cliente';

export const consultaCotas = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['cotas', unidadeId, mes], queryFn: () => pedir<Cota[]>('GET', `/api/unidades/${unidadeId}/cotas?mes=${mes}`) });

export const criarCota = (unidadeId: string, d: NovaCota) => pedir<Cota>('POST', `/api/unidades/${unidadeId}/cotas`, d);
export const editarCota = (id: string, d: EdicaoCota) => pedir<Cota>('PATCH', `/api/cotas/${id}`, d);
/** Trocar os dias da cota (a lista nova substitui a inteira). */
export const trocarDiasDaCota = (id: string, dias: DiaDaCota[]) => pedir<Cota>('PUT', `/api/cotas/${id}/dias`, { dias });
export const removerCota = (id: string) => pedir<null>('DELETE', `/api/cotas/${id}`);
export const copiarCotas = (unidadeId: string, de: string, para: string) =>
  pedir<ResultadoDaCopiaDeCotas>('POST', `/api/unidades/${unidadeId}/cotas/copiar`, { de, para });

/** Depois de gravar (ou importar): a lista do mês volta a buscar. */
export function atualizarCotas(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['cotas'] });
}
