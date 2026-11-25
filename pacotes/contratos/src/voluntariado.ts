// Voluntariado lançado à mão por faixa de horário: o que a tela lê (lista do mês e disponibilidade de um militar) e o que ela grava (o mês de um militar).
import { z } from 'zod';
import { Data, Hora } from './comum.ts';

/** Hora de fim de uma faixa: como `Hora`, e "24:00" (o fim do dia). */
export const Hora24 = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Use a hora no formato HH:MM.');
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

/** Um trecho do dia em que o militar pode: do início ao fim (fim "24:00" = até o fim do dia). */
export const FaixaDeDisponibilidade = z
  .object({ data: Data, inicio: Hora, fim: Hora24 })
  .refine((f) => minutos(f.fim) > minutos(f.inicio), { message: 'O fim precisa ser depois do início.', path: ['fim'] });
export type FaixaDeDisponibilidade = z.infer<typeof FaixaDeDisponibilidade>;

/** O mês inteiro de um militar: substitui o que havia. Lista vazia é aceita ("lancei: nenhum horário"); faixas que se tocam viram uma só ao gravar. */
export const LancamentoDeVoluntariado = z.object({ faixas: z.array(FaixaDeDisponibilidade) });
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
  /** já houve lançamento no mês (mesmo com zero horas) */
  lancado: boolean;
  /** soma das faixas do mês, em horas, depois de unir as que se tocam */
  horas: number;
  dias: number;
  /** o mês foi preenchido pelo próprio militar (na área pessoal) */
  peloMilitar: boolean;
  /** quantas vezes o escalante corrigiu o que o militar marcou neste mês (as linhas do registro) */
  correcoes: number;
};

export type VoluntariadoDoMes = { mes: string; militares: MilitarDoVoluntariado[]; /** a unidade aceita o preenchimento do militar neste mês */ coletaAberta: boolean };

/** Abre (true) ou fecha (false) a coleta do voluntariado da unidade num mês. */
export const ColetaDoVoluntariado = z.object({ aberta: z.boolean() });
export type ColetaDoVoluntariado = z.infer<typeof ColetaDoVoluntariado>;

export type VoluntariadoDoMilitar = {
  militarId: string;
  mes: string;
  /** unidas e em ordem de data */
  faixas: FaixaDeDisponibilidade[];
  doMesAnterior: FaixaDeDisponibilidade[];
  /** os blocos do dia, tirados dos horários dos serviços da seção que pedem voluntariado (fim "24:00" = fim do dia) */
  blocos: { inicio: string; fim: string }[];
  /** dias do mês em que a equipe dele não está de serviço; null se for do Adm, sem equipe do ciclo ou se a equipe do dia 1 não pôde ser descoberta */
  folgas: string[] | null;
};

/** O que o militar vê do próprio voluntariado na área pessoal. `podeMarcar` falso vem com o `motivo` em texto pronto. */
export type MeuVoluntariado = VoluntariadoDoMilitar & {
  coletaAberta: boolean;
  podeMarcar: boolean;
  motivo: string | null;
  voluntarioJes: boolean;
  unidadeSigla: string;
};

/** Uma linha do registro das exceções (correção do voluntariado; alteração no passado da escala, na fase 7.3). `texto` é a frase pronta para a tela. */
export type RegistroDeAlteracao = {
  id: string;
  em: string;
  por: { patente: string; nomeGuerra: string } | null;
  tipo: 'voluntariado_corrigido' | 'escala_no_passado';
  data: string | null;
  antes: unknown;
  depois: unknown;
  justificativa: string | null;
  texto: string;
};
