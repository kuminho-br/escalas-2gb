// Formatos comuns às rotas da API e às telas.
import { z } from 'zod';

export const Mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o mês no formato aaaa-mm.');
export const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato aaaa-mm-dd.');
export const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a hora no formato HH:MM.');
export const Matricula = z.string().regex(/^\d{6}-\d$/, 'Use 6 dígitos, hífen e 1 dígito (ex.: 123456-7).');
export const Nome = z.string().trim().min(1, 'Preencha este campo.').max(120, 'Use no máximo 120 caracteres.');
export const Id = z.uuid('Identificador inválido.');

export type ErroApi = { erro: string; campos?: Record<string, string> };

/** '2026-12' -> '2026-12-01' */
export function mesParaData(mes: string): string {
  return `${mes}-01`;
}
