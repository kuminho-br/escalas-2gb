import { describe, expect, it } from 'vitest';
import { diaDaSemana, diasDoMes, normalizar, ordemDoPosto } from '../src/nucleo.ts';

describe('nucleo', () => {
  it('meses de 28, 29 e 31 dias', () => {
    expect(diasDoMes('2028-02')).toHaveLength(29);
    expect(diasDoMes('2026-02')).toHaveLength(28);
    expect(diasDoMes('2026-12').at(-1)).toBe('2026-12-31');
    expect(diasDoMes('2026-11')[0]).toBe('2026-11-01');
  });

  it('dia da semana (0 = domingo)', () => {
    expect(diaDaSemana('2026-11-17')).toBe(2);
    expect(diaDaSemana('2026-11-15')).toBe(0);
  });

  it('acento e caixa não importam', () => {
    expect(normalizar('Eleições')).toBe(normalizar('ELEICOES'));
    expect(normalizar('pe seguro')).toBe(normalizar('PE Seguro'));
    expect(normalizar(null)).toBe('');
  });

  it('posto desconhecido vai para o fim (Infinity)', () => {
    expect(ordemDoPosto('CEL BM')).toBe(0);
    expect(ordemDoPosto('Subtenente')).toBe(ordemDoPosto('ST BM'));
    expect(ordemDoPosto('Almirante')).toBe(Infinity);
    expect(ordemDoPosto('')).toBe(Infinity);
  });
});
