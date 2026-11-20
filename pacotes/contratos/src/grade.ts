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

/** Um serviço do militar num dia: a alocação, com a escala, o horário, a guarnição e a função. `acumulaCom`: as vagas que ele também ocupa por acúmulo ("Função Guarnição"). */
export type ServicoNoDia = {
  alocacaoId: string;
  escalaId: string;
  escala: string;
  servico: { id: string; nome: string; cor: string; tipo: string };
  letra: string;
  inicio: string;
  fim: string;
  guarnicao: string | null;
  funcao: string | null;
  acumulaCom: string[];
};

/**
 * Onde ele pode entrar neste dia ("Adicionar serviço neste dia"): uma escala, uma faixa e uma vaga (guarnição e função, ou "Sem guarnição").
 * `servicos` são os serviços possíveis na faixa, na ordem em que a tela os oferece; `semVoluntariado` só falta marcar o horário no voluntariado
 * (a regra pode ser contornada pelo escalante). A flag da opção vale pelo primeiro serviço, o que vem marcado.
 */
export type OpcaoDeServico = {
  escalaId: string;
  escala: string;
  inicio: string;
  fim: string;
  guarnicaoId: string | null;
  guarnicao: string | null;
  funcaoId: string | null;
  funcao: string | null;
  servicos: { servicoId: string; turnoId: string; nome: string; semVoluntariado: boolean }[];
  semVoluntariado: boolean;
};

export type PainelDoDia = {
  militar: { militarId: string; posto: string; nomeGuerra: string; matricula: string; equipe: string | null; jornada: 'pronto' | 'adm'; cnh: string[]; voluntarioJes: boolean };
  data: string;
  /** "Férias", "LTS"…: o tipo do afastamento que cobre o dia */
  afastamento: string | null;
  /** HH:MM; o que ele marcou no voluntariado neste dia */
  disponibilidade: { inicio: string; fim: string }[];
  servicos: ServicoNoDia[];
  /** frases do motor sobre os choques que tocam o dia, sem o código da regra */
  choques: string[];
  opcoes: OpcaoDeServico[];
};
