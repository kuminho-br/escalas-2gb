// Quando a animação do login toca inteira: uma vez a cada 12 h por navegador. Fora disso, a entrada é curta.

/** O intervalo entre duas animações inteiras, num lugar só. */
export const INTERVALO_DA_ANIMACAO_MS = 12 * 60 * 60 * 1000;
const CHAVE = 'escalas2gb.login-animacao';

export type Entrada = 'inteira' | 'curta';

/**
 * Inteira só com a cena pronta (imagem carregada e `canvas`), indo para a tela inicial, sem o pedido de menos movimento do aparelho e
 * com mais de 12 h desde a última inteira (ou nunca).
 */
export function entradaDaVez(o: { agora: number; ultimaInteira: number | null; menosMovimento: boolean; cenaPronta: boolean; destinoEhOInicio: boolean }): Entrada {
  if (o.menosMovimento || !o.cenaPronta || !o.destinoEhOInicio) return 'curta';
  if (o.ultimaInteira !== null && o.agora - o.ultimaInteira <= INTERVALO_DA_ANIMACAO_MS) return 'curta';
  return 'inteira';
}

/** O instante (em milissegundos) da última animação inteira neste navegador; null se nunca tocou ou se o navegador não deixa ler. */
export function lerUltimaInteira(): number | null {
  try {
    const v = Number(localStorage.getItem(CHAVE));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Grava a animação inteira de agora. Com o `localStorage` bloqueado, não faz nada (a animação toca inteira toda vez). */
export function marcarInteira(agora: number): void {
  try {
    localStorage.setItem(CHAVE, String(agora));
  } catch {
    // navegador que bloqueia o armazenamento: segue sem a marca
  }
}

/** O aparelho pede menos movimento? Sem `matchMedia`, não. */
export function pedeMenosMovimento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
