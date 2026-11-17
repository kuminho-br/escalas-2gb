// Funções e guarnições: composição por versão (vigência), com viatura só informativa.
import { z } from 'zod';
import { Id, Mes, Nome } from './comum.ts';
import { CategoriaCnh } from './militares.ts';

const MSG_MAXIMO = 'O máximo precisa ser igual ou maior que o mínimo.';
const Inteiro0 = z.number().int('Use um número inteiro.').min(0, 'Use um número a partir de 0.');
const TextoOpcional = (limite: number) =>
  z
    .string()
    .trim()
    .max(limite, `Use no máximo ${limite} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullable();

export const LinhaComposicao = z
  .object({ funcaoId: Id, minimo: Inteiro0, maximo: Inteiro0, cnhExigida: CategoriaCnh.nullable() })
  .refine((l) => l.maximo >= l.minimo, { path: ['maximo'], message: MSG_MAXIMO });
export type LinhaComposicao = z.infer<typeof LinhaComposicao>;

export const VersaoGuarnicao = z
  .object({
    viatura: TextoOpcional(40),
    tipoViatura: TextoOpcional(60),
    prioridade: z.number().int('Use um número inteiro.').min(1, 'Use um número a partir de 1.').nullable(),
    ativa: z.boolean(),
    composicao: z.array(LinhaComposicao),
  })
  .superRefine((v, ctx) => {
    const vistas = new Set<string>();
    v.composicao.forEach((l, i) => {
      if (vistas.has(l.funcaoId)) ctx.addIssue({ code: 'custom', path: ['composicao', i, 'funcaoId'], message: 'Esta função já está na composição.' });
      vistas.add(l.funcaoId);
    });
  });
export type VersaoGuarnicao = z.infer<typeof VersaoGuarnicao>;

export const NovaGuarnicao = z.object({ nome: Nome, vigencia: Mes, versao: VersaoGuarnicao });
export type NovaGuarnicao = z.infer<typeof NovaGuarnicao>;

export const EdicaoGuarnicao = z.object({ nome: Nome.optional() });
export type EdicaoGuarnicao = z.infer<typeof EdicaoGuarnicao>;

export const NovaFuncao = z.object({ nome: Nome });
export type NovaFuncao = z.infer<typeof NovaFuncao>;

export type Funcao = { id: string; nome: string; unidadeSigla: string; herdada: boolean };

export type ComposicaoSalva = { funcaoId: string; funcao: string; minimo: number; maximo: number; cnhExigida: string | null };
export type VersaoSalva = {
  /** aaaa-mm */
  vigencia: string;
  viatura: string | null;
  tipoViatura: string | null;
  prioridade: number | null;
  ativa: boolean;
  composicao: ComposicaoSalva[];
};

export type LinhaGuarnicao = {
  id: string;
  nome: string;
  viatura: string | null;
  prioridade: number | null;
  ativa: boolean;
  /** somas dos mínimos e dos máximos da composição */
  minimo: number;
  maximo: number;
  /** mês da primeira versão, quando nenhuma vale ainda no mês consultado */
  aPartirDe: string | null;
};

export type FichaGuarnicao = {
  id: string;
  nome: string;
  /** mais recente primeiro */
  versoes: VersaoSalva[];
  usadaEm: { escalaId: string; escala: string; turnos: string[] }[];
};
