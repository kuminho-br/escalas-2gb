import { describe, expect, it } from 'vitest';
import { duracaoMinutos, normalizarHora, turnosPadraoExigidos } from '../src/voluntariado.ts';

describe('turnos padrão exigidos pelo horário', () => {
  it.each([
    ['08:00', '16:00', [{ dia: 0, turno: 'A' }]],
    ['16:00', '00:00', [{ dia: 0, turno: 'A' }, { dia: 0, turno: 'B' }]],
    ['00:00', '08:00', [{ dia: -1, turno: 'B' }]],
    ['07:00', '19:00', [{ dia: -1, turno: 'B' }, { dia: 0, turno: 'A' }]],
    ['08:00', '08:00', [{ dia: 0, turno: 'A' }, { dia: 0, turno: 'B' }]],
    ['20:00', '08:00', [{ dia: 0, turno: 'B' }]],
    ['20:00', '20:00', [{ dia: 0, turno: 'B' }, { dia: 1, turno: 'A' }]],
  ])('%s às %s', (i, f, esperado) => expect(turnosPadraoExigidos(i, f)).toEqual(esperado));

  it('horário inválido', () => expect(() => turnosPadraoExigidos('25:00', '08:00')).toThrow('Horário inválido: "25:00".'));
  it('duração de 24h', () => expect(duracaoMinutos('08:00', '08:00')).toBe(1440));
  it('duração que atravessa a meia-noite', () => expect(duracaoMinutos('16:00', '00:00')).toBe(480));

  it.each([
    ['8:00', '08:00'],
    ['24:00', '00:00'],
    ['07:30', '07:30'],
    ['8h', '08:00'],
    ['8 horas', null],
    ['', null],
  ])('normalizarHora(%s)', (t, esperado) => expect(normalizarHora(t)).toBe(esperado));
});
