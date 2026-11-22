import { describe, expect, it } from 'vitest';
import { formatarDevido, formatarSaldo } from '@/lib/numeros-do-saldo';

describe('os números do saldo', () => {
  it('o saldo leva sinal e duas casas, com vírgula', () => {
    expect(formatarSaldo(0.75)).toBe('+0,75');
    expect(formatarSaldo(-0.2489)).toBe('−0,25');
    expect(formatarSaldo(-0.2575)).toBe('−0,26');
    expect(formatarSaldo(12)).toBe('+12,00');
  });
  it('zero (ou quase) não leva sinal', () => {
    expect(formatarSaldo(0)).toBe('0,00');
    expect(formatarSaldo(0.004)).toBe('0,00');
    expect(formatarSaldo(-0.004)).toBe('0,00');
  });
  it('o devido tem duas casas, sem sinal', () => {
    expect(formatarDevido(8.2489)).toBe('8,25');
    expect(formatarDevido(4.2575)).toBe('4,26');
    expect(formatarDevido(0)).toBe('0,00');
  });
});
