import { describe, expect, it } from 'vitest';
import { textoFaixa, textoHora } from '../src/index.ts';

describe('textoHora', () => {
  it('aceita hora sem minutos ou com minuto de um dígito, sem "undefined" no texto', () => {
    expect(textoHora('08:00')).toBe('08h');
    expect(textoHora('08:30')).toBe('08h30');
    expect(textoHora('8')).toBe('8h');
    expect(textoHora('8:5')).toBe('8h5');
  });

  it('a faixa usa o mesmo texto', () => {
    expect(textoFaixa('08:00', '20:00')).toBe('08h–20h');
  });
});
