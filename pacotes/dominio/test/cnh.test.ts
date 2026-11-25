import { describe, expect, it } from 'vitest';
import { categoriasQueHabilitam, cnhAtende, cnhHabilitadas, cnhParaEscala, motivoDaCnh } from '../src/cnh.ts';

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

describe('motivoDaCnh: por que o militar não serve para a vaga de condutor (6.17, item 14)', () => {
  it('serve: no quadro e com a categoria (ou uma que a habilita) → nenhum motivo', () => {
    expect(motivoDaCnh({ motorista: true, cnh: ['D'] }, 'C')).toBeNull();
  });
  it('sem a carteira, ou com uma categoria que não habilita: "Sem a CNH exigida" (esteja ou não no quadro)', () => {
    expect(motivoDaCnh({ motorista: true, cnh: ['B'] }, 'D')).toBe('Sem a CNH exigida');
    expect(motivoDaCnh({ motorista: false, cnh: [] }, 'D')).toBe('Sem a CNH exigida');
    expect(motivoDaCnh({ motorista: false, cnh: ['B'] }, 'D')).toBe('Sem a CNH exigida');
  });
  it('tem a carteira que habilita, mas está fora do quadro de motoristas: "Fora do quadro de motoristas"', () => {
    expect(motivoDaCnh({ motorista: false, cnh: ['D'] }, 'D')).toBe('Fora do quadro de motoristas');
    expect(motivoDaCnh({ motorista: false, cnh: ['E'] }, 'C')).toBe('Fora do quadro de motoristas');
  });
});


describe('categoriasQueHabilitam: o filtro de CNH pela hierarquia do CTB (6.53)', () => {
  it('pedir uma categoria traz ela e as que a habilitam: B traz B, C, D e E; C traz C, D e E; D traz D e E; E só E; A só A', () => {
    expect(categoriasQueHabilitam(['B'])).toEqual(['B', 'C', 'D', 'E']);
    expect(categoriasQueHabilitam(['C'])).toEqual(['C', 'D', 'E']);
    expect(categoriasQueHabilitam(['D'])).toEqual(['D', 'E']);
    expect(categoriasQueHabilitam(['E'])).toEqual(['E']);
    expect(categoriasQueHabilitam(['A'])).toEqual(['A']);
  });

  it('várias categorias somam, sem repetir e em ordem; nada pedido, nada devolvido; categoria desconhecida não habilita ninguém', () => {
    expect(categoriasQueHabilitam(['A', 'B'])).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(categoriasQueHabilitam(['C', 'B'])).toEqual(['B', 'C', 'D', 'E']);
    expect(categoriasQueHabilitam([])).toEqual([]);
    expect(categoriasQueHabilitam(['X'])).toEqual([]);
  });
});
