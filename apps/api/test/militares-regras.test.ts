import { describe, expect, it } from 'vitest';
import { categoriaMaisAlta, pendenciasDoMilitar, repetidasPorAntiguidade, situacaoNoMes } from '../src/cadastros/militares-regras.ts';

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
  const ok = { motorista: false, cnh: [], jornada: 'adm', equipe: null, antiguidade: 1, nomeCompleto: 'Fulano de Tal' };
  it('nenhuma', () => expect(pendenciasDoMilitar(ok)).toEqual([]));
  it('Nome completo em falta (vazio ou só espaços)', () => {
    expect(pendenciasDoMilitar({ ...ok, nomeCompleto: null })).toEqual(['Nome completo em falta']);
    expect(pendenciasDoMilitar({ ...ok, nomeCompleto: '   ' })).toEqual(['Nome completo em falta']);
  });
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
  it('com três, a pendência dá os nomes', () => {
    expect(pendenciasDoMilitar({ ...ok, repetidaCom: ['A', 'B', 'C'] })).toEqual(['Antiguidade repetida com A, B, C']);
  });
  it('com quatro repetidos, a pendência dá o número', () => {
    expect(pendenciasDoMilitar({ ...ok, repetidaCom: ['A', 'B', 'C', 'D'] })).toEqual(['Antiguidade repetida com 4 militares']);
  });
  it('Antiguidade repetida com ANDRADE, BARRETO', () => {
    expect(pendenciasDoMilitar({ ...ok, repetidaCom: ['ANDRADE', 'BARRETO'] })).toEqual(['Antiguidade repetida com ANDRADE, BARRETO']);
  });
  it('repetidaCom vazio não é pendência', () => {
    expect(pendenciasDoMilitar({ ...ok, repetidaCom: [] })).toEqual([]);
  });
});

describe('antiguidade repetida', () => {
  const m = (id: string, nomeGuerra: string, antiguidade: number | null) => ({ id, nomeGuerra, antiguidade });
  it('sem repetição, o mapa fica vazio', () => {
    expect(repetidasPorAntiguidade([m('1', 'A', 1), m('2', 'B', 2)]).size).toBe(0);
  });
  it('um par aponta um para o outro', () => {
    const r = repetidasPorAntiguidade([m('1', 'A', 5), m('2', 'B', 5), m('3', 'C', 6)]);
    expect(r.get('1')).toEqual(['B']);
    expect(r.get('2')).toEqual(['A']);
    expect(r.has('3')).toBe(false);
  });
  it('um trio lista os outros dois', () => {
    const r = repetidasPorAntiguidade([m('1', 'A', 5), m('2', 'B', 5), m('3', 'C', 5)]);
    expect(r.get('2')).toEqual(['A', 'C']);
  });
  it('antiguidade vazia nunca repete', () => {
    expect(repetidasPorAntiguidade([m('1', 'A', null), m('2', 'B', null)]).size).toBe(0);
  });
});

describe('categoria mais alta', () => {
  it('E > D > C > B > A', () => {
    expect(categoriaMaisAlta(['B', 'D', 'A'])).toBe('D');
    expect(categoriaMaisAlta(['A'])).toBe('A');
    expect(categoriaMaisAlta([])).toBeNull();
  });
});
