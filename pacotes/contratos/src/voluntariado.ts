// Voluntariado lançado à mão: o que a tela lê (lista do mês e marcações de um militar) e o que ela grava (o mês de um militar).
import { z } from 'zod';
import { Data } from './comum.ts';

export const LetraDoTurnoPadrao = z.enum(['A', 'B']);
export type LetraDoTurnoPadrao = z.infer<typeof LetraDoTurnoPadrao>;

export const MarcaDeVoluntariado = z.object({ data: Data, turno: LetraDoTurnoPadrao });
export type MarcaDeVoluntariado = z.infer<typeof MarcaDeVoluntariado>;

/** O mês inteiro de um militar: substitui o que havia. Lista vazia é aceita ("lancei: nenhum dia"). */
export const LancamentoDeVoluntariado = z
  .object({ marcas: z.array(MarcaDeVoluntariado) })
  .refine((v) => new Set(v.marcas.map((m) => `${m.data}|${m.turno}`)).size === v.marcas.length, { message: 'Esta marcação aparece duas vezes.', path: ['marcas'] });
export type LancamentoDeVoluntariado = z.infer<typeof LancamentoDeVoluntariado>;

export type MilitarDoVoluntariado = {
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  /** nome da equipe do Pronto; null para o Adm ou sem equipe */
  equipe: string | null;
  jornada: 'pronto' | 'adm';
  voluntarioJes: boolean;
  /** já houve lançamento no mês (mesmo com zero marcações) */
  lancado: boolean;
  turnos: number;
  dias: number;
};

export type VoluntariadoDoMes = { mes: string; militares: MilitarDoVoluntariado[] };

export type VoluntariadoDoMilitar = {
  militarId: string;
  mes: string;
  marcas: MarcaDeVoluntariado[];
  doMesAnterior: MarcaDeVoluntariado[];
  /** dias do mês em que a equipe dele não está de serviço; null se for do Adm, sem equipe do ciclo ou se a equipe do dia 1 não pôde ser descoberta */
  folgas: string[] | null;
};
