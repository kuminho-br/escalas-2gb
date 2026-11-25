// A atualização em lote do Pecúlio (6.52): a mesma mudança para vários militares, depois de uma prévia. Os campos do rastreio (lotação, equipe, jornada, quadro, situação) seguem a regra
// de "Alterar situação"; os simples (voluntário JES, função, abono, comportamento) seguem a do PATCH da ficha. Tudo ou nada, até 500 militares.
import { z } from 'zod';
import { Data } from './comum.ts';
import { Comportamento, Jornada } from './militares.ts';

export const LIMITE_DO_LOTE = 500;

export const CamposDoLote = z
  .object({
    unidadeId: z.string().uuid().optional(),
    /** O nome da equipe (cada militar na unidade dele); `null` = sem equipe. */
    equipe: z.string().trim().min(1).max(40).nullable().optional(),
    jornada: Jornada.optional(),
    quadroId: z.string().uuid().nullable().optional(),
    situacaoId: z.string().uuid().optional(),
    voluntarioJes: z.boolean().optional(),
    funcaoMilitarId: z.string().uuid().nullable().optional(),
    abonoPermanencia: z.boolean().optional(),
    comportamento: Comportamento.optional(),
  })
  .refine((c) => Object.values(c).some((v) => v !== undefined), 'Escolha pelo menos um campo.');

export const LoteDeMilitares = z.object({
  militarIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos um militar.').max(LIMITE_DO_LOTE, `Selecione no máximo ${LIMITE_DO_LOTE} militares.`),
  /** O dia a partir do qual a lotação, a equipe, a jornada, o quadro e a situação valem; obrigatório quando algum deles é marcado. */
  desde: Data.optional(),
  campos: CamposDoLote,
});
export type LoteDeMilitares = z.infer<typeof LoteDeMilitares>;

type LinhaDoLote = { id: string; posto: string; nomeGuerra: string; matricula: string };
export type PreviaDoLote = {
  mudam: (LinhaDoLote & { de: string; para: string })[];
  ficamDeFora: (LinhaDoLote & { motivo: string })[];
  /** Quantos chegam à unidade nova sem equipe (a lotação marcada sem equipe marcada). */
  chegamSemEquipe: number;
  /** Um resumo de quem muda e do que muda: `aplicar` o devolve, e a lista que mudou desde a prévia é recusada. */
  assinatura: string;
};
export const AplicarLote = LoteDeMilitares.extend({ assinatura: z.string().min(1) });
export type AplicarLote = z.infer<typeof AplicarLote>;
export type ResultadoDoLote = { mudaram: number; ficaramDeFora: PreviaDoLote['ficamDeFora'] };
