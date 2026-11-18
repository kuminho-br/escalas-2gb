import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Candidatos, EscalaDoMes, NovaAlocacao } from 'contratos';
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

export const escalar = async (queryClient: QueryClient, escalaId: string, d: NovaAlocacao) =>
  guardar(queryClient, await pedir<EscalaDoMes>('POST', `/api/escalas/${escalaId}/alocacoes`, d));
export const removerAlocacao = async (queryClient: QueryClient, alocacaoId: string) =>
  guardar(queryClient, await pedir<EscalaDoMes>('DELETE', `/api/alocacoes/${alocacaoId}`));
export const desfazerRemocao = async (queryClient: QueryClient, remocaoId: string) =>
  guardar(queryClient, await pedir<EscalaDoMes>('DELETE', `/api/remocoes/${remocaoId}`));
