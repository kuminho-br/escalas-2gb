import type { AniversarianteDoMes } from 'contratos';
import { diasDoMes } from 'dominio';

/**
 * Os aniversariantes do mês agrupados por dia, só os dias que têm alguém, na ordem do mês; no mesmo dia, a ordem em que vieram (a da lista: posto, antiguidade, nome).
 * Quem nasceu num dia que o mês não tem (29 de fevereiro em ano sem dia 29) aparece no último dia do mês, que é quando se comemora.
 */
export function diasDoMesComAniversariantes(mes: string, aniversariantes: AniversarianteDoMes[]): { data: string; quem: AniversarianteDoMes[] }[] {
  const total = diasDoMes(mes).length;
  const porDia = new Map<number, AniversarianteDoMes[]>();
  for (const x of aniversariantes) {
    const dia = Math.min(Math.max(x.dia, 1), total);
    porDia.set(dia, [...(porDia.get(dia) ?? []), x]);
  }
  return [...porDia.entries()].sort(([a], [b]) => a - b).map(([dia, quem]) => ({ data: `${mes}-${String(dia).padStart(2, '0')}`, quem }));
}
