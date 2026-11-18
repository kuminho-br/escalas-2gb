// Escala do mês: o que a tela lê (dia > faixa > cards de guarnição) e o que ela grava (uma alocação).
import { z } from 'zod';
import { Data, Id } from './comum.ts';
import type { CategoriaCnh as Categoria } from './militares.ts';
import type { LetraTurno } from './servicos.ts';

type CategoriaCnh = z.infer<typeof Categoria>;

/** Escalar um militar numa vaga: o turno diz serviço e horário; guarnição e função dizem a vaga (ambas nulas = sem posto). */
export const NovaAlocacao = z.object({
  militarId: Id,
  data: Data,
  turnoId: Id,
  guarnicaoId: Id.nullable(),
  funcaoId: Id.nullable(),
});
export type NovaAlocacao = z.infer<typeof NovaAlocacao>;

export type OcupanteDaVaga = {
  alocacaoId: string;
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  servico: { id: string; nome: string; cor: string };
  letra: LetraTurno;
};

export type FuncaoNoCard = {
  funcaoId: string;
  funcao: string;
  minimo: number;
  maximo: number;
  cnhExigida: CategoriaCnh | null;
  ocupantes: OcupanteDaVaga[];
};

export type CardDaGuarnicao = {
  guarnicaoId: string;
  nome: string;
  viatura: string | null;
  prioridade: number | null;
  funcoes: FuncaoNoCard[];
  /** toda função com pelo menos o mínimo */
  completa: boolean;
  /** frases como "Falta 1 Motorista (CNH D)" */
  faltam: string[];
};

export type FaixaDoDia = {
  inicio: string;
  fim: string;
  /** atravessa a meia-noite ou começa às 18h ou depois */
  noturna: boolean;
  turnos: { turnoId: string; servicoId: string; servico: string; letra: LetraTurno }[];
  guarnicoes: CardDaGuarnicao[];
  semPosto: OcupanteDaVaga[];
  removidos: { remocaoId: string; militarId: string; nomeGuerra: string; servico: string }[];
};

export type DiaDaEscala = {
  data: string;
  /** 0 = domingo */
  diaDaSemana: number;
  feriado: string | null;
  faixas: FaixaDoDia[];
  obrigatoriasVazias: number;
};

export type EscalaDoMes = {
  escalaId: string;
  nome: string;
  mes: string;
  dias: DiaDaEscala[];
  resumo: { preenchidas: number; obrigatorias: number; obrigatoriasVazias: number };
};

export type Candidato = {
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  equipe: string | null;
  jornada: 'pronto' | 'adm';
  /** serviços da escala em que ele pode entrar nesta faixa, na ordem da escala */
  servicos: { servicoId: string; turnoId: string; nome: string }[];
};

export type Candidatos = {
  aptos: Candidato[];
  fora: { motivo: string; quantidade: number }[];
};
