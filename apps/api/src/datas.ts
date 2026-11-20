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

/** Soma `n` dias (pode ser negativo) a um dia 'aaaa-mm-dd'. */
export function somarDias(data: string, n: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
