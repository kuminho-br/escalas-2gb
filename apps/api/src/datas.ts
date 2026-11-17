const FORMATO_RECIFE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Recife',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data de hoje ('aaaa-mm-dd') no fuso de Recife, não no do servidor. */
export function hojeRecife(agora: Date = new Date()): string {
  return FORMATO_RECIFE.format(agora);
}

/** '2026-11-17' -> '2026-11-01' */
export function inicioDoMes(dia: string): string {
  return `${dia.slice(0, 7)}-01`;
}
