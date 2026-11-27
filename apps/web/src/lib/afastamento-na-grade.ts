// O afastado na Grade (6.70): as contas sobre os períodos que a API manda por linha (`LinhaDaGrade.afastamentos`). Tudo sai deles, sem consulta nova.
import type { AfastamentoNaGrade } from 'contratos';

export type AfastamentoDoDia = { tipo: string; comeca: boolean; termina: boolean; inicioReal: string; fimReal: string };

/** O afastamento que cobre o dia, se há: o tipo, se a marca começa ou termina nele (o tipo se escreve no primeiro dia) e o período inteiro (para a dica). */
export function afastamentoDoDia(afastamentos: AfastamentoNaGrade[], data: string): AfastamentoDoDia | null {
  const a = afastamentos.find((x) => x.inicio <= data && x.fim >= data);
  return a ? { tipo: a.tipo, comeca: a.inicio === data, termina: a.fim === data, inicioReal: a.inicioReal, fimReal: a.fimReal } : null;
}

/** O militar está afastado em todos os dias do mês mostrado (`dias`, 'aaaa-mm-dd')? Vale juntar períodos seguidos. */
export function afastadoNoMesTodo(afastamentos: AfastamentoNaGrade[], dias: string[]): boolean {
  return dias.length > 0 && dias.every((d) => afastamentos.some((a) => a.inicio <= d && a.fim >= d));
}

/**
 * O texto da dica, com o período inteiro: "Férias: 10 a 19/12"; atravessando o mês, as duas datas com o mês ("Licença: 28/11 a 6/12"); em anos diferentes, também o ano
 * ("LTS: 15/11/2026 a 15/1/2027"). Dia e mês sem zero à esquerda.
 */
export function dicaDoAfastamento(a: Pick<AfastamentoNaGrade, 'tipo' | 'inicioReal' | 'fimReal'>): string {
  const [ai, mi, di] = a.inicioReal.split('-').map(Number) as [number, number, number];
  const [af, mf, df] = a.fimReal.split('-').map(Number) as [number, number, number];
  if (ai === af && mi === mf) return `${a.tipo}: ${di} a ${df}/${mf}`;
  if (ai === af) return `${a.tipo}: ${di}/${mi} a ${df}/${mf}`;
  return `${a.tipo}: ${di}/${mi}/${ai} a ${df}/${mf}/${af}`;
}
