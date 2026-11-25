import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { DesfazerDesativacao, EfetivoDoDia, MetaDoDia, NovaMetaPadrao, ResultadoDaDesativacao, VersaoDaMetaPadrao } from 'contratos';
import { pedir } from './cliente';

export const consultaEfetivoDoDia = (unidadeId: string, data: string) =>
  queryOptions({ queryKey: ['efetivo-do-dia', unidadeId, data], queryFn: () => pedir<EfetivoDoDia>('GET', `/api/unidades/${unidadeId}/efetivo-do-dia/${data}`) });

/** As versões da meta padrão, da mais nova para a mais antiga. */
export const consultaMetaPadrao = (unidadeId: string) =>
  queryOptions({ queryKey: ['meta-padrao', unidadeId], queryFn: () => pedir<VersaoDaMetaPadrao[]>('GET', `/api/unidades/${unidadeId}/meta-padrao`) });

/**
 * Mexer na meta muda o painel de vários dias: o efetivo e a meta padrão voltam a ser buscados. Espera o efetivo chegar: a tela monta a
 * próxima lista (Subir, Descer, Adicionar) a partir dele, e com a lista velha desfaria a gravação anterior (achado da revisão final).
 */
async function atualizar(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['meta-padrao'] });
  await queryClient.invalidateQueries({ queryKey: ['efetivo-do-dia'] });
}

async function gravando<T>(queryClient: QueryClient, pedido: Promise<T>): Promise<T> {
  try {
    return await pedido;
  } finally {
    await atualizar(queryClient);
  }
}

export const gravarMetaPadrao = (queryClient: QueryClient, unidadeId: string, d: NovaMetaPadrao) =>
  gravando(queryClient, pedir<VersaoDaMetaPadrao[]>('PUT', `/api/unidades/${unidadeId}/meta-padrao`, d));
/** A lista própria do dia, na ordem de ativação (adicionar, subir e descer na própria tela). */
export const gravarMetaDoDia = (queryClient: QueryClient, unidadeId: string, data: string, guarnicoes: string[]) =>
  gravando(queryClient, pedir<MetaDoDia>('PUT', `/api/unidades/${unidadeId}/meta-do-dia/${data}`, { guarnicoes }));

/** Desativar e desfazer mexem na escala (quem estava na guarnição sai ou volta): a escala do mês, as cotas, os candidatos e a grade também voltam a ser buscados. */
async function mexendoNaEscala<T>(queryClient: QueryClient, pedido: Promise<T>): Promise<T> {
  try {
    return await pedido;
  } finally {
    for (const queryKey of [['escala-do-mes'], ['cotas'], ['candidatos'], ['grade'], ['registro-do-passado']]) void queryClient.invalidateQueries({ queryKey });
    await atualizar(queryClient);
  }
}

/** Desativa a guarnição no dia: sai da meta do dia e desescala quem está nela. Devolve o que tirou, para o "Desfazer". */
export const desativar = (queryClient: QueryClient, unidadeId: string, data: string, guarnicaoId: string) =>
  mexendoNaEscala(queryClient, pedir<ResultadoDaDesativacao>('POST', `/api/unidades/${unidadeId}/meta-do-dia/${data}/desativar`, { guarnicaoId }));

/** Desfaz a desativação com o que ela devolveu: as alocações, os acúmulos e a meta voltam. */
export const desfazerDesativacao = (queryClient: QueryClient, unidadeId: string, data: string, d: DesfazerDesativacao) =>
  mexendoNaEscala(queryClient, pedir<EfetivoDoDia>('POST', `/api/unidades/${unidadeId}/meta-do-dia/${data}/desfazer-desativacao`, d));
export const voltarMetaAoPadrao = (queryClient: QueryClient, unidadeId: string, data: string) =>
  gravando(queryClient, pedir<MetaDoDia>('DELETE', `/api/unidades/${unidadeId}/meta-do-dia/${data}`));
