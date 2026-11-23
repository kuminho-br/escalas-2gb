import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { EscalaDosOficiais, OficialNoSaldo } from 'contratos';
import { pedir } from './cliente';

// A escala dos oficiais (QOC e QOA): o mês com os turnos e as cotas, e o painel de saldo.
const base = (unidadeId: string, mes: string) => `/api/unidades/${unidadeId}/oficiais/${mes}`;

export const consultaEscalaDosOficiais = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['oficiais', unidadeId, 'mes', mes], queryFn: () => pedir<EscalaDosOficiais>('GET', base(unidadeId, mes)) });
export const consultaSaldoDosOficiais = (unidadeId: string) =>
  queryOptions({ queryKey: ['oficiais', unidadeId, 'saldo'], queryFn: () => pedir<OficialNoSaldo[]>('GET', `/api/unidades/${unidadeId}/oficiais-saldo`) });

/** Depois de gravar: a escala do mês e o painel de saldo voltam a buscar. */
function atualizar(queryClient: QueryClient, unidadeId: string) {
  return queryClient.invalidateQueries({ queryKey: ['oficiais', unidadeId] });
}

async function gravar<T>(queryClient: QueryClient, unidadeId: string, pedido: Promise<T>): Promise<T> {
  const r = await pedido;
  await atualizar(queryClient, unidadeId);
  return r;
}

export const escolherServico = (qc: QueryClient, unidadeId: string, mes: string, servicoId: string) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('PUT', `${base(unidadeId, mes)}/servico`, { servicoId }));
export const calcularCotas = (qc: QueryClient, unidadeId: string, mes: string) => gravar(qc, unidadeId, pedir<EscalaDosOficiais>('POST', `${base(unidadeId, mes)}/cotas`));
export const gravarOrdem = (qc: QueryClient, unidadeId: string, mes: string, militarIds: string[]) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('PUT', `${base(unidadeId, mes)}/ordem`, { militarIds }));
/** Quem participa da rodada do mês (a lista inteira). Com as cotas calculadas, a API refaz as cotas; `liberados` diz os turnos que ficaram sem ninguém. */
export const gravarParticipantes = (qc: QueryClient, unidadeId: string, mes: string, militarIds: string[]) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('PUT', `${base(unidadeId, mes)}/participantes`, { militarIds }));
export const trocarTurno = (qc: QueryClient, unidadeId: string, mes: string, dia: string, turnoId: string, militarId: string | null) =>
  gravar(qc, unidadeId, pedir<EscalaDosOficiais>('PUT', `${base(unidadeId, mes)}/turnos/${dia}/${turnoId}`, { militarId }));
export const fecharEscala = (qc: QueryClient, unidadeId: string, mes: string) => gravar(qc, unidadeId, pedir<EscalaDosOficiais>('POST', `${base(unidadeId, mes)}/fechar`));
export const encerrarMes = (qc: QueryClient, unidadeId: string, mes: string) => gravar(qc, unidadeId, pedir<EscalaDosOficiais>('POST', `${base(unidadeId, mes)}/encerrar`));
export const lancarAjuste = (qc: QueryClient, unidadeId: string, militarId: string, valor: number, motivo: string) =>
  gravar(qc, unidadeId, pedir<OficialNoSaldo>('POST', `/api/unidades/${unidadeId}/oficiais-saldo/ajustes`, { militarId, valor, motivo }));
