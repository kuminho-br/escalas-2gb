// Faixas de horário de uma escala: cada coluna da matriz é um horário distinto entre os turnos dos serviços dela.
import type { FaixaDaEscala, LetraTurno } from 'contratos';

type TurnoDeServico = { servico: string; letra: LetraTurno; inicio: string; fim: string };

/**
 * Faixas distintas (início e fim) dos turnos, em ordem de início e, empatando, de fim; serviços com o mesmo
 * horário compartilham a faixa. `comLetra` só vale se cada letra tem uma faixa só e cada faixa uma letra só:
 * senão a matriz mostra apenas o horário, para não misturar colunas com e sem letra.
 */
export function faixasDosTurnos(turnos: TurnoDeServico[]): { faixas: FaixaDaEscala[]; comLetra: boolean } {
  const porHorario = new Map<string, FaixaDaEscala>();
  for (const t of turnos) {
    const k = `${t.inicio}|${t.fim}`;
    const f = porHorario.get(k) ?? { inicio: t.inicio, fim: t.fim, letras: [], servicos: [] };
    porHorario.set(k, f);
    if (!f.letras.includes(t.letra)) f.letras.push(t.letra);
    if (!f.servicos.includes(t.servico)) f.servicos.push(t.servico);
  }
  const faixas = [...porHorario.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));
  for (const f of faixas) f.letras.sort();
  const faixasDaLetra = new Map<LetraTurno, Set<string>>();
  for (const f of faixas) for (const l of f.letras) faixasDaLetra.set(l, (faixasDaLetra.get(l) ?? new Set()).add(`${f.inicio}|${f.fim}`));
  const comLetra = faixas.every((f) => f.letras.length === 1) && [...faixasDaLetra.values()].every((s) => s.size === 1);
  return { faixas, comLetra };
}
