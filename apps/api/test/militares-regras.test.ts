import { describe, expect, it } from 'vitest';
import { categoriaMaisAlta, pendenciasDoMilitar, situacaoNoMes } from '../src/cadastros/militares-regras.ts';

describe('situação no mês', () => {
  it('Disponível', () => {
    expect(situacaoNoMes([{ tipo: 'Férias', inicio: '2026-11-01', fim: '2026-11-30' }], '2026-12')).toBe('Disponível');
  });
  it('Férias até 12/12', () => {
    expect(situacaoNoMes([{ tipo: 'Férias', inicio: '2026-11-20', fim: '2026-12-12' }], '2026-12')).toBe('Férias até 12/12');
  });
  it('LTS de 03/12 a 20/12', () => {
    expect(situacaoNoMes([{ tipo: 'LTS', inicio: '2026-12-03', fim: '2026-12-20' }], '2026-12')).toBe('LTS de 03/12 a 20/12');
  });
  it('Curso desde 10/12', () => {
    expect(situacaoNoMes([{ tipo: 'Curso', inicio: '2026-12-10', fim: '2027-01-15' }], '2026-12')).toBe('Curso desde 10/12');
  });
  it('Férias o mês todo', () => {
    expect(situacaoNoMes([{ tipo: 'Férias', inicio: '2026-12-01', fim: '2026-12-31' }], '2026-12')).toBe('Férias o mês todo');
  });
  it('dois períodos, em ordem de início', () => {
    expect(
      situacaoNoMes(
        [
          { tipo: 'Férias', inicio: '2026-12-20', fim: '2026-12-29' },
          { tipo: 'Férias', inicio: '2026-12-02', fim: '2026-12-11' },
        ],
        '2026-12',
      ),
    ).toBe('Férias de 02/12 a 11/12 · Férias de 20/12 a 29/12');
  });
});

describe('pendências do militar', () => {
  const ok = { motorista: false, cnh: [], jornada: 'adm', equipe: null, antiguidade: 1 };
  it('nenhuma', () => expect(pendenciasDoMilitar(ok)).toEqual([]));
  it('Motorista sem categoria de CNH', () => {
    expect(pendenciasDoMilitar({ ...ok, motorista: true })).toEqual(['Motorista sem categoria de CNH']);
  });
  it('Pronto sem equipe', () => {
    expect(pendenciasDoMilitar({ ...ok, jornada: 'pronto' })).toEqual(['Pronto sem equipe']);
  });
  it('Sem lotação', () => {
    expect(pendenciasDoMilitar({ ...ok, jornada: null })).toEqual(['Sem lotação']);
  });
  it('Sem antiguidade', () => {
    expect(pendenciasDoMilitar({ ...ok, antiguidade: null })).toEqual(['Sem antiguidade']);
  });
});

describe('categoria mais alta', () => {
  it('E > D > C > B > A', () => {
    expect(categoriaMaisAlta(['B', 'D', 'A'])).toBe('D');
    expect(categoriaMaisAlta(['A'])).toBe('A');
    expect(categoriaMaisAlta([])).toBeNull();
  });
});
