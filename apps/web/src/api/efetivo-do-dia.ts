import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EfetivoDoDia, MetaDoDia, NovaMetaDoDia, NovaMetaPadrao, VersaoDaMetaPadrao } from 'contratos';
import { pedir } from './cliente';

export const consultaEfetivoDoDia = (unidadeId: string, data: string) =>
  queryOptions({ queryKey: ['efetivo-do-dia', unidadeId, data], queryFn: () => pedir<EfetivoDoDia>('GET', `/api/unidades/${unidadeId}/efetivo-do-dia/${data}`) });

/** As versões da meta padrão, da mais nova para a mais antiga. */
export const consultaMetaPadrao = (unidadeId: string) =>
  queryOptions({ queryKey: ['meta-padrao', unidadeId], queryFn: () => pedir<VersaoDaMetaPadrao[]>('GET', `/api/unidades/${unidadeId}/meta-padrao`) });

/** Mexer na meta muda o painel de vários dias: o efetivo e a meta padrão voltam a ser buscados. */
function atualizar(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['efetivo-do-dia'] });
  void queryClient.invalidateQueries({ queryKey: ['meta-padrao'] });
}

async function gravando<T>(queryClient: QueryClient, pedido: Promise<T>): Promise<T> {
  try {
    return await pedido;
  } finally {
    atualizar(queryClient);
  }
}

export const gravarMetaPadrao = (queryClient: QueryClient, unidadeId: string, d: NovaMetaPadrao) =>
  gravando(queryClient, pedir<VersaoDaMetaPadrao[]>('PUT', `/api/unidades/${unidadeId}/meta-padrao`, d));
export const gravarMetaDoDia = (queryClient: QueryClient, unidadeId: string, data: string, d: NovaMetaDoDia) =>
  gravando(queryClient, pedir<MetaDoDia>('PUT', `/api/unidades/${unidadeId}/meta-do-dia/${data}`, d));
export const voltarMetaAoPadrao = (queryClient: QueryClient, unidadeId: string, data: string) =>
  gravando(queryClient, pedir<MetaDoDia>('DELETE', `/api/unidades/${unidadeId}/meta-do-dia/${data}`));
