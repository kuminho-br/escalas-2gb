import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hoje, mesAtual } from '@/lib/meses';

// Entrega 6.18, Task 7, item 8: "hoje" é um só, no fuso de Recife (UTC-3), seja qual for o fuso do navegador.
// o navegador da pessoa pode estar em qualquer fuso: o teste põe o do computador em UTC para provar que o resultado não depende dele
let fusoDeAntes: string | undefined;
beforeAll(() => {
  fusoDeAntes = process.env.TZ;
  process.env.TZ = 'UTC';
});
afterAll(() => {
  if (fusoDeAntes === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDeAntes;
});

describe('hoje e mesAtual pelo relógio de Recife', () => {
  it('à 01h30 UTC do dia 1º de dezembro ainda é 30 de novembro em Recife', () => {
    const instante = new Date('2026-12-01T01:30:00Z');
    expect(hoje(instante)).toBe('2026-11-30');
    expect(mesAtual(instante)).toBe('2026-11');
  });

  it('às 02h59 UTC do dia 1º de janeiro ainda é 31 de dezembro (o ano também vem de Recife)', () => {
    expect(hoje(new Date('2027-01-01T02:59:00Z'))).toBe('2026-12-31');
  });

  it('às 03h00 UTC já é o dia seguinte em Recife', () => {
    expect(hoje(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01');
    expect(mesAtual(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01');
  });
});
