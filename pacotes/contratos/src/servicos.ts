// Serviços (de onde vem a hora) e os turnos de cada um.
import { z } from 'zod';
import { Hora, Nome } from './comum.ts';

export const TipoServico = z.enum(['ordinario', 'pjes', 'diaria']);
export type TipoServico = z.infer<typeof TipoServico>;

export const LetraTurno = z.enum(['A', 'B', 'C', 'U']);
export type LetraTurno = z.infer<typeof LetraTurno>;

/** Turno padrão do voluntariado, com o dia relativo ao dia em que o turno do serviço começa. */
export const TurnoPadrao = z.object({ dia: z.union([z.literal(-1), z.literal(0), z.literal(1)]), turno: z.enum(['A', 'B']) });
export type TurnoPadrao = z.infer<typeof TurnoPadrao>;

const TextoOpcional = (limite: number) =>
  z
    .string()
    .trim()
    .max(limite, `Use no máximo ${limite} caracteres.`)
    .transform((v) => (v === '' ? null : v))
    .nullable();

export const DadosServico = z
  .object({
    nome: Nome,
    tipo: TipoServico,
    operacao: TextoOpcional(120),
    rotuloImpressao: TextoOpcional(60),
    cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a cor no formato #RRGGBB.'),
  })
  .refine((s) => s.operacao === null || s.tipo === 'diaria', { path: ['operacao'], message: 'Operação só existe em serviço de diária.' });
export type DadosServico = z.infer<typeof DadosServico>;

export const NovoServico = DadosServico;
export type NovoServico = DadosServico;
export const EdicaoServico = DadosServico;
export type EdicaoServico = DadosServico;

export const SituacaoServico = z.object({ ativo: z.boolean() });
export type SituacaoServico = z.infer<typeof SituacaoServico>;

export const DadosTurno = z.object({ letra: LetraTurno, inicio: Hora, fim: Hora });
export type DadosTurno = z.infer<typeof DadosTurno>;

export type TurnoSalvo = { id: string; letra: LetraTurno; inicio: string; fim: string; duracaoMinutos: number; turnosPadrao: TurnoPadrao[] };

export type Servico = {
  id: string;
  nome: string;
  tipo: TipoServico;
  operacao: string | null;
  rotuloImpressao: string | null;
  cor: string;
  ativo: boolean;
  /** na ordem A, B, C, U */
  turnos: TurnoSalvo[];
};

/** Cores iniciais da especificação de telas; os demais serviços recebem COR_PADRAO_SERVICO. */
export const CORES_SERVICO: Record<string, string> = {
  Pronto: '#2F8F5B',
  JES: '#6E56A8',
  Saldo: '#2B7BB9',
  Bioma: '#C08A1E',
  'PE Seguro': '#3C5F9C',
  Defensoria: '#8C4A7A',
  Expediente: '#8A94A1',
};
export const COR_PADRAO_SERVICO = '#5B6675';
