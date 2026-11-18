import { textoFaixa, textoHora } from 'contratos';
import { describe, expect, it } from 'vitest';
import { corDoTexto } from '@/lib/cores';
import { fimDaRegua, segmentosDoDia, sobreposicoes } from '@/lib/turnos';

describe('textos de hora', () => {
  it('textoHora e textoFaixa', () => {
    expect(textoHora('07:30')).toBe('07h30');
    expect(textoHora('08:00')).toBe('08h');
    expect(textoHora('00:00')).toBe('00h');
    expect(textoFaixa('08:00', '20:00')).toBe('08h–20h');
  });
});

describe('cor do texto do bloco', () => {
  // [foco 19]
  it('corDoTexto', () => {
    expect(corDoTexto('#6E56A8')).toBe('#FFFFFF');
    expect(corDoTexto('#000000')).toBe('#FFFFFF');
    expect(corDoTexto('#FFFF00')).toBe('#1C2430');
    expect(corDoTexto('#FFFFFF')).toBe('#1C2430');
  });
});

describe('régua do dia', () => {
  it('Pronto: o B vai até o dia seguinte, sem partir', () =>
    expect(segmentosDoDia([{ letra: 'A', inicio: '08:00', fim: '20:00' }, { letra: 'B', inicio: '20:00', fim: '08:00' }])).toEqual([
      { letra: 'A', ini: 480, fim: 1200 },
      { letra: 'B', ini: 1200, fim: 1920 },
    ]));

  // [foco 18]
  it('turno de 24h vai de 480 a 1920', () => expect(segmentosDoDia([{ letra: 'A', inicio: '08:00', fim: '08:00' }])).toEqual([{ letra: 'A', ini: 480, fim: 1920 }]));

  it('turno que termina à meia-noite fica em 960–1440', () =>
    expect(segmentosDoDia([{ letra: 'C', inicio: '16:00', fim: '00:00' }])).toEqual([{ letra: 'C', ini: 960, fim: 1440 }]));

  it('turno da madrugada fica no começo do dia', () => expect(segmentosDoDia([{ letra: 'A', inicio: '00:00', fim: '08:00' }])).toEqual([{ letra: 'A', ini: 0, fim: 480 }]));

  it('fimDaRegua: Pronto 1920, Bioma 1440, vazio 1440', () => {
    expect(fimDaRegua(segmentosDoDia([{ letra: 'A', inicio: '08:00', fim: '20:00' }, { letra: 'B', inicio: '20:00', fim: '08:00' }]))).toBe(1920);
    expect(fimDaRegua(segmentosDoDia([{ letra: 'A', inicio: '00:00', fim: '08:00' }, { letra: 'C', inicio: '16:00', fim: '00:00' }]))).toBe(1440);
    expect(fimDaRegua([])).toBe(1440);
  });

  it('sobreposição dos dois lados da meia-noite', () =>
    expect(sobreposicoes([{ letra: 'A', inicio: '07:00', fim: '19:00' }, { letra: 'B', inicio: '18:00', fim: '08:00' }])).toEqual([
      { letras: ['A', 'B'], ini: 420, fim: 480 },
      { letras: ['A', 'B'], ini: 1080, fim: 1140 },
    ]));

  it('sobreposição do turno que passa da meia-noite com o do dia seguinte', () =>
    expect(sobreposicoes([{ letra: 'B', inicio: '20:00', fim: '08:00' }, { letra: 'C', inicio: '06:00', fim: '10:00' }])).toEqual([
      { letras: ['B', 'C'], ini: 1800, fim: 1920 },
    ]));

  // [foco 18]
  it('segmentos do mesmo turno não se sobrepõem', () => expect(sobreposicoes([{ letra: 'B', inicio: '20:00', fim: '08:00' }])).toEqual([]));

  it('turnos que só se encostam não se sobrepõem', () =>
    expect(sobreposicoes([{ letra: 'A', inicio: '08:00', fim: '20:00' }, { letra: 'B', inicio: '20:00', fim: '08:00' }])).toEqual([]));
});
