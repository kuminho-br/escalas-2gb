// Ativação de uma guarnição: ela só conta como ativada se fechar em todo o horário em que está vinculada no dia, isto é, se
// cada função obrigatória tiver, em todos os momentos, ao menos o mínimo de militares. Dois militares de turnos menores podem
// fechar uma função de um turno maior. Regra só do sistema novo (design de 20/11/2026).
import { minutosDoDia } from './choques.ts';

/** Um trecho do dia, em minutos desde as 00h do dia em que o turno começa: [inicio, fim). O fim pode passar de 1440. */
export type Intervalo = { inicio: number; fim: number };

/** O turno vira minutos a partir das 00h do dia em que começa; o que atravessa a meia-noite passa de 1440 (20:00–08:00 = 1200–1920). */
export function intervaloDoTurno(inicio: string, fim: string): Intervalo {
  const i = minutosDoDia(inicio);
  const f = minutosDoDia(fim);
  if (i === null || f === null) throw new RangeError(`Horário ilegível: ${inicio}–${fim}`);
  return { inicio: i, fim: f <= i ? f + 1440 : f };
}

export type FuncaoExigida = { funcaoId: string; funcao: string; minimo: number };
export type Ocupacao = Intervalo & { funcaoId: string };
export type Falta = Intervalo & { funcaoId: string; funcao: string; faltam: number };

/** A união dos intervalos: em ordem, sem sobrepor e sem se encostar (o intervalo vazio some). */
export function unirIntervalos(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = intervalos.filter((x) => x.fim > x.inicio).map((x) => ({ ...x })).sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
  const uniao: Intervalo[] = [];
  for (const x of ordenados) {
    const ultimo = uniao[uniao.length - 1];
    if (ultimo && x.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, x.fim);
    else uniao.push(x);
  }
  return uniao;
}

/**
 * `horarios` é onde a guarnição precisa estar fechada (vale a união). Para cada função com mínimo, uma falta é um trecho contínuo,
 * dentro dos horários, em que há menos gente que o mínimo, com o mesmo número faltando. A ocupação fora dos horários não conta.
 * As faltas vêm na ordem da composição e, dentro da função, por início.
 */
export function avaliarAtivacao(horarios: Intervalo[], composicao: FuncaoExigida[], ocupacoes: Ocupacao[]): { ativada: boolean; faltas: Falta[] } {
  const uniao = unirIntervalos(horarios);
  const faltas: Falta[] = [];
  for (const exigida of composicao) {
    if (exigida.minimo <= 0) continue;
    const dela = ocupacoes.filter((o) => o.funcaoId === exigida.funcaoId && o.fim > o.inicio);
    for (const trecho of uniao) {
      const cortes = new Set<number>([trecho.inicio, trecho.fim]);
      for (const o of dela) {
        for (const p of [o.inicio, o.fim]) if (p > trecho.inicio && p < trecho.fim) cortes.add(p);
      }
      const pontos = [...cortes].sort((a, b) => a - b);
      let aberta: Falta | null = null;
      for (let k = 0; k + 1 < pontos.length; k++) {
        const de = pontos[k]!;
        const ate = pontos[k + 1]!;
        const presentes = dela.filter((o) => o.inicio <= de && o.fim >= ate).length;
        const faltam = Math.max(0, exigida.minimo - presentes);
        if (aberta && aberta.faltam === faltam && aberta.fim === de) {
          aberta.fim = ate;
          continue;
        }
        aberta = null;
        if (faltam > 0) {
          aberta = { funcaoId: exigida.funcaoId, funcao: exigida.funcao, faltam, inicio: de, fim: ate };
          faltas.push(aberta);
        }
      }
    }
  }
  return { ativada: uniao.length > 0 && faltas.length === 0, faltas };
}
