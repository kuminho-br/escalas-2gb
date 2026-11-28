// Escala do mês: o que a tela lê (dia > faixa > cards de guarnição) e o que ela grava (uma alocação).
import { z } from 'zod';
import { Data, Id } from './comum.ts';
import type { CategoriaCnh as Categoria } from './militares.ts';
import type { LetraTurno } from './servicos.ts';

type CategoriaCnh = z.infer<typeof Categoria>;

/**
 * Resolver o choque ao escalar (6.38): `alocacaoId` tira o militar do serviço que choca (pela remoção devolvível) e o escala aqui; `expediente` o escala aqui
 * por cima do expediente do dia (só vale para o serviço cadastrado com "Pode tirar o militar do Adm do expediente"). As duas coisas ou nenhuma.
 */
export const ResolverChoque = z.union([z.object({ alocacaoId: Id }), z.object({ expediente: z.literal(true) })]);
export type ResolverChoque = z.infer<typeof ResolverChoque>;

/** O motivo de alterar o passado de uma escala com prévia lançada (mínimo de 10 letras; a API confere e responde 400 no campo `justificativa`). Fora disso é ignorado. */
export const Justificativa = z.string().trim().optional();

/** Escalar um militar numa vaga: o turno diz serviço e horário; guarnição e função dizem a vaga (ambas nulas = sem posto). */
export const NovaAlocacao = z.object({
  militarId: Id,
  data: Data,
  turnoId: Id,
  guarnicaoId: Id.nullable(),
  funcaoId: Id.nullable(),
  resolverChoque: ResolverChoque.optional(),
  /** O painel do dia da Grade (6.70) escala quem está afastado, depois de mostrar o aviso: o afastamento deixa de recusar; todas as outras regras continuam. */
  mesmoAfastado: z.boolean().optional(),
  justificativa: Justificativa,
});
export type NovaAlocacao = z.infer<typeof NovaAlocacao>;

/** Acumular: o militar de uma alocação ocupa também esta vaga (a alocação vem na rota). */
export const NovoAcumulo = z.object({ guarnicaoId: Id, funcaoId: Id, justificativa: Justificativa });
export type NovoAcumulo = z.infer<typeof NovoAcumulo>;

/** A cota de saldo do militar do Adm no mês (6.38): quantos Saldos ele tem (em qualquer escala) e o total do parâmetro "Saldos por militar do Adm". `feitos` pode passar de `total`. */
export type SaldosDoMes = { feitos: number; total: number };

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
  /** só no ocupante de Saldo (do Adm): a cota do mês ao lado da etiqueta do Saldo */
  saldos?: SaldosDoMes;
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

/** Um serviço PJES ou diária com meta neste dia (6.72) que ainda tem menos escalados do que o mínimo da meta. Só avisa: não impede fechar a escala. */
export type MetaAbaixo = { servico: string; minimo: number; escalados: number };

export type DiaDaEscala = {
  data: string;
  /** 0 = domingo */
  diaDaSemana: number;
  feriado: string | null;
  faixas: FaixaDoDia[];
  obrigatoriasVazias: number;
  /** as metas da cota (dos serviços desta escala) que o dia ainda não cumpriu; vazio quando não há meta ou todas foram cumpridas */
  metasAbaixo: MetaAbaixo[];
};

/** A resposta de remover da vaga: a escala do mês e o id da remoção que ficou (o "Desfazer" do aviso usa). */
export type RemocaoFeita = EscalaDoMes & { remocaoId: string };

/** A resposta de escalar resolvendo um choque: o que o "Desfazer" precisa (a alocação nova e a remoção de lá; `remocaoId` nulo quando só se passou por cima do expediente). */
export type AlocacaoResolvida = EscalaDoMes & { desfazer: { alocacaoId: string; remocaoId: string | null } };

/** "Desfazer" a resolução: tira a alocação nova e devolve a de lá. */
export const DesfazerResolucao = z.object({ alocacaoId: Id, remocaoId: Id.nullable(), justificativa: Justificativa });
export type DesfazerResolucao = z.infer<typeof DesfazerResolucao>;

export type EscalaDoMes = {
  escalaId: string;
  nome: string;
  mes: string;
  dias: DiaDaEscala[];
  resumo: { preenchidas: number; obrigatorias: number; obrigatoriasVazias: number };
  /** o estado da escala neste mês (7.3.1): rascunho, prévia, publicada, retificada ou remessada, e se está em retificação */
  estado: EstadoDoMes;
  /** quem pede é gestor, coordenador ou administrador da unidade: só esses publicam e republicam */
  podePublicar: boolean;
  /** quem pede é gestor, coordenador ou administrador da unidade: só esses alteram um turno que já começou, numa escala que não é rascunho */
  podeAlterarPassado: boolean;
};

