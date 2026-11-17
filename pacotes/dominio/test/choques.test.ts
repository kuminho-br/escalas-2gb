import { describe, expect, it } from 'vitest';
import { detectarChoques, montarHorarios } from '../src/choques.ts';

describe('choques', () => {
  const { porChave } = montarHorarios([
    { servico: 'Pronto', turno: 'B', inicio: '20:00', fim: '08:00' },
    { servico: 'Bioma', turno: 'A', inicio: '00:00', fim: '08:00' },
  ]);

  it('turno noturno do último dia do mês choca com o dia 1 do mês seguinte', () => {
    const alocs = [
      { mat: '990001-1', dia: '2026-11-30', servico: 'Pronto', turno: 'B' },
      { mat: '990001-1', dia: '2026-12-01', servico: 'Bioma', turno: 'A' },
    ];
    const { choques } = detectarChoques(alocs, porChave, {});
    expect(choques).toHaveLength(1);
    expect(choques[0].tipo).toBe('sobreposicao');
    expect([choques[0].a.servico, choques[0].b.servico]).toEqual(['Pronto', 'Bioma']);
    expect(choques[0].minutos).toBe(480);
  });

  it('o choque aparece tanto no mês de saída quanto no de chegada', () => {
    const alocs = [
      { mat: '990001-1', dia: '2026-11-30', servico: 'Pronto', turno: 'B' },
      { mat: '990001-1', dia: '2026-12-01', servico: 'Bioma', turno: 'A' },
    ];
    expect(detectarChoques(alocs, porChave, { mes: '2026-11' }).choques).toHaveLength(1);
    expect(detectarChoques(alocs, porChave, { mes: '2026-12' }).choques).toHaveLength(1);
  });

  it('dois dias depois não choca', () => {
    const alocs = [
      { mat: '990001-1', dia: '2026-11-30', servico: 'Pronto', turno: 'B' },
      { mat: '990001-1', dia: '2026-12-02', servico: 'Bioma', turno: 'A' },
    ];
    expect(detectarChoques(alocs, porChave, {}).choques).toHaveLength(0);
  });
});
