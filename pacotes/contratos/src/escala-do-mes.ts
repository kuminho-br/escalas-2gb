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

/** Acumular: o militar de uma alocação ocupa também esta vaga (a alocação vem na rota). */
export const NovoAcumulo = z.object({ guarnicaoId: Id, funcaoId: Id });
export type NovoAcumulo = z.infer<typeof NovoAcumulo>;

export type OcupanteDaVaga = {
  alocacaoId: string;
  /** null = a vaga original da alocação; senão, o id do acúmulo */
  acumuloId: string | null;
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  servico: { id: string; nome: string; cor: string };
  letra: LetraTurno;
  /** as outras vagas do mesmo militar na faixa: "Chefe ABT" (função e guarnição) ou só o nome da guarnição quando ela tem uma função só */
  acumulaCom: string[];
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
  /** `cor`: a cor cadastrada do serviço (a etiqueta no título do turno) */
  turnos: { turnoId: string; servicoId: string; servico: string; cor: string; letra: LetraTurno }[];
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

/** A resposta de remover da vaga: a escala do mês e o id da remoção que ficou (o "Desfazer" do aviso usa). */
export type RemocaoFeita = EscalaDoMes & { remocaoId: string };

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
  /** só não marcaram o horário no voluntariado (todas as outras regras passam): o escalante pode escalá-los combinando direto */
  semVoluntariado: Candidato[];
  fora: { motivo: string; quantidade: number }[];
  /** já escalados nesta faixa, com guarnição e função, que cumprem os requisitos desta vaga; `vaga` = a vaga que já ocupam */
  acumular: { alocacaoId: string; militarId: string; posto: string; nomeGuerra: string; matricula: string; vaga: string }[];
};

/** Trocar uma alocação: pôr um militar livre no lugar (com o turno escolhido, da mesma faixa) ou trocar de lugar com quem já está escalado no dia. */
export const Troca = z.union([z.object({ militarId: Id, turnoId: Id }), z.object({ comAlocacaoId: Id })]);
export type Troca = z.infer<typeof Troca>;

/** Um militar já escalado no dia, com onde ele está ("Ordinário, 20h–08h, Motorista do ABT"); `permuta` quando os dois serviços são ordinários. */
export type EscaladoNoDia = {
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  alocacoes: { alocacaoId: string; onde: string; permuta: boolean }[];
};

export type OpcoesDeTroca = { livres: Candidatos; escalados: EscaladoNoDia[] };

/** As escalas mexidas pela troca: a tela busca de novo o que depende delas. */
export type ResultadoDaTroca = { escalas: { escalaId: string; mes: string }[] };