/** Os cinco estados da escala de um mês: sem linha no banco é rascunho (só quem monta a escala vê). */
export const EstadoDaEscala = z.enum(['rascunho', 'previa', 'publicada', 'retificada', 'remessada']);
export type EstadoDaEscala = z.infer<typeof EstadoDaEscala>;
/** `emRetificacao`: só verdadeiro em publicada ou retificada ("Escala em retificação"); `em` e `por` (ex.: "SD FULANO") são da última passagem de estado, nulos no rascunho. */
export type EstadoDoMes = { estado: EstadoDaEscala; emRetificacao: boolean; em: string | null; por: string | null };

export type Candidato = {
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  equipe: string | null;
  jornada: 'pronto' | 'adm';
  /** só no militar do Adm: a cota de saldo do mês, a barra na frente da matrícula */
  saldos?: SaldosDoMes;
  /** a pré-escala o pôs no turno sem guarnição (6.40): escolhê-lo para a vaga MOVE a alocação dele (`alocacaoId`) para ela, em vez de criar outra */
  noTurno?: { alocacaoId: string };
  /** serviços da escala em que ele pode entrar nesta faixa, na ordem da escala */
  servicos: { servicoId: string; turnoId: string; nome: string }[];
};

/**
 * O que choca com a vaga (6.38). `alocacao`: o serviço em que o militar já está (a escala e a unidade dele); `expediente`: o militar está de expediente no dia.
 * `podeResolver`: quem pede pode "tirar de lá e escalar aqui" (alocação: pode escalar na escala de lá, que é da unidade de quem escala ou de uma de baixo;
 * expediente: o serviço da vaga pode tirar o militar do expediente e quem pede tem poder na lotação dele).
 */
export type ChoqueDoCandidato =
  | { tipo: 'alocacao'; alocacaoId: string; servico: string; data: string; inicio: string; fim: string; escala: string; unidadeSigla: string; podeResolver: boolean }
  | { tipo: 'expediente'; data: string; podeResolver: boolean };

/** Quem só não pode porque choca: cada serviço da faixa em que o choque acontece traz o seu choque (o Saldo pode tirar do expediente; o Pronto, não). */
export type CandidatoEmChoque = Omit<Candidato, 'servicos'> & { servicos: { servicoId: string; turnoId: string; nome: string; choque: ChoqueDoCandidato }[] };

export type Candidatos = {
  aptos: Candidato[];
  /** estão em choque com a vaga (outro serviço no mesmo horário, ou o expediente): aparecem com o que choca e, quando dá, o botão de resolver */
  emChoque: CandidatoEmChoque[];
  /** só não marcaram o horário no voluntariado (todas as outras regras passam): o escalante pode escalá-los combinando direto */
  semVoluntariado: Candidato[];
  fora: { motivo: string; quantidade: number }[];
  /** já escalados nesta faixa, com guarnição e função, que cumprem os requisitos desta vaga; `vaga` = a vaga que já ocupam */
  acumular: { alocacaoId: string; militarId: string; posto: string; nomeGuerra: string; matricula: string; vaga: string }[];
};

/**
 * Trocar uma alocação: pôr um militar livre no lugar (com o turno escolhido, da mesma faixa), trocar de lugar com quem já está escalado no dia, ou mudar o próprio militar
 * de função, para outra vaga livre do mesmo turno (`paraVaga`, 6.74).
 */
export const Troca = z.union([
  z.object({ militarId: Id, turnoId: Id, justificativa: Justificativa }),
  z.object({ comAlocacaoId: Id, justificativa: Justificativa }),
  z.object({ paraVaga: z.object({ guarnicaoId: Id, funcaoId: Id }), justificativa: Justificativa }),
]);
export type Troca = z.infer<typeof Troca>;

/** Um militar já escalado no dia, com onde ele está ("Ordinário, 20h–08h, Motorista do ABT"); `permuta` quando os dois serviços são ordinários. */
export type EscaladoNoDia = {
  militarId: string;
  posto: string;
  nomeGuerra: string;
  matricula: string;
  alocacoes: { alocacaoId: string; onde: string; permuta: boolean }[];
};

/** Uma vaga livre do mesmo turno, onde o militar da alocação cabe: "Motorista do ABT". */
export type VagaDoTurno = { guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string };

/** `vagas`: as vagas livres do mesmo turno onde o militar cabe (6.74), sem a que ele já ocupa; vazia no expediente lançado, que não tem escala. */
export type OpcoesDeTroca = { livres: Candidatos; escalados: EscaladoNoDia[]; vagas: VagaDoTurno[] };

/** As escalas mexidas pela troca: a tela busca de novo o que depende delas. */
export type ResultadoDaTroca = { escalas: { escalaId: string; mes: string }[] };
