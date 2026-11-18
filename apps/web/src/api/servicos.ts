import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { DadosTurno, EdicaoServico, NovoServico, Servico } from 'contratos';
import { pedir } from './cliente';

export const consultaServicos = (unidadeId: string) =>
  queryOptions({ queryKey: ['servicos', unidadeId], queryFn: () => pedir<Servico[]>('GET', `/api/unidades/${unidadeId}/servicos`) });
export const consultaServico = (id: string) => queryOptions({ queryKey: ['servico', id], queryFn: () => pedir<Servico>('GET', `/api/servicos/${id}`) });

export const criarServico = (unidadeId: string, d: NovoServico) => pedir<Servico>('POST', `/api/unidades/${unidadeId}/servicos`, d);
export const editarServico = (id: string, d: EdicaoServico) => pedir<Servico>('PATCH', `/api/servicos/${id}`, d);
export const mudarSituacaoServico = (id: string, ativo: boolean) => pedir<Servico>('POST', `/api/servicos/${id}/situacao`, { ativo });
export const incluirTurno = (servicoId: string, d: DadosTurno) => pedir<Servico>('POST', `/api/servicos/${servicoId}/turnos`, d);
export const editarTurno = (id: string, d: DadosTurno) => pedir<Servico>('PATCH', `/api/turnos/${id}`, d);
export const removerTurno = (id: string) => pedir<Servico>('DELETE', `/api/turnos/${id}`);

/** Depois de gravar: lista, fichas de serviço e escalas (que mostram serviços e letras) voltam a buscar. */
export function atualizarServicos(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['servicos'] });
  void queryClient.invalidateQueries({ queryKey: ['servico'] });
  void queryClient.invalidateQueries({ queryKey: ['escalas'] });
  void queryClient.invalidateQueries({ queryKey: ['escala'] });
}
