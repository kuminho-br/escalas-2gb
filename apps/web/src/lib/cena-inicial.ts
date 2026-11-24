// As contas do quadro da cena na tela inicial (6.42): a altura cheia pela largura, e quanto ele encolhe conforme a pessoa rola.

/** A altura cheia no computador: 3:1 da largura do quadro, até isto. */
export const ALTURA_MAXIMA = 300;
/** A barra em que o quadro vira ao rolar. */
export const ALTURA_MINIMA = 64;
/** No celular a altura é fixa: só a saudação e a data moram no quadro, e a cena não pode tomar a tela. */
export const ALTURA_NO_CELULAR = 200;
const PROPORCAO = 3;

/** A altura cheia do quadro. Sem medida (largura 0, antes do layout) vale o máximo, para a tela nascer do tamanho certo. */
export function alturaDaCena(larguraDoQuadro: number, celular: boolean): number {
  if (celular) return ALTURA_NO_CELULAR;
  if (larguraDoQuadro <= 0) return ALTURA_MAXIMA;
  return Math.min(ALTURA_MAXIMA, Math.round(larguraDoQuadro / PROPORCAO));
}

/**
 * O quadro no instante da rolagem: a altura entre a cheia e a barra, e `encolhido` de 0 (cheio) a 1 (barra), que o estilo usa para apertar a
 * saudação. Com menos movimento não há tamanho intermediário: cheio até a metade do caminho, barra depois.
 */
export function quadroAoRolar(alturaCheia: number, rolagem: number, menosMovimento = false): { altura: number; encolhido: number } {
  const curso = Math.max(1, alturaCheia - ALTURA_MINIMA);
  const s = Math.max(0, rolagem);
  let encolhido = Math.min(1, s / curso);
  if (menosMovimento) encolhido = encolhido < 0.5 ? 0 : 1;
  const altura = Math.round(alturaCheia - encolhido * curso);
  return { altura, encolhido: Math.round(encolhido * 1000) / 1000 };
}
