import { describe, expect, it } from 'vitest';
import { cnhAtende, cnhHabilitadas } from '../src/cnh.ts';

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
