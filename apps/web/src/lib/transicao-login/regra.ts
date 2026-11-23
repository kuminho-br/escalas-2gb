// Quando a animação do login toca inteira: pela escolha da pessoa neste navegador (em toda entrada, uma vez a cada 12 h, que é o padrão, ou nunca).
// Fora disso, a entrada é curta.

/** O intervalo entre duas animações inteiras, num lugar só. */
export const INTERVALO_DA_ANIMACAO_MS = 12 * 60 * 60 * 1000;
const CHAVE = 'escalas2gb.login-animacao';

export type Entrada = 'inteira' | 'curta';
/** Quando a animação toca: em toda entrada, uma vez a cada 12 h (o padrão) ou nunca. */
export type Quando = 'sempre' | '12h' | 'nunca';
const CHAVE_QUANDO = 'escalas2gb.login-animacao-quando';
const QUANDOS: readonly Quando[] = ['sempre', '12h', 'nunca'];

/**
 * Inteira só com a cena pronta (imagem carregada e `canvas`), indo para a tela inicial e sem o pedido de menos movimento do aparelho (este manda,
 * qualquer que seja a escolha). Aí vale a escolha: `sempre`, `nunca`, ou `12h`, com mais de 12 h desde a última inteira (ou nunca tocou).
 */
export function entradaDaVez(o: { agora: number; ultimaInteira: number | null; menosMovimento: boolean; cenaPronta: boolean; destinoEhOInicio: boolean; quando: Quando }): Entrada {
  if (o.menosMovimento || !o.cenaPronta || !o.destinoEhOInicio || o.quando === 'nunca') return 'curta';
  if (o.quando === 'sempre') return 'inteira';
  if (o.ultimaInteira !== null && o.agora - o.ultimaInteira <= INTERVALO_DA_ANIMACAO_MS) return 'curta';
  return 'inteira';
}

/** A escolha gravada neste navegador; sem escolha, com valor estranho ou com o `localStorage` bloqueado, o padrão (`12h`). */
export function lerQuando(): Quando {
  try {
    const v = localStorage.getItem(CHAVE_QUANDO);
    return QUANDOS.find((q) => q === v) ?? '12h';
  } catch {
    return '12h';
  }
}

/** Grava a escolha neste navegador. Com o `localStorage` bloqueado, não faz nada (vale o padrão). */
export function gravarQuando(q: Quando): void {
  try {
    localStorage.setItem(CHAVE_QUANDO, q);
  } catch {
    // navegador que bloqueia o armazenamento: segue com o padrão
  }
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
