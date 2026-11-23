// Escala dos oficiais (QOC e QOA): uma escala comum de rodada de cotas (entrega 6.27). O mês tem um lugar por dia e por letra de turno; o lugar é tomado por um
// lançamento de JES (à mão, só voluntário JES) ou de Saldo (a rodada de cotas, o que sobra depois dos JES). As cotas se refazem sozinhas entre "Abrir o mês" e fechar a escala.
import { z } from 'zod';
import { Data, Id } from './comum.ts';

/** `nao-aberto`: o mês ainda não foi aberto, e as cotas não existem. */
export type EtapaDosOficiais = 'nao-aberto' | 'escolhas' | 'fechada' | 'encerrada';
/** O que um lançamento é: JES (lançado à mão) ou Saldo (a rodada de cotas). */
export type ServicoDaRodada = 'jes' | 'saldo';

export interface OficialDoMes {
  militarId: string;
  matricula: string;
  posto: string;
  nomeGuerra: string;
  quadro: 'QOC' | 'QOA';
  lotacao: string;
  ordem: number;
  semAntiguidade: boolean;
  saldoAnterior: number;
  dias: number;
  devido: number | null;
  /** A cota de saldo: os lugares que sobram depois dos JES, repartidos pela presença. */
  cota: number | null;
  sobra: boolean;
  /** Quantos lugares de Saldo o oficial já tomou no mês. */
  escolhidos: number;
  /** Quantos lugares de JES ele tomou no mês (não contam na cota de saldo). */
  jes: number;
  /** Quantos lugares em dia vermelho o oficial tomou no mês, de JES ou de Saldo (todos pesam igual; não mudam a cota). */
  vermelhos: number;
  /** É voluntário JES: só quem é pode tomar um lugar de JES. */
  voluntarioJes: boolean;
  afastamentos: { inicio: string; fim: string; tipo: string }[];
  /** O gestor marcou este oficial para a rodada do mês. Quem não participa não tem cota, vez nem turno. */
  participa: boolean;
  /** Elegível que não estava no mês anterior da unidade e ainda não foi marcado. */
  novo: boolean;
}

export interface EscalaDosOficiais {
  mes: string;
  etapa: EtapaDosOficiais;
  abertaEm: string | null;
  fechadaEm: string | null;
  encerradaEm: string | null;
  /** A escala da rodada de cotas em que a tela trabalha; null se a unidade ainda não tem uma. */
  escala: { id: string; nome: string } | null;
  /** As escalas da unidade com rodada de cotas (o campo "Escala" da tela). */
  escalas: { id: string; nome: string }[];
  /** Os dois serviços da escala: JES (o de nome "JES") e Saldo (o outro). */
  servicos: { jes: { id: string; nome: string } | null; saldo: { id: string; nome: string } | null };
  /** Os lugares de cada dia, por letra: os turnos do serviço de Saldo (o horário de cada lugar). */
  turnosDoServico: { id: string; letra: string; inicio: string; fim: string; rotulo: 'Dia' | 'Noite' }[];
  oficiais: OficialDoMes[];
  /** O oficial da vez de escolher: o primeiro da ordem que ainda não lançou toda a cota de saldo; null quando ninguém falta. A vez é só uma sugestão. */
  vez: string | null;
  /** Um item para cada lugar do mês (dia e letra), depois de aberto o mês; `turnoId` é o do serviço de Saldo naquela letra. */
  turnos: { dia: string; letra: string; turnoId: string; servico: ServicoDaRodada | null; alocacaoId: string | null; militarId: string | null; saiuMilitarId: string | null }[];
  /** Quantos lugares o mês tem para a rodada de Saldo: os lugares do mês menos os de JES. */
  lugaresDeSaldo: number;
  /** A cota de JES da unidade no mês: `cota` é a soma das cotas do serviço JES da escala no mês (null sem cadastro) e `usados`, os JES lançados no mês em todas as escalas da unidade. Só informa: nada bloqueia. */
  jes: { cota: number | null; usados: number };
  /** Os dias vermelhos do mês (dias ruins, que ninguém quer tirar), em ordem. */
  diasVermelhos: string[];
  avisos: { dia: string; turnoId: string; militarId: string; texto: string }[];
  /** Só na resposta de uma mudança: uma frase para cada oficial que saiu da rodada e deixou lugares sem ninguém. */
  liberados?: string[];
  /** Só na resposta de um lançamento de Saldo fora da vez: "Fora da ordem: a vez era de CAP FULANO." (aviso, não impede). */
  foraDaOrdem?: string;
}

export interface OficialNoSaldo {
  militarId: string;
  matricula: string;
  posto: string;
  nomeGuerra: string;
  quadro: string | null;
  lotacao: string | null;
  saldo: number;
  meses: { mes: string; valor: number }[];
  /** Os lugares em dia vermelho que o oficial tirou nos meses encerrados. */
  vermelhos: number;
  /** Turnos tirados, somados por rótulo (Dia ou Noite). */
  turnos: { rotulo: 'Dia' | 'Noite'; quantidade: number }[];
  registro: { tipo: 'mes' | 'entrada' | 'ajuste' | 'cobriu' | 'saiu'; data: string; mes: string | null; valor: number | null; texto: string }[];
}

/** Um lançamento: o oficial toma o lugar do `dia` na `letra`, como JES ou como Saldo. */
export const Lancamento = z.object({ dia: Data, letra: z.enum(['A', 'B', 'C', 'U'], 'Escolha o turno.'), servico: z.enum(['jes', 'saldo'], 'Escolha JES ou Saldo.'), militarId: Id });
/** Os dias vermelhos do mês: a lista inteira (o que não vem deixa de ser vermelho). Cada dia é validado contra o mês na rota. */
export const DiasVermelhos = z.object({ dias: z.array(Data).max(31, 'Um mês tem no máximo 31 dias.') });
export const OrdemManual = z.object({ militarIds: z.array(Id).max(200) });
/** Quem participa da rodada do mês: a lista inteira (quem não vem fica desmarcado). */
export const Participantes = z.object({ militarIds: z.array(Id).max(200) });
export const AjusteDeSaldo = z.object({
  militarId: Id,
  valor: z.number('Informe o valor do ajuste.').refine((v) => v !== 0 && Math.abs(v) <= 100, 'Use um valor diferente de zero, de até 100 (para mais ou para menos).'),
  motivo: z.string().trim().min(1, 'Diga o motivo do ajuste.').max(200, 'Use até 200 caracteres.'),
});
export type LancamentoEntrada = z.infer<typeof Lancamento>;
export type DiasVermelhosEntrada = z.infer<typeof DiasVermelhos>;
export type OrdemManualEntrada = z.infer<typeof OrdemManual>;
export type ParticipantesEntrada = z.infer<typeof Participantes>;
export type AjusteDeSaldoEntrada = z.infer<typeof AjusteDeSaldo>;
