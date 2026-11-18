import { describe, expect, it } from 'vitest';
import { EdicaoMilitar } from '../src/index.ts';

const mensagem = (antiguidade: unknown) => {
  const r = EdicaoMilitar.safeParse({ antiguidade });
  return r.success ? null : r.error.issues[0]!.message;
};

describe('antiguidade do militar', () => {
  it('cabe no banco: de 1 a 99999, ou vazia', () => {
    expect(mensagem(1)).toBeNull();
    expect(mensagem(99999)).toBeNull();
    expect(mensagem(null)).toBeNull();
    expect(mensagem(100000)).toBe('Use um número de 1 a 99999.');
    expect(mensagem(3_000_000_000)).toBe('Use um número de 1 a 99999.');
    expect(mensagem(0)).toBe('Use um número a partir de 1.');
  });

  it('número com vírgula pede número inteiro, em português', () => {
    expect(mensagem(1.5)).toBe('Use um número inteiro.');
  });
});
