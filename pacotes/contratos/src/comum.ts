// Formatos comuns às rotas da API e às telas.
import { z } from 'zod';

// O Postgres não tem o ano 0000 (e um ano como 0026 é quase sempre erro de digitação): o contrato barra antes do banco.
const ANO_MINIMO = 1900;
const MSG_ANO = `Use um ano a partir de ${ANO_MINIMO}.`;
const anoValido = (texto: string): boolean => Number(texto.slice(0, 4)) >= ANO_MINIMO;

export const Mes = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o mês no formato aaaa-mm.')
  .refine(anoValido, MSG_ANO);
const dataExiste = (texto: string): boolean => {
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
};
export const Data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato aaaa-mm-dd.')
  .refine(dataExiste, 'Use uma data que exista no calendário.')
  .refine(anoValido, MSG_ANO);
export const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a hora no formato HH:MM.');
export const Matricula = z.string().regex(/^\d{6}-\d$/, 'Use 6 dígitos, hífen e 1 dígito (ex.: 123456-7).');
export const Nome = z.string().trim().min(1, 'Preencha este campo.').max(120, 'Use no máximo 120 caracteres.');
export const Id = z.uuid('Identificador inválido.');

export type ErroApi = { erro: string; campos?: Record<string, string> };

/** '2026-12' -> '2026-12-01' */
export function mesParaData(mes: string): string {
  return `${mes}-01`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** '2026-12' -> 'dezembro de 2026' */
export function mesPorExtenso(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
}

/** '2026-12' + 1 -> '2027-01' */
export function somarMeses(mes: string, n: number): string {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
