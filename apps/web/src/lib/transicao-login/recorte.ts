// O recorte da imagem da cena (/boas-vindas.jpg) dentro do quadro de boas-vindas. A tela inicial e a câmera da animação do login usam
// esta conta, e só ela: se um dia mudar, muda nos dois lugares de uma vez (6.42).

/** O tamanho da imagem final. */
export const IW = 1536;
export const IH = 1024;
/** O ponto da imagem (fração da altura) que fica no mesmo ponto do quadro: o chão molhado e o engate ficam à mostra, o céu sai primeiro. */
export const POSICAO_VERTICAL = 0.66;

/**
 * A imagem cobre o quadro (`object-fit: cover`), centrada na horizontal e com `POSICAO_VERTICAL` na vertical (`object-position: center 66%`).
 * Devolve a escala (pixels da tela por pixel da imagem) e o canto da imagem que fica no canto do quadro, em coordenadas da imagem.
 */
export function recorteDaFaixa(largura: number, altura: number): { escala: number; x0: number; y0: number } {
  const escala = Math.max(largura / IW, altura / IH);
  const visivelW = largura / escala;
  const visivelH = altura / escala;
  return { escala, x0: (IW - visivelW) / 2, y0: (IH - visivelH) * POSICAO_VERTICAL };
}
