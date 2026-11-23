import { queryOptions } from '@tanstack/react-query';
import type { EdicaoDaSituacaoDoMilitar, ItemCatalogo, NovaSituacaoDoMilitar, NovoParametro, Parametro, SituacaoDoMilitar } from 'contratos';
import { pedir } from './cliente';

export type Catalogo = 'tipos-afastamento';

export const consultaParametros = (unidadeId: string, mes: string) =>
  queryOptions({
    queryKey: ['parametros', unidadeId, mes],
    queryFn: () => pedir<Parametro[]>('GET', `/api/unidades/${unidadeId}/parametros?mes=${mes}`),
  });

export const salvarParametro = (unidadeId: string, p: NovoParametro) => pedir('POST', `/api/unidades/${unidadeId}/parametros`, p);

export const consultaCatalogo = (catalogo: Catalogo) =>
  queryOptions({ queryKey: ['catalogo', catalogo], queryFn: () => pedir<ItemCatalogo[]>('GET', `/api/sistema/${catalogo}`) });

export const incluirNoCatalogo = (catalogo: Catalogo, nome: string) => pedir<ItemCatalogo>('POST', `/api/sistema/${catalogo}`, { nome });

export const incluirSituacaoDoMilitar = (d: NovaSituacaoDoMilitar) => pedir<SituacaoDoMilitar>('POST', '/api/situacoes-do-militar', d);
export const editarSituacaoDoMilitar = (id: string, d: EdicaoDaSituacaoDoMilitar) => pedir<SituacaoDoMilitar>('PATCH', `/api/situacoes-do-militar/${id}`, d);

export const editarNoCatalogo = (catalogo: Catalogo, id: string, dados: { nome?: string; ativo?: boolean }) =>
  pedir<ItemCatalogo>('PATCH', `/api/sistema/${catalogo}/${id}`, dados);
