import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Candidatos, EscalaDoMes, NovaAlocacao, NovoAcumulo } from 'contratos';
import { pedir } from './cliente';

export const consultaEscalaDoMes = (escalaId: string, mes: string) =>
  queryOptions({ queryKey: ['escala-do-mes', escalaId, mes], queryFn: () => pedir<EscalaDoMes>('GET', `/api/escalas/${escalaId}/mes/${mes}`) });

/** Depois de escalar, remover ou desfazer: a API devolve a escala do mês inteira, e ela entra no lugar da que estava. */
export function atualizarEscalaDoMes(queryClient: QueryClient, escalaId: string, mes: string, dados: EscalaDoMes) {
  queryClient.setQueryData(['escala-do-mes', escalaId, mes], dados);
}

/** Quem pode ocupar a vaga (dia, faixa, guarnição e função). Sempre busca de novo: o que vale hoje pode não valer daqui a pouco. */
export const consultaCandidatos = (escalaId: string, mes: string, v: { data: string; inicio: string; fim: string; guarnicaoId: string; funcaoId: string }) =>
  queryOptions({
    queryKey: ['candidatos', escalaId, v],
    queryFn: () => pedir<Candidatos>('GET', `/api/escalas/${escalaId}/mes/${mes}/candidatos?${new URLSearchParams(v)}`),
    gcTime: 0,
    staleTime: 0,
  });

function guardar(queryClient: QueryClient, e: EscalaDoMes): EscalaDoMes {
  atualizarEscalaDoMes(queryClient, e.escalaId, e.mes, e);
  void queryClient.invalidateQueries({ queryKey: ['candidatos'] });
  return e;
}

/** A recusa (409, 404) quase sempre quer dizer que outra pessoa mexeu antes: a tela busca a escala e os candidatos de novo. */
async function gravando(queryClient: QueryClient, pedido: Promise<EscalaDoMes>): Promise<EscalaDoMes> {
  try {
    return guardar(queryClient, await pedido);
  } catch (e) {
    void queryClient.invalidateQueries({ queryKey: ['escala-do-mes'] });
    void queryClient.invalidateQueries({ queryKey: ['candidatos'] });
    throw e;
  }
}

export const escalar = (queryClient: QueryClient, escalaId: string, d: NovaAlocacao) =>
  gravando(queryClient, pedir<EscalaDoMes>('POST', `/api/escalas/${escalaId}/alocacoes`, d));
export const removerAlocacao = (queryClient: QueryClient, alocacaoId: string) => gravando(queryClient, pedir<EscalaDoMes>('DELETE', `/api/alocacoes/${alocacaoId}`));
/** Tira a marca de remoção: a pré-escala pode escalar o militar neste turno de novo. Não o põe de volta na vaga. */
export const desfazerRemocao = (queryClient: QueryClient, remocaoId: string) => gravando(queryClient, pedir<EscalaDoMes>('DELETE', `/api/remocoes/${remocaoId}`));

/** O militar de uma alocação ocupa também esta vaga da mesma faixa (acúmulo de funções). */
export const acumular = (queryClient: QueryClient, alocacaoId: string, d: NovoAcumulo) =>
  gravando(queryClient, pedir<EscalaDoMes>('POST', `/api/alocacoes/${alocacaoId}/acumulos`, d));
/** Tira só a vaga acumulada: o militar continua na vaga original. */
export const tirarAcumulo = (queryClient: QueryClient, acumuloId: string) => gravando(queryClient, pedir<EscalaDoMes>('DELETE', `/api/acumulos/${acumuloId}`));
