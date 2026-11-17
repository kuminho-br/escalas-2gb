import { describe, expect, it } from 'vitest';
import { Data, Hora, Matricula, Mes, Nome, mesParaData } from '../src/index.ts';

describe('formatos comuns', () => {
  it('mês', () => {
    expect(Mes.safeParse('2026-12').success).toBe(true);
    expect(Mes.safeParse('2026-13').success).toBe(false);
  });
  it('data', () => {
    expect(Data.safeParse('2026-12-01').success).toBe(true);
    expect(Data.safeParse('01/12/2026').success).toBe(false);
  });
  it('hora', () => {
    expect(Hora.safeParse('08:00').success).toBe(true);
    expect(Hora.safeParse('24:00').success).toBe(false);
  });
  it('matrícula', () => {
    expect(Matricula.safeParse('990001-1').success).toBe(true);
    expect(Matricula.safeParse('1234567').success).toBe(false);
  });
  it('nome sem espaços nas pontas e não vazio', () => {
    expect(Nome.parse('  Férias ')).toBe('Férias');
    expect(Nome.safeParse('   ').success).toBe(false);
  });
  it('mesParaData', () => {
    expect(mesParaData('2026-12')).toBe('2026-12-01');
  });
});
