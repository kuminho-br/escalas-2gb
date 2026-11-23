const FORMATO_RECIFE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Hoje, 'aaaa-mm-dd', no fuso de Recife (o mesmo da API), seja qual for o fuso do navegador. É o "hoje" único do site. */
export function hoje(agora: Date = new Date()): string {
  return FORMATO_RECIFE.format(agora);
}

/** Mês corrente, 'aaaa-mm', no fuso de Recife. */
export function mesAtual(agora: Date = new Date()): string {
  return hoje(agora).slice(0, 7);
}

/** Soma (ou tira) dias de uma data 'aaaa-mm-dd'. */
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** '2026-12-12' -> 'sábado, 12/12/2026'. */
export function dataPorExtenso(data: string): string {
  const [a, m, d] = data.split('-');
  return `${DIAS_DA_SEMANA[new Date(`${data}T00:00:00Z`).getUTCDay()]}, ${d}/${m}/${a}`;
}

/** '2026-11-20' -> 'sexta-feira'. Segunda a sexta levam "-feira"; sábado e domingo não. */
export function diaDaSemanaPorExtenso(data: string): string {
  const n = new Date(`${data}T00:00:00Z`).getUTCDay();
  return n === 0 || n === 6 ? DIAS_DA_SEMANA[n]! : `${DIAS_DA_SEMANA[n]}-feira`;
}

/** '2026-11-20' -> '20/11/2026'. */
export function dataBr(data: string): string {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}
