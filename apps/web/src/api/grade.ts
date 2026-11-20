import { queryOptions } from '@tanstack/react-query';
import type { GradeDoMes } from 'contratos';
import { pedir } from './cliente';

/** A grade do mês: todo o efetivo da seção, em grupos. As gravações de escala invalidam `['grade']`. */
export const consultaGrade = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['grade', unidadeId, mes], queryFn: () => pedir<GradeDoMes>('GET', `/api/unidades/${unidadeId}/grade/${mes}`) });
