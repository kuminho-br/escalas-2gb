import { describe, expect, it } from 'vitest';
import { CICLO_EQUIPES } from '../src/pre-escala.ts';
import { conferirEquipeEJornada, rotuloDoCiclo, TIPOS_DE_EQUIPE } from '../src/equipes.ts';

describe('equipes como cadastro (6.64)', () => {
  it('os tipos são três e fixos no código: cada um tem comportamento no motor', () => {
    expect([...TIPOS_DE_EQUIPE]).toEqual(['pronto', 'adm', 'externa']);
  });

  it('a equipe do Pronto só combina com a jornada Pronto, e a do ADM só com a ADM', () => {
    expect(conferirEquipeEJornada('pronto', 'pronto')).toBeNull();
    expect(conferirEquipeEJornada('adm', 'adm')).toBeNull();
    expect(conferirEquipeEJornada('pronto', 'adm')).toBe('A equipe do Pronto só vale para quem é do Pronto.');
    expect(conferirEquipeEJornada('adm', 'pronto')).toBe('A equipe do ADM só vale para quem é do ADM.');
  });

  it('a Externa nunca vai para o rastreio: só se põe pelo botão Trazer, qualquer que seja a jornada', () => {
    expect(conferirEquipeEJornada('externa', 'pronto')).toBe('A Externa só se põe pelo botão Trazer.');
    expect(conferirEquipeEJornada('externa', 'adm')).toBe('A Externa só se põe pelo botão Trazer.');
  });

  it('o rótulo do ciclo vem da posição (1 a 4), nunca do nome cadastrado', () => {
    expect(rotuloDoCiclo(1)).toBe(CICLO_EQUIPES[0]);
    expect(rotuloDoCiclo(4)).toBe(CICLO_EQUIPES[3]);
    expect([1, 2, 3, 4].map(rotuloDoCiclo)).toEqual(CICLO_EQUIPES);
  });

  it('posição fora de 1 a 4 não tem rótulo: lança', () => {
    expect(() => rotuloDoCiclo(5)).toThrow();
    expect(() => rotuloDoCiclo(0)).toThrow();
  });
});
