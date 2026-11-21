import { describe, expect, it } from 'vitest';
import { DadosEscala, LIMITE_NOME, tituloPadraoEscala } from '../src/index.ts';

describe('tituloPadraoEscala', () => {
  it('de um nome de 120 caracteres não passa de 120, e o título é aceito pelo contrato da escala', () => {
    const nome = 'a'.repeat(LIMITE_NOME);
    const titulo = tituloPadraoEscala(nome);
    expect(titulo.length).toBeLessThanOrEqual(LIMITE_NOME);
    expect(titulo.startsWith('ESCALA AAAA')).toBe(true);
    expect(DadosEscala.safeParse({ nome, titulo, militaresDoc: 'todos', diasDoc: 'todos' }).success).toBe(true);
  });

  it('um nome curto só ganha o prefixo e as maiúsculas', () => {
    expect(tituloPadraoEscala('  Ordinário ')).toBe('ESCALA ORDINÁRIO');
  });
});
