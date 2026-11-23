// Escala dos oficiais (QOC e QOA): o mês com os turnos de 12 h, as cotas e o painel de saldo.
import { z } from 'zod';
import { Id } from './comum.ts';

export type EtapaDosOficiais = 'sem-cotas' | 'escolhas' | 'fechada' | 'encerrada';

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
  cota: number | null;
  sobra: boolean;
  escolhidos: number;
  afastamentos: { inicio: string; fim: string; tipo: string }[];
  /** O gestor marcou este oficial para a rodada do mês. Quem não participa não tem cota, vez nem turno. */
  participa: boolean;
  /** Elegível que não estava no mês anterior da unidade e ainda não foi marcado. */
  novo: boolean;
}

export interface EscalaDosOficiais {
  mes: string;
  etapa: EtapaDosOficiais;
  cotasEm: string | null;
  fechadaEm: string | null;
  encerradaEm: string | null;
  /** O serviço do mês; sem mês gravado, o do último mês da unidade. */
  servico: { id: string; nome: string } | null;
  turnosDoServico: { id: string; letra: string; inicio: string; fim: string; rotulo: 'Dia' | 'Noite' }[];
  oficiais: OficialDoMes[];
  /** O oficial da vez de escolher: o primeiro da ordem que ainda não lançou toda a cota; null quando ninguém falta. */
  vez: string | null;
  turnos: { dia: string; turnoId: string; militarId: string | null; saiuMilitarId: string | null }[];
  avisos: { dia: string; turnoId: string; militarId: string; texto: string }[];
  /** Só na resposta de uma mudança: uma frase para cada oficial que saiu da rodada e deixou turnos sem ninguém. */
  liberados?: string[];
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
  /** Turnos tirados, somados por rótulo (Dia ou Noite). */
  turnos: { rotulo: 'Dia' | 'Noite'; quantidade: number }[];
  registro: { tipo: 'mes' | 'entrada' | 'ajuste' | 'cobriu' | 'saiu'; data: string; mes: string | null; valor: number | null; texto: string }[];
}

export const ServicoDoMes = z.object({ servicoId: Id });
export const TrocaDeTurno = z.object({ militarId: Id.nullable() });
export const OrdemManual = z.object({ militarIds: z.array(Id).max(200) });
/** Quem participa da rodada do mês: a lista inteira (quem não vem fica desmarcado). */
export const Participantes = z.object({ militarIds: z.array(Id).max(200) });
export const AjusteDeSaldo = z.object({
  militarId: Id,
  valor: z.number('Informe o valor do ajuste.').refine((v) => v !== 0 && Math.abs(v) <= 100, 'Use um valor diferente de zero, de até 100 (para mais ou para menos).'),
  motivo: z.string().trim().min(1, 'Diga o motivo do ajuste.').max(200, 'Use até 200 caracteres.'),
});
export type ServicoDoMesEntrada = z.infer<typeof ServicoDoMes>;
export type TrocaDeTurnoEntrada = z.infer<typeof TrocaDeTurno>;
export type OrdemManualEntrada = z.infer<typeof OrdemManual>;
export type ParticipantesEntrada = z.infer<typeof Participantes>;
export type AjusteDeSaldoEntrada = z.infer<typeof AjusteDeSaldo>;
