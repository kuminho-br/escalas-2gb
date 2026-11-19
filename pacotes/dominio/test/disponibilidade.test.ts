import { describe, expect, it } from 'vitest';
import { blocosDoDia, cortesDoDia, turnoCoberto, unirFaixas, type Faixa } from '../src/disponibilidade.ts';

// Os serviços da 1ª SB que pedem voluntariado: PE Seguro (00–08, 08–16, 16–00), Bioma (08–16) e CPRH (08–20).
const HOJE = [
  { inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '00:00' },
  { inicio: '08:00', fim: '16:00' }, { inicio: '08:00', fim: '20:00' },
];

describe('cortes e blocos do dia', () => {
  it('os cortes são os inícios e fins dos turnos, mais 00h e 24h, sem repetir e em ordem', () => {
    expect(cortesDoDia(HOJE)).toEqual([0, 480, 960, 1200, 1440]);
  });

  it('um serviço novo das 06h às 12h cria os cortes que faltam sozinho', () => {
    expect(cortesDoDia([...HOJE, { inicio: '06:00', fim: '12:00' }])).toEqual([0, 360, 480, 720, 960, 1200, 1440]);
  });

  it('o turno que atravessa a meia-noite corta no início e no fim, e "24:00" fecha o dia', () => {
    expect(cortesDoDia([{ inicio: '20:00', fim: '08:00' }])).toEqual([0, 480, 1200, 1440]);
    expect(cortesDoDia([{ inicio: '16:00', fim: '24:00' }])).toEqual([0, 960, 1440]);
  });

  it('sem nenhum turno, o dia é um bloco só', () => {
    expect(cortesDoDia([])).toEqual([0, 1440]);
    expect(blocosDoDia([0, 1440])).toEqual([{ inicio: 0, fim: 1440 }]);
  });

  it('os blocos são os intervalos entre cortes vizinhos (hoje 4, de 8h, 8h, 4h e 4h)', () => {
    const blocos = blocosDoDia(cortesDoDia(HOJE));
    expect(blocos).toHaveLength(4);
    expect(blocos.map((b) => (b.fim - b.inicio) / 60)).toEqual([8, 8, 4, 4]);
  });
});

describe('unir faixas', () => {
  it('as encostadas e as sobrepostas viram uma só, em ordem (Review Focus 3)', () => {
    expect(unirFaixas([{ inicio: 960, fim: 1200 }, { inicio: 480, fim: 960 }, { inicio: 1200, fim: 1440 }])).toEqual([{ inicio: 480, fim: 1440 }]);
    expect(unirFaixas([{ inicio: 0, fim: 600 }, { inicio: 480, fim: 700 }, { inicio: 900, fim: 960 }])).toEqual([{ inicio: 0, fim: 700 }, { inicio: 900, fim: 960 }]);
  });

  it('as separadas ficam separadas e a entrada não é alterada', () => {
    const entrada: Faixa[] = [{ inicio: 960, fim: 1200 }, { inicio: 0, fim: 480 }];
    expect(unirFaixas(entrada)).toEqual([{ inicio: 0, fim: 480 }, { inicio: 960, fim: 1200 }]);
    expect(entrada).toEqual([{ inicio: 960, fim: 1200 }, { inicio: 0, fim: 480 }]);
  });
});

describe('um turno de serviço cabe na disponibilidade?', () => {
  const marcado = (porDia: Record<string, Faixa[]>) => (data: string) => porDia[data] ?? [];

  it('com 08h às 20h marcado: o turno das 08h às 16h cabe e o das 16h às 00h não', () => {
    const f = marcado({ '2026-11-05': [{ inicio: 480, fim: 1200 }] });
    expect(turnoCoberto(f, '2026-11-05', '08:00', '16:00')).toBe(true);
    expect(turnoCoberto(f, '2026-11-05', '16:00', '00:00')).toBe(false);
  });

  it('com 16h às 24h marcado, o turno das 16h às 00h cabe', () => {
    expect(turnoCoberto(marcado({ '2026-11-05': [{ inicio: 960, fim: 1440 }] }), '2026-11-05', '16:00', '00:00')).toBe(true);
  });

  it('faixas encostadas cobrem o turno (08–16 e 16–20 cobrem 08–20) (Review Focus 3)', () => {
    const f = marcado({ '2026-11-05': [{ inicio: 480, fim: 960 }, { inicio: 960, fim: 1200 }] });
    expect(turnoCoberto(f, '2026-11-05', '08:00', '20:00')).toBe(true);
  });

  it('faixa que cobre só em parte não basta', () => {
    expect(turnoCoberto(marcado({ '2026-11-05': [{ inicio: 480, fim: 1100 }] }), '2026-11-05', '08:00', '20:00')).toBe(false);
  });

  it('o turno das 20h às 08h do dia 30/11 pede 20–24 do dia 30 e 00–08 de 01/12 (Review Focus 1)', () => {
    const completo = marcado({ '2026-11-30': [{ inicio: 1200, fim: 1440 }], '2026-12-01': [{ inicio: 0, fim: 480 }] });
    expect(turnoCoberto(completo, '2026-11-30', '20:00', '08:00')).toBe(true);
    const semODiaSeguinte = marcado({ '2026-11-30': [{ inicio: 1200, fim: 1440 }] });
    expect(turnoCoberto(semODiaSeguinte, '2026-11-30', '20:00', '08:00')).toBe(false);
  });

  it('o turno das 00h às 08h pede só o próprio dia (não depende do último dia do mês anterior)', () => {
    expect(turnoCoberto(marcado({ '2026-11-01': [{ inicio: 0, fim: 480 }] }), '2026-11-01', '00:00', '08:00')).toBe(true);
  });

  it('o turno de 24h (08–08) pede 08–24 do dia e 00–08 do seguinte', () => {
    const f = marcado({ '2026-11-05': [{ inicio: 480, fim: 1440 }], '2026-11-06': [{ inicio: 0, fim: 480 }] });
    expect(turnoCoberto(f, '2026-11-05', '08:00', '08:00')).toBe(true);
    expect(turnoCoberto(marcado({ '2026-11-05': [{ inicio: 480, fim: 1440 }] }), '2026-11-05', '08:00', '08:00')).toBe(false);
  });

  it('dia sem nenhuma faixa não cobre turno nenhum', () => {
    expect(turnoCoberto(marcado({}), '2026-11-05', '08:00', '16:00')).toBe(false);
  });
});
