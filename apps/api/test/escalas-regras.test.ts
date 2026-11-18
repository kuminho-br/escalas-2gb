import { describe, expect, it } from 'vitest';
import { faixasDosTurnos } from '../src/cadastros/escalas-regras.ts';

const t = (servico: string, letra: 'A' | 'B' | 'C', inicio: string, fim: string) => ({ servico, letra, inicio, fim });

describe('faixas dos turnos de uma escala', () => {
  it('serviços com o mesmo horário compartilham a faixa, e a letra acompanha', () => {
    expect(faixasDosTurnos([t('Pronto', 'A', '08:00', '20:00'), t('Pronto', 'B', '20:00', '08:00'), t('JES', 'A', '08:00', '20:00')])).toEqual({
      faixas: [
        { inicio: '08:00', fim: '20:00', letras: ['A'], servicos: ['Pronto', 'JES'] },
        { inicio: '20:00', fim: '08:00', letras: ['B'], servicos: ['Pronto'] },
      ],
      comLetra: true,
    });
  });

  it('a mesma letra com horários diferentes tira a letra de todas as colunas e ordena pelo início', () => {
    const r = faixasDosTurnos([t('Pronto', 'A', '08:00', '20:00'), t('Pronto', 'B', '20:00', '08:00'), t('Bioma', 'A', '00:00', '08:00')]);
    expect(r.comLetra).toBe(false);
    expect(r.faixas.map((f) => `${f.inicio}-${f.fim}`)).toEqual(['00:00-08:00', '08:00-20:00', '20:00-08:00']);
  });

  it('a mesma faixa com letras diferentes também tira a letra', () => {
    expect(faixasDosTurnos([t('Pronto', 'A', '08:00', '20:00'), t('Saldo', 'B', '08:00', '20:00')]).comLetra).toBe(false);
  });

  it('empatando no início, ordena pelo fim; sem turnos, nada', () => {
    expect(faixasDosTurnos([t('X', 'B', '08:00', '20:00'), t('X', 'A', '08:00', '12:00')]).faixas.map((f) => f.fim)).toEqual(['12:00', '20:00']);
    expect(faixasDosTurnos([])).toEqual({ faixas: [], comLetra: true });
  });
});
