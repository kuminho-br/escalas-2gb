import { describe, expect, it } from 'vitest';
import { hojeRecife, inicioDoMes } from '../src/datas.ts';

describe('datas', () => {
  it('hojeRecife usa o fuso de Recife', () => {
    expect(hojeRecife(new Date('2026-11-17T01:30:00Z'))).toBe('2026-11-16');
    expect(hojeRecife(new Date('2026-11-17T03:30:00Z'))).toBe('2026-11-17');
  });

  it('inicioDoMes', () => {
    expect(inicioDoMes('2026-11-17')).toBe('2026-11-01');
  });
});
