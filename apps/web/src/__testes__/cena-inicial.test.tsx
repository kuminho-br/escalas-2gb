import { describe, expect, it } from 'vitest';
import { ALTURA_MAXIMA, ALTURA_MINIMA, ALTURA_NO_CELULAR, alturaDaCena, quadroAoRolar } from '@/lib/cena-inicial';
import { IH, IW, POSICAO_VERTICAL, recorteDaFaixa } from '@/lib/transicao-login/recorte';
import { pousoNaFaixa } from '@/lib/transicao-login/cena';

// 6.42: a cena da tela inicial num quadro que encolhe ao rolar. As contas ficam puras para o site e a animação do login usarem a mesma.
describe('a altura do quadro', () => {
  it('no computador é 3:1 da largura do quadro, até 300 px', () => {
    expect(alturaDaCena(900, false)).toBe(300);
    expect(alturaDaCena(1200, false)).toBe(ALTURA_MAXIMA);
    expect(alturaDaCena(600, false)).toBe(200);
  });

  it('sem medida (largura 0, antes do layout) vale o máximo', () => {
    expect(alturaDaCena(0, false)).toBe(300);
  });

  it('no celular é fixa: a saudação cabe e a cena não toma a tela', () => {
    expect(alturaDaCena(366, true)).toBe(ALTURA_NO_CELULAR);
    expect(ALTURA_NO_CELULAR).toBeLessThan(ALTURA_MAXIMA);
  });
});

describe('o quadro ao rolar (Review Focus 2)', () => {
  it('encolhe junto com a rolagem, de 300 até 64 px, e não passa disso', () => {
    expect(quadroAoRolar(300, 0)).toEqual({ altura: 300, encolhido: 0 });
    expect(quadroAoRolar(300, 118)).toEqual({ altura: 182, encolhido: 0.5 });
    expect(quadroAoRolar(300, 236)).toEqual({ altura: ALTURA_MINIMA, encolhido: 1 });
    expect(quadroAoRolar(300, 5000)).toEqual({ altura: 64, encolhido: 1 });
  });

  it('voltar ao topo devolve o tamanho cheio; rolagem negativa (elástico) conta como zero', () => {
    expect(quadroAoRolar(300, -40)).toEqual({ altura: 300, encolhido: 0 });
  });

  it('com menos movimento, não há tamanhos intermediários: cheio até a metade do caminho, depois a barra', () => {
    expect(quadroAoRolar(300, 100, true)).toEqual({ altura: 300, encolhido: 0 });
    expect(quadroAoRolar(300, 120, true)).toEqual({ altura: 64, encolhido: 1 });
  });
});

describe('o recorte da imagem no quadro (Review Focus 1)', () => {
  it('a imagem cobre o quadro, centrada, com o ponto de 66% da altura dela no de 66% do quadro', () => {
    expect(POSICAO_VERTICAL).toBe(0.66);
    const r = recorteDaFaixa(900, 300);
    expect(r.escala).toBeCloseTo(900 / IW, 6);
    expect(r.x0).toBe(0);
    // cabem 512 linhas da imagem (1536 / 3); o que sobra, 512 linhas, fica 66% acima e 34% abaixo
    expect(r.y0).toBeCloseTo((IH - 512) * 0.66, 6);
  });

  it('no celular (366 por 200) a conta é a mesma', () => {
    const r = recorteDaFaixa(366, 200);
    expect(r.escala).toBeCloseTo(366 / IW, 6);
    expect(r.y0).toBeCloseTo((IH - 200 / r.escala) * 0.66, 6);
  });

  it('um quadro mais alto que a imagem (1,5:1) corta dos lados, centrado', () => {
    const r = recorteDaFaixa(300, 300);
    expect(r.escala).toBeCloseTo(300 / IH, 6);
    expect(r.y0).toBe(0);
    expect(r.x0).toBeCloseTo((IW - 300 / r.escala) / 2, 6);
  });

  it('a animação do login pousa com o mesmo recorte: a escala e o canto da imagem na tela batem com a conta do quadro', () => {
    const faixa = { left: 32, top: 80, width: 900, height: 300 };
    const p = pousoNaFaixa(faixa);
    const r = recorteDaFaixa(900, 300);
    expect(p.s1).toBeCloseTo(r.escala, 9);
    // o canto (0,0) da imagem fica em (left - x0 * escala, top - y0 * escala)
    expect(p.t1[0]).toBeCloseTo(32 - r.x0 * r.escala, 6);
    expect(p.t1[1]).toBeCloseTo(80 - r.y0 * r.escala, 6);
  });
});
