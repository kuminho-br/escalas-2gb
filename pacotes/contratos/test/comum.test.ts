import { describe, expect, it } from 'vitest';
import { Data, Hora, Matricula, Mes, Nome, mesParaData, mesPorExtenso, somarMeses } from '../src/index.ts';

describe('formatos comuns', () => {
  it('mês', () => {
    expect(Mes.safeParse('2026-12').success).toBe(true);
    expect(Mes.safeParse('2026-13').success).toBe(false);
  });
  it('data', () => {
    expect(Data.safeParse('2026-12-01').success).toBe(true);
    expect(Data.safeParse('01/12/2026').success).toBe(false);
  });
  // [foco 3] uma data que não existe no calendário passava e dava erro do banco
  it('data que não existe no calendário é recusada', () => {
    expect(Data.safeParse('2026-13-45').success).toBe(false);
    expect(Data.safeParse('2026-02-30').success).toBe(false);
    expect(Data.safeParse('2025-02-29').success).toBe(false);
    expect(Data.safeParse('2024-02-29').success).toBe(true);
    expect(Data.safeParse('2026-12-31').success).toBe(true);
  });
  // [foco 3] o Postgres não tem o ano 0000: passar do contrato dava erro 500
  it('ano abaixo de 1900 é recusado em mês e em data', () => {
    expect(Mes.safeParse('0000-05').success).toBe(false);
    expect(Mes.safeParse('1899-12').success).toBe(false);
    expect(Mes.safeParse('1900-01').success).toBe(true);
    expect(Data.safeParse('0000-03-01').success).toBe(false);
    expect(Data.safeParse('0026-03-01').success).toBe(false);
    expect(Data.safeParse('1900-01-01').success).toBe(true);
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

describe('meses', () => {
  it('mesPorExtenso', () => {
    expect(mesPorExtenso('2026-12')).toBe('dezembro de 2026');
    expect(mesPorExtenso('2027-03')).toBe('março de 2027');
  });
  it('somarMeses atravessa o ano', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
  });
});
