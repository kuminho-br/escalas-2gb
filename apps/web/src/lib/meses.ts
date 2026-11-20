/** Mês corrente no relógio do navegador, 'aaaa-mm'. */
export function mesAtual(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

/** Hoje no relógio do navegador, 'aaaa-mm-dd'. */
export function hoje(agora: Date = new Date()): string {
  return `${mesAtual(agora)}-${String(agora.getDate()).padStart(2, '0')}`;
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
