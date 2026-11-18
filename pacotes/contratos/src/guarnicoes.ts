// Funções e guarnições: composição por versão (vigência), com viatura só informativa.
import { z } from 'zod';
import { Id, Mes, Nome } from './comum.ts';
import { CategoriaCnh } from './militares.ts';

const MSG_MAXIMO = 'O máximo precisa ser igual ou maior que o mínimo.';
const Inteiro0 = z.number().int('Use um número inteiro.').min(0, 'Use um número a partir de 0.');
/** Mínimo e máximo de militares de uma função: até 99 (cabe no banco e na tela). */
export const QuantidadeDeMilitares = Inteiro0.max(99, 'Use um número até 99.');
/** Ordem de ativação: de 1 a 1000, ou vazio (a guarnição vai por último). */
export const Prioridade = z
  .number()
  .int('Use um número inteiro.')
  .min(1, 'Use um número de 1 a 1000.')
  .max(1000, 'Use um número de 1 a 1000.')
  .nullable();
const TextoOpcional = (limite: number) =>
  z
    .string()
    .trim()
    .max(limite, `Use no máximo ${limite} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullable();

export const LinhaComposicao = z
  .object({ funcaoId: Id, minimo: QuantidadeDeMilitares, maximo: QuantidadeDeMilitares, cnhExigida: CategoriaCnh.nullable() })
  .refine((l) => l.maximo >= l.minimo, { path: ['maximo'], message: MSG_MAXIMO });
export type LinhaComposicao = z.infer<typeof LinhaComposicao>;

export const VersaoGuarnicao = z
  .object({
    viatura: TextoOpcional(40),
    tipoViatura: TextoOpcional(60),
    prioridade: Prioridade,
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

export const EdicaoFuncao = z.object({ nome: Nome });
export type EdicaoFuncao = z.infer<typeof EdicaoFuncao>;

export const SituacaoGuarnicao = z.object({ ativa: z.boolean(), aPartirDe: Mes });
export type SituacaoGuarnicao = z.infer<typeof SituacaoGuarnicao>;

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
  /** menor mês a partir do qual todas as versões estão inativas; null se a mais recente está ativa */
  desativadaAPartirDe: string | null;
  usadaEm: { escalaId: string; escala: string; faixas: { inicio: string; fim: string }[] }[];
};
