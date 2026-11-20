// A janela do dia do Efetivo por dia (as linhas de todos os cards seguem nela) e o dia guardado no navegador.
import type { GuarnicaoNoEfetivo } from 'contratos';
import { minutosDoDia } from 'dominio';

/** O horário vinculado em minutos a partir das 00h do dia; o que atravessa a meia-noite passa de 1440. */
function intervalo(h: { inicio: string; fim: string }): [number, number] | null {
  const i = minutosDoDia(h.inicio);
  const f = minutosDoDia(h.fim);
  if (i === null || f === null) return null;
  return [i, f <= i ? f + 1440 : f];
}

/** Do menor início ao maior fim do dia (horários vinculados e trechos); null quando não há nada para mostrar. */
export function janelaDoDia(guarnicoes: GuarnicaoNoEfetivo[]): { inicio: number; fim: number } | null {
  const pontos = guarnicoes.flatMap((g) => [
    ...g.horarios.flatMap((h) => intervalo(h) ?? []),
    ...g.funcoes.flatMap((f) => f.linhas.flatMap((l) => l.flatMap((t) => [t.inicio, t.fim]))),
  ]);
  if (!pontos.length) return null;
  return { inicio: Math.min(...pontos), fim: Math.max(...pontos) };
}

/** A janela do dia: do menor início ao maior fim, em minutos desde as 00h do dia. */
export type Janela = { inicio: number; fim: number };

/** A posição (em %) de um minuto do dia dentro da janela. */
export const posicao = (janela: Janela, min: number) => `${((min - janela.inicio) / (janela.fim - janela.inicio || 1)) * 100}%`;

/** A parte da janela que o trecho ocupa (0 a 1): decide se cabem o horário e a etiqueta dentro dele. */
export const fracaoDaJanela = (janela: Janela, t: { inicio: number; fim: number }) => (t.fim - t.inicio) / (janela.fim - janela.inicio || 1);

const CHAVE = 'efetivo-por-dia:ultimo-dia';

/** O último dia visto nesta tela (null sem nada guardado ou sem acesso ao navegador). */
export function ultimoDiaVisto(): string | null {
  try {
    const d = window.localStorage.getItem(CHAVE);
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  } catch {
    return null;
  }
}

export function guardarUltimoDia(data: string): void {
  try {
    window.localStorage.setItem(CHAVE, data);
  } catch {
    // sem acesso ao navegador: a tela abre em hoje da próxima vez
  }
}
