// Efetivo do dia: o painel das guarnições do dia (a meta de ativação, quem está nelas, o que falta) e as cotas restantes do mês.

/** Cota restante de um serviço no mês: a soma das cotas (interna e externa) e das alocações já distribuídas nelas. */
export type CotaRestante = { servicoId: string; servico: string; cor: string; quantidade: number; usadas: number };

/** Uma alocação dentro de um trecho ocupado: o trecho junta os turnos que o militar emenda na mesma função e no mesmo serviço. */
export type AlocacaoNoTrecho = {
  alocacaoId: string;
  /** o id do acúmulo quando ele ocupa a função por acúmulo; null na vaga original */
  acumuloId: string | null;
  /** HH:MM do turno da alocação */
  inicio: string;
  fim: string;
  /** os avisos do "Remover", como na Escala do mês: no acúmulo, a vaga original; na vaga original, os acúmulos ("Função Guarnição") */
  acumulaCom: string[];
};

/** Por onde se escala uma vaga: a escala e a faixa (HH:MM) de um vínculo da guarnição que cobre a vaga. */
export type OpcaoDaVaga = { escalaId: string; escala: string; inicio: string; fim: string };

/** Um trecho de uma linha do tempo, em minutos desde as 00h do dia (passa de 1440 depois da meia-noite). Sem ocupante, é vaga. */
export type TrechoNoEfetivo = {
  inicio: number;
  fim: number;
  ocupante: {
    militarId: string;
    posto: string;
    nomeGuerra: string;
    servico: { id: string; nome: string; cor: string };
    /** true quando ele ocupa esta função por acúmulo (já está escalado em outra vaga no mesmo turno) */
    acumulo: boolean;
    alocacoes: AlocacaoNoTrecho[];
  } | null;
  /** só na vaga: os vínculos da guarnição que a cobrem, com as escalas pelo nome */
  opcoes: OpcaoDaVaga[];
};

/** Uma função da guarnição no dia: uma linha por vaga ocupada ou aberta. */
export type FuncaoNoEfetivo = { funcaoId: string; funcao: string; minimo: number; cnhExigida: string | null; linhas: TrechoNoEfetivo[][] };

export type FaltaNoEfetivo = {
  funcao: string;
  faltam: number;
  /** HH:MM; o fim depois da meia-noite já volta ao relógio (08:00) */
  inicio: string;
  fim: string;
};

export type GuarnicaoNoEfetivo = {
  guarnicaoId: string;
  nome: string;
  viatura: string | null;
  /** a posição na meta do dia (1, 2…); null fora da meta */
  ordem: number | null;
  ativada: boolean;
  /** onde a guarnição está vinculada no dia (a união, em HH:MM); vazio = "Sem horário vinculado neste dia" */
  horarios: { inicio: string; fim: string }[];
  faltas: FaltaNoEfetivo[];
  funcoes: FuncaoNoEfetivo[];
  /** quantas alocações e acúmulos do dia estão nela (a pergunta do "Tirar da meta") */
  alocados: number;
};

import type { DesfazerDesativacao } from './meta.ts';

export type EfetivoDoDia = {
  data: string;
  meta: { origem: 'padrao' | 'dia'; total: number; ativadas: number };
  guarnicoes: GuarnicaoNoEfetivo[];
  /** as guarnições da meta padrão do dia que não estão na meta do dia ("Desativadas hoje"); vazio quando o dia segue o padrão */
  desativadas: { guarnicaoId: string; nome: string; viatura: string | null }[];
  cotas: CotaRestante[];
};

/** Desativar uma guarnição: o efetivo do dia já atualizado e o que ela tirou, para o "Desfazer". */
export type ResultadoDaDesativacao = { efetivo: EfetivoDoDia; desfazer: DesfazerDesativacao };
