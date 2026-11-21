import { describe, expect, it } from 'vitest';
import { cnhAtende, cnhHabilitadas, cnhParaEscala } from '../src/cnh.ts';

describe('cnh: hierarquia do CTB (RN-12)', () => {
  it('categoria maior atende a menor; a menor não atende a maior', () => {
    expect(cnhAtende(['D'], ['C'])).toBe(true);
    expect(cnhAtende(['B'], ['C'])).toBe(false);
    expect(cnhAtende(['C'], ['B'])).toBe(true);
    expect(cnhAtende([], ['B'])).toBe(false);
  });

  it('A só atende A; sem exigência, qualquer um atende', () => {
    expect(cnhAtende(['D'], ['A'])).toBe(false);
    expect(cnhAtende(['A'], ['B'])).toBe(false);
    expect(cnhAtende([], [])).toBe(true);
  });

  it('AD habilita A, D, C e B', () => {
    expect(cnhHabilitadas(['A', 'D'])).toEqual(['A', 'D', 'C', 'B']);
  });
});

describe('cnhParaEscala: a CNH só vale para a escala com o militar no quadro de motoristas', () => {
  it('fora do quadro a CNH não vale, qualquer que seja a categoria', () => {
    expect(cnhParaEscala({ motorista: false, cnh: ['D'] })).toEqual([]);
    expect(cnhParaEscala({ motorista: false, cnh: ['E', 'A'] })).toEqual([]);
  });

  it('no quadro vale pela hierarquia', () => {
    expect(cnhParaEscala({ motorista: true, cnh: ['E'] })).toEqual(['E', 'D', 'C', 'B']);
    expect(cnhParaEscala({ motorista: true, cnh: ['A', 'D'] })).toEqual(['A', 'D', 'C', 'B']);
  });

  it('sem CNH cadastrada (nula ou vazia) não vale nada, com ou sem quadro', () => {
    expect(cnhParaEscala({ motorista: true, cnh: [] })).toEqual([]);
    expect(cnhParaEscala({ motorista: true, cnh: null })).toEqual([]);
    expect(cnhParaEscala({ motorista: false, cnh: undefined })).toEqual([]);
  });
});
