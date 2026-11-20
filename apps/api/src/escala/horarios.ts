// Os horários dos turnos da seção, na forma que o motor de choques recebe (chave "serviço|letra"), e o tipo de cada serviço.
// Usado pela lista "Escolher militar" (elegibilidade) e pela Grade geral.
import { montarHorarios, type Horarios } from 'dominio';
import type { Consulta } from '../banco/banco.ts';

export type Tipo = 'ordinario' | 'pjes' | 'diaria';
export const NOME_DO_TIPO: Record<Tipo, string> = { ordinario: 'Ordinário', pjes: 'PJES', diaria: 'Diária' };
/** Expediente do Adm (08h às 16h), implícito nos dias úteis; vale o turno A do serviço Expediente se a seção o tiver cadastrado. */
export const EXPEDIENTE = { servico: 'Expediente', turno: 'A', ini: 480, fim: 960 };

/** Os horários de todos os turnos dos serviços da seção (mais o expediente) e o tipo de cada serviço pelo nome ("Ordinário", "PJES", "Diária"). */
export async function horariosDaUnidade(c: Consulta, unidadeId: string): Promise<{ horarios: Horarios; tipos: Record<string, string> }> {
  const doUnidade = (
    await c.query<{ nome: string; tipo: Tipo; letra: 'A' | 'B' | 'C'; inicio: string; fim: string }>(
      `select s.nome, s.tipo, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
         from turno t join servico s on s.id = t.servico_id where s.unidade_id = $1`,
      [unidadeId],
    )
  ).rows;
  const horarios = montarHorarios(doUnidade.map((t) => ({ servico: t.nome, turno: t.letra, inicio: t.inicio, fim: t.fim }))).porChave;
  horarios[`${EXPEDIENTE.servico}|${EXPEDIENTE.turno}`] ??= { ini: EXPEDIENTE.ini, fim: EXPEDIENTE.fim, dur: EXPEDIENTE.fim - EXPEDIENTE.ini };
  const tipos = Object.fromEntries(doUnidade.map((t) => [t.nome, NOME_DO_TIPO[t.tipo]]));
  return { horarios, tipos };
}
