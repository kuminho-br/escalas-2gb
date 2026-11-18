const TEXTO_ESCURO = '#1C2430';
const TEXTO_CLARO = '#FFFFFF';

function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** Texto branco ou escuro, o de maior contraste sobre o fundo (relação de contraste do WCAG). */
export function corDoTexto(fundo: string): '#FFFFFF' | '#1C2430' {
  const l = luminancia(fundo);
  const contrasteClaro = 1.05 / (l + 0.05);
  const contrasteEscuro = (l + 0.05) / (luminancia(TEXTO_ESCURO) + 0.05);
  return contrasteClaro >= contrasteEscuro ? TEXTO_CLARO : TEXTO_ESCURO;
}
