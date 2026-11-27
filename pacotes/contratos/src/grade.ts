// Grade geral: o mês de todo o efetivo da seção, agrupado em equipes (uma linha por militar, uma coluna por dia).
import type { SaldosDoMes } from './escala-do-mes.ts';

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

/**
 * Um período de afastamento da linha, com o tipo ("Férias", do cadastro). `inicio` e `fim` valem para a marca na tabela (recortados ao mês e aos dias que a linha vale; 'aaaa-mm-dd');
 * `inicioReal` e `fimReal` são o período inteiro, para a dica e o painel (podem ser de outro mês).
 */
export type AfastamentoNaGrade = { tipo: string; inicio: string; fim: string; inicioReal: string; fimReal: string };

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
  /** os períodos de afastamento da linha, em ordem de início; vazio sem afastamento */
  afastamentos: AfastamentoNaGrade[];
  /** quantas alocações do mês em serviços PJES e Diária */
  pjes: number;
  diarias: number;
  /** em minutos: o que ele tirou em PJES e Diária no mês, e o que marcou no voluntariado do mês */
  horasTiradas: number;
  horasPedidas: number;
  /** só na linha do Adm: a cota de saldo do mês, a barra na frente da matrícula */
  saldos?: SaldosDoMes;
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
  /** nulo no expediente do Adm lançado pela pré-escala (6.40): ele não é de nenhuma escala */
  escalaId: string | null;
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
 * (a regra pode ser contornada pelo escalante). A flag da opção vale pelo primeiro serviço, o que vem marcado. `ordinario` é verdadeiro quando
 * todos os serviços da opção são fixos (Pronto, Saldo, Expediente, JES, reconhecidos pelo nome): é o que separa a aba Ordinário da Operações.
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
  ordinario: boolean;
};

export type PainelDoDia = {
  militar: { militarId: string; posto: string; nomeGuerra: string; matricula: string; equipe: string | null; jornada: 'pronto' | 'adm'; cnh: string[]; voluntarioJes: boolean };
  data: string;
  /** O afastamento que cobre o dia: o tipo ("Férias", "LTS"…) e o período inteiro ('aaaa-mm-dd'); null se não há. */
  afastamento: { tipo: string; inicio: string; fim: string } | null;
  /** HH:MM; o que ele marcou no voluntariado neste dia */
  disponibilidade: { inicio: string; fim: string }[];
  servicos: ServicoNoDia[];
  /** frases do motor sobre os choques que tocam o dia, sem o código da regra */
  choques: string[];
  opcoes: OpcaoDeServico[];
};
