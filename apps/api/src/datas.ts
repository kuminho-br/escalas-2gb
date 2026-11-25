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

const HORA_RECIFE = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** O dia e a hora de agora no fuso de Recife: `minutos` é o que passou desde a meia-noite (de 0 a 1439). O relógio é injetável nos testes. */
export function agoraRecife(agora: Date = new Date()): { dia: string; minutos: number } {
  const partes = HORA_RECIFE.formatToParts(agora);
  const de = (tipo: string) => Number(partes.find((x) => x.type === tipo)?.value ?? 0);
  return { dia: hojeRecife(agora), minutos: de('hour') * 60 + de('minute') };
}

/** '2026-11-17' -> '2026-11-01' */
export function inicioDoMes(dia: string): string {
  return `${dia.slice(0, 7)}-01`;
}

/** Soma `n` dias (pode ser negativo) a um dia 'aaaa-mm-dd'. */
export function somarDias(data: string, n: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
