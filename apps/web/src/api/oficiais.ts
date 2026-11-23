import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EscalaDosOficiais, LancamentoEntrada, OficialNoSaldo } from 'contratos';
import { pedir } from './cliente';

// A escala dos oficiais (QOC e QOA): uma escala comum de rodada de cotas. O mês com os lugares e as cotas de saldo, e o painel de saldo.
// `escalaId` é a escala da rodada escolhida na tela; sem ela, a API usa a do último mês da unidade.
const base = (unidadeId: string, mes: string) => `/api/unidades/${unidadeId}/oficiais/${mes}`;
const daEscala = (escalaId: string | undefined) => (escalaId ? `?escala=${escalaId}` : '');

export const consultaEscalaDosOficiais = (unidadeId: string, mes: string, escalaId?: string) =>
  queryOptions({ queryKey: ['oficiais', unidadeId, 'mes', mes, escalaId ?? 'padrao'], queryFn: () => pedir<EscalaDosOficiais>('GET', `${base(unidadeId, mes)}${daEscala(escalaId)}`) });
export const consultaSaldoDosOficiais = (unidadeId: string, escalaId?: string) =>
  queryOptions({ queryKey: ['oficiais', unidadeId, 'saldo', escalaId ?? 'padrao'], queryFn: () => pedir<OficialNoSaldo[]>('GET', `/api/unidades/${unidadeId}/oficiais-saldo${daEscala(escalaId)}`) });

/** Depois de gravar: a escala do mês e o painel de saldo voltam a buscar. */
function atualizar(queryClient: QueryClient, unidadeId: string) {
  return queryClient.invalidateQueries({ queryKey: ['oficiais', unidadeId] });
}

async function gravar<T>(queryClient: QueryClient, unidadeId: string, pedido: Promise<T>): Promise<T> {
  const r = await pedido;
  await atualizar(queryClient, unidadeId);
  return r;
}

/** "Abrir o mês": cria o mês e calcula as cotas de saldo; antes dele não se lança, e depois dele as cotas se refazem sozinhas até fechar a escala. */
export const abrirMes = (qc: QueryClient, unidadeId: string, mes: string, escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('POST', `${base(unidadeId, mes)}/abrir${daEscala(escalaId)}`));
export const gravarOrdem = (qc: QueryClient, unidadeId: string, mes: string, militarIds: string[], escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('PUT', `${base(unidadeId, mes)}/ordem${daEscala(escalaId)}`, { militarIds }));
/** Quem participa da rodada do mês (a lista inteira). Com o mês aberto, a API refaz as cotas; `liberados` diz os lugares que ficaram sem ninguém. */
export const gravarParticipantes = (qc: QueryClient, unidadeId: string, mes: string, militarIds: string[], escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('PUT', `${base(unidadeId, mes)}/participantes${daEscala(escalaId)}`, { militarIds }));
/** Lança o oficial num lugar (dia e letra) como JES ou como Saldo; lançar Saldo fora da vez grava e devolve `foraDaOrdem`. */
export const lancarNoLugar = (qc: QueryClient, unidadeId: string, mes: string, lancamento: LancamentoEntrada, escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('POST', `${base(unidadeId, mes)}/lancamentos${daEscala(escalaId)}`, lancamento));
/** Tira o oficial do lugar (o lugar volta para a rodada). */
export const tirarDoLugar = (qc: QueryClient, unidadeId: string, mes: string, alocacaoId: string, escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('DELETE', `${base(unidadeId, mes)}/lancamentos/${alocacaoId}${daEscala(escalaId)}`));
/** Os dias vermelhos do mês: a lista inteira (o que não vem deixa de ser vermelho). Vale até o mês ser encerrado e não muda a cota. */
export const marcarDiasVermelhos = (qc: QueryClient, unidadeId: string, mes: string, dias: string[], escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('PUT', `${base(unidadeId, mes)}/dias-vermelhos${daEscala(escalaId)}`, { dias }));
export const fecharEscala = (qc: QueryClient, unidadeId: string, mes: string, escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('POST', `${base(unidadeId, mes)}/fechar${daEscala(escalaId)}`));
export const encerrarMes = (qc: QueryClient, unidadeId: string, mes: string, escalaId?: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('POST', `${base(unidadeId, mes)}/encerrar${daEscala(escalaId)}`));
export const lancarAjuste = (qc: QueryClient, unidadeId: string, militarId: string, valor: number, motivo: string, escalaId?: string) =>
  gravar(qc, unidadeId, pedir<OficialNoSaldo>('POST', `/api/unidades/${unidadeId}/oficiais-saldo/ajustes${daEscala(escalaId)}`, { militarId, valor, motivo }));
