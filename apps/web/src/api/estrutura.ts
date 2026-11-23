import { queryOptions } from '@tanstack/react-query';
import type { NoDaEstrutura, NovaDivisao } from 'contratos';
import { pedir } from './cliente';

/** A árvore de um grupamento: as divisões e as seções. */
export const consultaEstrutura = (grupamentoId: string) =>
  queryOptions({ queryKey: ['estrutura', grupamentoId], queryFn: () => pedir<NoDaEstrutura>('GET', `/api/unidades/${grupamentoId}/estrutura`) });

export const criarDivisao = (grupamentoId: string, d: NovaDivisao) => pedir<NoDaEstrutura>('POST', `/api/unidades/${grupamentoId}/divisoes`, d);
export const renomearDivisao = (id: string, d: NovaDivisao) => pedir<NoDaEstrutura>('PATCH', `/api/divisoes/${id}`, d);
/** Põe a seção numa divisão; `null` devolve a seção ao grupamento. Responde a árvore do grupamento. */
export const moverSecao = (secaoId: string, divisaoId: string | null) => pedir<NoDaEstrutura>('PUT', `/api/secoes/${secaoId}/divisao`, { divisaoId });
