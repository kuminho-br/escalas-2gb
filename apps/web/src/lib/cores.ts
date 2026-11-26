/** A tinta do sistema (`--color-tinta` no estilo.css): o texto escuro e o que se mistura nos fundos que precisam escurecer. */
export const TINTA = '#1C2430';
const TEXTO_ESCURO = TINTA;
const TEXTO_CLARO = '#FFFFFF';

function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** Cor tão clara que some sobre o fundo branco (precisa de borda). */
export const corClara = (hex: string) => luminancia(hex) > 0.75;

/** Texto branco ou escuro, o de maior contraste sobre o fundo (relação de contraste do WCAG). */
export function corDoTexto(fundo: string): '#FFFFFF' | '#1C2430' {
  const l = luminancia(fundo);
  const contrasteClaro = 1.05 / (l + 0.05);
  const contrasteEscuro = (l + 0.05) / (luminancia(TEXTO_ESCURO) + 0.05);
  return contrasteClaro >= contrasteEscuro ? TEXTO_CLARO : TEXTO_ESCURO;
}

/** A relação de contraste do WCAG entre duas cores #RRGGBB (de 1 a 21). */
export function razaoDeContraste(a: string, b: string): number {
  const x = luminancia(a);
  const y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** O contraste mínimo entre o texto e o fundo de qualquer cor de serviço. */
export const CONTRASTE_MINIMO = 4.5;

/** A cor misturada com preto (alvo 0) ou branco (alvo 255) na proporção `parte` (0 a 1). */
function misturar(hex: string, alvo: 0 | 255, parte: number): string {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(c + (alvo - c) * parte).toString(16).padStart(2, '0');
  };
  return `#${canal(0)}${canal(1)}${canal(2)}`.toUpperCase();
}

/**
 * O fundo e o texto para mostrar uma cor de serviço com contraste de pelo menos 4,5:1. Se o melhor texto (branco ou escuro) já dá, a cor volta
 * igual; senão o fundo escurece (texto branco) ou clareia (texto escuro) em passos de 5% até chegar lá. A cor que o usuário escolheu e que
 * fica salva não muda: só a exibição.
 */
export function corLegivel(fundo: string): { fundo: string; texto: '#FFFFFF' | '#1C2430' } {
  const texto = corDoTexto(fundo);
  if (razaoDeContraste(texto, fundo) >= CONTRASTE_MINIMO) return { fundo, texto };
  const alvo = texto === TEXTO_CLARO ? 0 : 255;
  let ajustado = fundo;
  for (let passo = 1; passo <= 20; passo++) {
    ajustado = misturar(fundo, alvo, passo * 0.05);
    if (razaoDeContraste(texto, ajustado) >= CONTRASTE_MINIMO) break;
  }
  return { fundo: ajustado, texto };
}

/** `backgroundColor` e `color` (com contraste de 4,5:1) para o estilo de qualquer lugar que mostre a cor de um serviço. */
export function estiloDaCor(cor: string): { backgroundColor: string; color: string } {
  const { fundo, texto } = corLegivel(cor);
  return { backgroundColor: fundo, color: texto };
}

/** As cores da grade do Google Planilhas: 8 linhas de 10 (tons de cinza, cores vivas e quatro níveis de tom). */
export const PALETA_PLANILHAS: string[][] = [
  ['#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF'],
  ['#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF'],
  ['#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC'],
  ['#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD'],
  ['#CC4125', '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0'],
  ['#A61C00', '#CC0000', '#E69138', '#F1C232', '#6AA84F', '#45818E', '#3C78D8', '#3D85C6', '#674EA7', '#A64D79'],
  ['#85200C', '#990000', '#B45F06', '#BF9000', '#38761D', '#134F5C', '#1155CC', '#0B5394', '#351C75', '#741B47'],
  ['#5B0F00', '#660000', '#783F04', '#7F6000', '#274E13', '#0C343D', '#1C4587', '#073763', '#20124D', '#4C1130'],
];

/** '#1a2b3c' -> '#1A2B3C'; null se não for #RRGGBB. */
export function corValida(texto: string): string | null {
  const t = texto.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(t) ? t.toUpperCase() : null;
}
