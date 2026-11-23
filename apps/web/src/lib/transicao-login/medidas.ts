/** A densidade de pixels do `canvas` é limitada a 2, para o celular fraco. */
export const DENSIDADE_MAXIMA = 2;
/** A largura interna do `canvas` não passa disto (tela larga com densidade alta pintaria milhões de pixels à toa). */
export const LARGURA_INTERNA_MAXIMA = 2560;

type Janela = {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio?: number;
  /** a área visível de verdade (no celular, sem a barra do navegador): vale mais que a janela, quando existe */
  visualViewport?: { width: number; height: number } | null;
};

/** O tamanho da camada em pixels da tela (`largura` e `altura`) e o do `canvas` (`cw` e `ch`), com a densidade limitada e a largura interna no máximo. */
export function medidasDaCamada(j: Janela): { largura: number; altura: number; cw: number; ch: number } {
  const largura = j.visualViewport?.width || j.innerWidth;
  const altura = j.visualViewport?.height || j.innerHeight;
  let densidade = Math.min(j.devicePixelRatio || 1, DENSIDADE_MAXIMA);
  if (largura * densidade > LARGURA_INTERNA_MAXIMA) densidade = LARGURA_INTERNA_MAXIMA / largura;
  return { largura, altura, cw: Math.round(largura * densidade), ch: Math.round(altura * densidade) };
}
