import { keepPreviousData, queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Candidatos, EscalaDoMes, NovaAlocacao, NovoAcumulo, PreviaDaPreEscala } from 'contratos';
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

/** Escalar ou remover gasta (ou devolve) cota e muda o efetivo do dia: as cotas restantes e o painel do dia voltam a ser buscados. */
function atualizarQuemDependeDaEscala(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['cotas'] });
  void queryClient.invalidateQueries({ queryKey: ['efetivo-do-dia'] });
}

function guardar(queryClient: QueryClient, e: EscalaDoMes): EscalaDoMes {
  atualizarEscalaDoMes(queryClient, e.escalaId, e.mes, e);
  void queryClient.invalidateQueries({ queryKey: ['candidatos'] });
  atualizarQuemDependeDaEscala(queryClient);
  return e;
}

/** A recusa (409, 404) quase sempre quer dizer que outra pessoa mexeu antes: a tela busca a escala e os candidatos de novo. */
async function gravando(queryClient: QueryClient, pedido: Promise<EscalaDoMes>): Promise<EscalaDoMes> {
  try {
    return guardar(queryClient, await pedido);
  } catch (e) {
    void queryClient.invalidateQueries({ queryKey: ['escala-do-mes'] });
    void queryClient.invalidateQueries({ queryKey: ['candidatos'] });
    atualizarQuemDependeDaEscala(queryClient);
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

/** A prévia da pré-escala do Pronto; `equipe` é a equipe do dia 1 escolhida (sem ela, a API usa a detectada). Sempre busca de novo. */
export const consultaPreEscala = (escalaId: string, mes: string, equipe: string | null) =>
  queryOptions({
    queryKey: ['pre-escala', escalaId, mes, equipe],
    queryFn: () => pedir<PreviaDaPreEscala>('GET', `/api/escalas/${escalaId}/mes/${mes}/pre-escala${equipe ? `?equipe=${equipe}` : ''}`),
    // ao trocar a equipe, a prévia anterior fica na tela (com "Atualizando…") até a nova chegar: a seleção não some nem perde o foco
    placeholderData: keepPreviousData,
    gcTime: 0,
    staleTime: 0,
  });

/** Grava a pré-escala: a escala do mês inteira entra no lugar da que estava e a lista de candidatos é refeita. */
export async function gravarPreEscala(queryClient: QueryClient, escalaId: string, mes: string, equipeDia1Id: string): Promise<number> {
  try {
    const r = await pedir<{ escala: EscalaDoMes; gravadas: number }>('POST', `/api/escalas/${escalaId}/mes/${mes}/pre-escala`, { equipeDia1Id });
    guardar(queryClient, r.escala);
    return r.gravadas;
  } catch (e) {
    void queryClient.invalidateQueries({ queryKey: ['escala-do-mes'] });
    throw e;
  }
}
