import { describe, expect, it } from 'vitest';
import { avaliarAtivacao, intervaloDoTurno, type FuncaoExigida, type Intervalo, type Ocupacao } from '../src/ativacao.ts';

// Minutos desde 00h do dia em que o turno começa: 08h = 480, 14h = 840, 16h = 960, 20h = 1200, 08h do dia seguinte = 1920.
const DIA: Intervalo = { inicio: 480, fim: 1200 }; // 08–20
const NOITE: Intervalo = { inicio: 1200, fim: 1920 }; // 20–08
const MOTORISTA: FuncaoExigida = { funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1 };
const AUXILIAR: FuncaoExigida = { funcaoId: 'f-aux', funcao: 'Auxiliar', minimo: 1 };

describe('intervaloDoTurno', () => {
  it('o turno de dia fica dentro do dia', () => {
    expect(intervaloDoTurno('08:00', '16:00')).toEqual({ inicio: 480, fim: 960 });
  });

  it('o turno que atravessa a meia-noite passa de 1440', () => {
    expect(intervaloDoTurno('20:00', '08:00')).toEqual({ inicio: 1200, fim: 1920 });
  });

  it('o turno de 24h vai das 08h às 08h do dia seguinte', () => {
    expect(intervaloDoTurno('08:00', '08:00')).toEqual({ inicio: 480, fim: 1920 });
  });

  it('fim à meia-noite é o fim do dia, e o banco manda segundos', () => {
    expect(intervaloDoTurno('16:00', '00:00')).toEqual({ inicio: 960, fim: 1440 });
    expect(intervaloDoTurno('08:00:00', '20:00:00')).toEqual({ inicio: 480, fim: 1200 });
  });

  it('horário ilegível é erro', () => {
    expect(() => intervaloDoTurno('abc', '08:00')).toThrow();
  });
});

describe('avaliarAtivacao', () => {
  it('o motorista cobre só 08–20 e a guarnição também é vinculada de 20–08: não ativada, com a falta da noite', () => {
    const r = avaliarAtivacao([DIA, NOITE], [MOTORISTA], [{ ...DIA, funcaoId: 'f-mot' }]);
    expect(r.ativada).toBe(false);
    expect(r.faltas).toEqual([{ funcaoId: 'f-mot', funcao: 'Motorista', faltam: 1, inicio: 1200, fim: 1920 }]);
  });

  it('dois militares de turnos menores fecham a função de um turno maior (08–16 e 16–20 para 08–20)', () => {
    const ocupacoes: Ocupacao[] = [
      { inicio: 480, fim: 960, funcaoId: 'f-aux' },
      { inicio: 960, fim: 1200, funcaoId: 'f-aux' },
    ];
    expect(avaliarAtivacao([DIA], [AUXILIAR], ocupacoes)).toEqual({ ativada: true, faltas: [] });
  });

  it('mínimo 2 com um militar em 08–20 e outro em 08–14: falta 1 de 14h às 20h', () => {
    const r = avaliarAtivacao([DIA], [{ ...AUXILIAR, minimo: 2 }], [
      { ...DIA, funcaoId: 'f-aux' },
      { inicio: 480, fim: 840, funcaoId: 'f-aux' },
    ]);
    expect(r.ativada).toBe(false);
    expect(r.faltas).toEqual([{ funcaoId: 'f-aux', funcao: 'Auxiliar', faltam: 1, inicio: 840, fim: 1200 }]);
  });

  it('duas pessoas em 08–20 para o mínimo 1: ativada, sem falta e sem contar em dobro', () => {
    const r = avaliarAtivacao([DIA], [AUXILIAR], [{ ...DIA, funcaoId: 'f-aux' }, { ...DIA, funcaoId: 'f-aux' }]);
    expect(r).toEqual({ ativada: true, faltas: [] });
  });

  it('uma falta é um trecho contínuo com o mesmo número faltando: 0 pessoas e depois 1 pessoa viram duas faltas', () => {
    const r = avaliarAtivacao([DIA], [{ ...AUXILIAR, minimo: 2 }], [{ inicio: 960, fim: 1200, funcaoId: 'f-aux' }]);
    expect(r.faltas).toEqual([
      { funcaoId: 'f-aux', funcao: 'Auxiliar', faltam: 2, inicio: 480, fim: 960 },
      { funcaoId: 'f-aux', funcao: 'Auxiliar', faltam: 1, inicio: 960, fim: 1200 },
    ]);
  });

  it('função com mínimo 0 e ninguém não gera falta', () => {
    const r = avaliarAtivacao([DIA], [{ funcaoId: 'f-chefe', funcao: 'Chefe', minimo: 0 }], []);
    expect(r).toEqual({ ativada: true, faltas: [] });
  });

  it('sem horário vinculado não há o que ativar', () => {
    expect(avaliarAtivacao([], [MOTORISTA], [{ ...DIA, funcaoId: 'f-mot' }])).toEqual({ ativada: false, faltas: [] });
  });

  it('quem entra às 06h e sai às 08h não cobre nada do horário 08–20', () => {
    const r = avaliarAtivacao([DIA], [MOTORISTA], [{ inicio: 360, fim: 480, funcaoId: 'f-mot' }]);
    expect(r.faltas).toEqual([{ funcaoId: 'f-mot', funcao: 'Motorista', faltam: 1, inicio: 480, fim: 1200 }]);
  });

  it('ocupação de outra função não cobre esta', () => {
    const r = avaliarAtivacao([DIA], [MOTORISTA], [{ ...DIA, funcaoId: 'f-aux' }]);
    expect(r.ativada).toBe(false);
  });

  it('horários que se sobrepõem valem pela união: 08–20 e 08–16 não pedem 08–16 duas vezes', () => {
    const r = avaliarAtivacao([DIA, { inicio: 480, fim: 960 }], [MOTORISTA], [{ ...DIA, funcaoId: 'f-mot' }]);
    expect(r).toEqual({ ativada: true, faltas: [] });
  });

  it('horários que se encostam (08–20 e 20–08) formam um trecho só, e a falta que atravessa a divisa não se parte', () => {
    const r = avaliarAtivacao([DIA, NOITE], [MOTORISTA], [{ inicio: 480, fim: 960, funcaoId: 'f-mot' }]);
    expect(r.faltas).toEqual([{ funcaoId: 'f-mot', funcao: 'Motorista', faltam: 1, inicio: 960, fim: 1920 }]);
  });

  it('as faltas vêm na ordem da composição e, dentro da função, por início', () => {
    const r = avaliarAtivacao([DIA], [AUXILIAR, MOTORISTA], []);
    expect(r.faltas.map((f) => f.funcao)).toEqual(['Auxiliar', 'Motorista']);
  });

  it('o horário de 24h (08h às 08h do dia seguinte) fecha com dois turnos de 12h', () => {
    const horarios = [{ inicio: 480, fim: 1920 }];
    const r = avaliarAtivacao(horarios, [MOTORISTA], [{ ...DIA, funcaoId: 'f-mot' }, { ...NOITE, funcaoId: 'f-mot' }]);
    expect(r).toEqual({ ativada: true, faltas: [] });
  });
});
