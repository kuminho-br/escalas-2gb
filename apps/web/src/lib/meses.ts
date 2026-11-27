const FORMATO_RECIFE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Hoje, 'aaaa-mm-dd', no fuso de Recife (o mesmo da API), seja qual for o fuso do navegador. É o "hoje" único do site. */
export function hoje(agora: Date = new Date()): string {
  // pelas partes, e não pelo texto pronto: a ordem do formato pronto já variou entre versões de navegador
  const p = Object.fromEntries(FORMATO_RECIFE.formatToParts(agora).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
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

const FORMATO_DATA_E_HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/** Um instante (ISO, UTC) no fuso de Recife: '2026-11-20T15:00:00.000Z' -> '20/11 às 12:00'. */
export function dataEHoraBr(instante: string): string {
  const p = Object.fromEntries(FORMATO_DATA_E_HORA.formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} às ${p.hour}:${p.minute}`;
}

/** Só o dia e o mês de um instante (ISO, UTC), no fuso de Recife: '2026-11-20T15:00:00.000Z' -> '20/11'. */
export function diaEMesBr(instante: string): string {
  return dataEHoraBr(instante).slice(0, 5);
}

const MESES_CURTOS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
/** O mês de um 'aaaa-mm' em poucas letras: '2026-12' -> 'dez. 2026'. */
export function mesCurto(mes: string): string {
  const [ano, m] = mes.split('-');
  return `${MESES_CURTOS[Number(m) - 1] ?? m} ${ano}`;
}
