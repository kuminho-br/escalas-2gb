import { describe, expect, it } from 'vitest';
import { EdicaoMilitar, NovoMilitar } from '../src/index.ts';

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

describe('CNH do militar sem categoria repetida', () => {
  const base = { matricula: '990001-1', postoGradId: '00000000-0000-4000-8000-000000000001', nomeGuerra: 'ANDRADE', antiguidade: 1, voluntarioJes: false, lotacao: { equipeId: null, jornada: 'adm' as const, desde: '2026-12' } };

  it('o cadastro aceita ["B", "B", "D"] e entrega ["B", "D"], em ordem', () => {
    const r = NovoMilitar.safeParse({ ...base, motorista: true, cnh: ['D', 'B', 'B'] });
    expect(r.success).toBe(true);
    expect(r.success && r.data.cnh).toEqual(['B', 'D']);
  });

  it('a edição também tira as repetidas e ordena', () => {
    const r = EdicaoMilitar.safeParse({ cnh: ['E', 'A', 'E', 'A'] });
    expect(r.success && r.data.cnh).toEqual(['A', 'E']);
    expect(EdicaoMilitar.safeParse({ cnh: [] }).success).toBe(true);
    expect(EdicaoMilitar.safeParse({}).success && EdicaoMilitar.parse({}).cnh).toBeUndefined();
  });

  it('categoria que não existe continua recusada; CNH sem o quadro de motoristas vale (a CNH é do militar)', () => {
    expect(EdicaoMilitar.safeParse({ cnh: ['B', 'Z'] }).success).toBe(false);
    const r = NovoMilitar.safeParse({ ...base, motorista: false, cnh: ['B', 'B'] });
    expect(r.success && r.data.cnh).toEqual(['B']);
  });
});
