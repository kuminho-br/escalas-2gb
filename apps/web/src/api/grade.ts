import { queryOptions } from '@tanstack/react-query';
import type { GradeDoMes, PainelDoDia } from 'contratos';
import { pedir } from './cliente';

/** A grade do mês: todo o efetivo da seção, em grupos. As gravações de escala invalidam `['grade']`. */
export const consultaGrade = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['grade', unidadeId, mes], queryFn: () => pedir<GradeDoMes>('GET', `/api/unidades/${unidadeId}/grade/${mes}`) });

/** O dia de um militar na grade: serviços, choques e onde ele pode entrar. Fica sob `['grade']`: as gravações de escala o invalidam junto. */
export const consultaPainelDoDia = (unidadeId: string, mes: string, militarId: string, data: string) =>
  queryOptions({
    queryKey: ['grade', 'dia', unidadeId, militarId, data],
    queryFn: () => pedir<PainelDoDia>('GET', `/api/unidades/${unidadeId}/grade/${mes}/militares/${militarId}/dias/${data}`),
  });
