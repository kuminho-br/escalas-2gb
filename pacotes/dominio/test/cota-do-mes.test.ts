import { describe, expect, it } from 'vitest';
import { conferirCota } from '../src/index.ts';

// 6.72: a conferência da cota de um serviço PJES ou diária num mês, antes de escalar mais um militar num dia. Função pura: quem chama conta os escalados.
const dia = (n: number) => `2026-12-${String(n).padStart(2, '0')}`;
const base = { quantidade: 10, dias: [], escaladosNoMes: 0, escaladosPorDia: {}, data: dia(10) };

describe('conferirCota: só o total do mês', () => {
  it('10 escalados de 10 → esgotada', () => {
    expect(conferirCota({ ...base, escaladosNoMes: 10 })).toBe('esgotada');
  });

  it('9 escalados de 10 → pode', () => {
    expect(conferirCota({ ...base, escaladosNoMes: 9 })).toBeNull();
  });

  it('mais do que a cota (a cota foi reduzida abaixo do que já estava escalado) também recusa escalar mais', () => {
    expect(conferirCota({ ...base, quantidade: 4, escaladosNoMes: 6 })).toBe('esgotada');
  });
});

describe('conferirCota: o máximo do dia', () => {
  const dias = [{ data: dia(10), minimo: 1, maximo: 2 }];

  it('o dia com máximo 2 e 2 escalados nele → maximo_do_dia', () => {
    expect(conferirCota({ ...base, dias, escaladosNoMes: 2, escaladosPorDia: { [dia(10)]: 2 } })).toBe('maximo_do_dia');
  });

  it('com 1 escalado no dia, ainda cabe um', () => {
    expect(conferirCota({ ...base, dias, escaladosNoMes: 1, escaladosPorDia: { [dia(10)]: 1 } })).toBeNull();
  });

  it('o máximo de um dia não vale para os outros dias', () => {
    expect(conferirCota({ ...base, dias, data: dia(11), escaladosNoMes: 2, escaladosPorDia: { [dia(10)]: 2 } })).toBeNull();
  });

  it('o dia sem máximo (só meta) não tem teto próprio', () => {
    expect(conferirCota({ ...base, dias: [{ data: dia(10), minimo: 1, maximo: null }], escaladosNoMes: 5, escaladosPorDia: { [dia(10)]: 5 } })).toBeNull();
  });

  it('o total vem antes: cota esgotada é "esgotada", mesmo com o máximo do dia batido', () => {
    expect(conferirCota({ ...base, quantidade: 2, dias, escaladosNoMes: 2, escaladosPorDia: { [dia(10)]: 2 } })).toBe('esgotada');
  });
});

describe('conferirCota: a reserva dos dias com meta', () => {
  const dias = [{ data: dia(20), minimo: 3, maximo: null }];

  it('total 10, meta 3 no dia 20 sem ninguém, 7 escalados nos outros: escalar num dia sem meta → reservada', () => {
    expect(conferirCota({ ...base, dias, escaladosNoMes: 7, escaladosPorDia: {}, data: dia(10) })).toBe('reservada');
  });

  it('escalar no próprio dia da meta → pode', () => {
    expect(conferirCota({ ...base, dias, escaladosNoMes: 7, escaladosPorDia: {}, data: dia(20) })).toBeNull();
  });

  it('meta já cumprida não reserva: 3 escalados no dia 20, 6 nos outros, escalar num dia sem meta → pode', () => {
    expect(conferirCota({ ...base, dias, escaladosNoMes: 9, escaladosPorDia: { [dia(20)]: 3 }, data: dia(10) })).toBeNull();
  });

  it('meta pela metade reserva só o que falta (1 de 3 escalado: faltam 2)', () => {
    // 7 escalados (1 no dia 20) + 2 reservados = 9 < 10: ainda cabe um nos outros dias; com 8 escalados, não
    expect(conferirCota({ ...base, dias, escaladosNoMes: 7, escaladosPorDia: { [dia(20)]: 1 }, data: dia(10) })).toBeNull();
    expect(conferirCota({ ...base, dias, escaladosNoMes: 8, escaladosPorDia: { [dia(20)]: 1 }, data: dia(10) })).toBe('reservada');
  });

  it('duas metas somam a reserva; o dia pedido não reserva para si', () => {
    const duas = [{ data: dia(20), minimo: 2, maximo: null }, { data: dia(21), minimo: 2, maximo: null }];
    expect(conferirCota({ ...base, dias: duas, escaladosNoMes: 6, data: dia(10) })).toBe('reservada');
    expect(conferirCota({ ...base, dias: duas, escaladosNoMes: 5, data: dia(10) })).toBeNull();
    // no dia 20 só a meta do dia 21 está reservada: 6 + 2 = 8 < 10
    expect(conferirCota({ ...base, dias: duas, escaladosNoMes: 6, data: dia(20) })).toBeNull();
  });

  it('sem dias, nada é reservado: só o total vale', () => {
    expect(conferirCota({ ...base, escaladosNoMes: 9 })).toBeNull();
  });
});
