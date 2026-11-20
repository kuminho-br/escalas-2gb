// Grade geral: o mês de todo o efetivo da seção, agrupado em equipes (uma linha por militar, uma coluna por dia).

/** Um bloco de um dia: um serviço escalado (com a letra do turno) ou o expediente implícito do Adm (sem alocação, sem serviço e sem letra). */
export type BlocoDaGrade = {
  alocacaoId: string | null;
  servico: { id: string; nome: string; cor: string; tipo: 'ordinario' | 'pjes' | 'diaria' } | null;
  letra: string | null;
  /** HH:MM */
  inicio: string;
  fim: string;
  expediente: boolean;
};

export type LinhaDaGrade = {
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  jornada: 'pronto' | 'adm';
  /** só os dias do mês com bloco; os blocos de cada dia vêm em ordem de início (o expediente antes) */
  dias: Record<string, BlocoDaGrade[]>;
  /** os dias do mês com choque de horário */
  choques: string[];
  /** quantas alocações do mês em serviços PJES e Diária */
  pjes: number;
  diarias: number;
  /** em minutos: o que ele tirou em PJES e Diária no mês, e o que marcou no voluntariado do mês */
  horasTiradas: number;
  horasPedidas: number;
};

/** `chave`: o id da equipe, 'sem-equipe', 'adm' ou 'outras' (escalados na seção, lotados em outra unidade). */
export type GrupoDaGrade = { chave: string; nome: string; linhas: LinhaDaGrade[] };

export type GradeDoMes = {
  mes: string;
  dias: { data: string; diaDaSemana: number; feriado: string | null }[];
  grupos: GrupoDaGrade[];
};
