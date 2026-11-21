import { describe, expect, it } from 'vitest';
import { EdicaoAfastamento, EdicaoMilitar, NovoAfastamento, NovoMilitar } from '../src/index.ts';

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
  const base = { matricula: '990001-1', postoGradId: '00000000-0000-4000-8000-000000000001', nomeGuerra: 'ANDRADE', antiguidade: 1, voluntarioJes: false, nomeCompleto: 'João da Silva Andrade', lotacao: { equipeId: null, jornada: 'adm' as const, desde: '2026-12' } };

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

describe('ficha do Pecúlio: nascimento, e-mail e comportamento', () => {
  const mensagemDe = (campos: Record<string, unknown>) => {
    const r = EdicaoMilitar.safeParse(campos);
    return r.success ? null : r.error.issues[0]!.message;
  };

  it('nascimento: 31 de fevereiro é recusado e 29 de fevereiro passa (Review Focus 4)', () => {
    expect(mensagemDe({ nascimento: { dia: 31, mes: 2 } })).toBe('Esse dia não existe nesse mês.');
    expect(mensagemDe({ nascimento: { dia: 31, mes: 4 } })).toBe('Esse dia não existe nesse mês.');
    expect(mensagemDe({ nascimento: { dia: 29, mes: 2 } })).toBeNull();
    expect(mensagemDe({ nascimento: { dia: 31, mes: 12 } })).toBeNull();
    expect(mensagemDe({ nascimento: null })).toBeNull();
    expect(mensagemDe({ nascimento: { dia: 1, mes: 13 } })).not.toBeNull();
    expect(mensagemDe({ nascimento: { dia: 0, mes: 1 } })).not.toBeNull();
  });

  it('e-mail só do domínio institucional, em qualquer caixa; vazio (null) limpa', () => {
    expect(mensagemDe({ email: 'fulano@gmail.com' })).toBe('Use o e-mail institucional (@bombeiros.pe.gov.br).');
    expect(mensagemDe({ email: 'fulano@bombeiros.pe.gov.br.mal' })).toBe('Use o e-mail institucional (@bombeiros.pe.gov.br).');
    expect(mensagemDe({ email: 'Fulano.Silva@Bombeiros.PE.gov.br' })).toBeNull();
    expect(mensagemDe({ email: null })).toBeNull();
  });

  it('sexo e comportamento só da lista', () => {
    expect(mensagemDe({ sexo: 'M', comportamento: 'Excepcional' })).toBeNull();
    expect(mensagemDe({ sexo: 'X' })).not.toBeNull();
    expect(mensagemDe({ comportamento: 'Péssimo' })).not.toBeNull();
    for (const c of ['Excepcional', 'Ótimo', 'Bom', 'Insuficiente', 'Mau']) expect(mensagemDe({ comportamento: c })).toBeNull();
  });

  it('o boletim do comportamento e o telefone cabem no banco', () => {
    expect(mensagemDe({ comportamentoBoletim: 'b'.repeat(60) })).toBeNull();
    expect(mensagemDe({ comportamentoBoletim: 'b'.repeat(61) })).toBe('Use no máximo 60 caracteres.');
    expect(mensagemDe({ telefone: '9'.repeat(21) })).toBe('Use no máximo 20 caracteres.');
  });

  it('novo militar exige o nome completo', () => {
    const base = { matricula: '990001-1', postoGradId: '00000000-0000-4000-8000-000000000001', nomeGuerra: 'ANDRADE', antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false, lotacao: { equipeId: null, jornada: 'adm', desde: '2026-11' } };
    expect(NovoMilitar.safeParse(base).success).toBe(false);
    expect(NovoMilitar.safeParse({ ...base, nomeCompleto: '  ' }).success).toBe(false);
    const r = NovoMilitar.safeParse({ ...base, nomeCompleto: ' João da Silva Andrade ' });
    expect(r.success && r.data.nomeCompleto).toBe('João da Silva Andrade');
  });
});

describe('afastamento: motivo e boletim', () => {
  const base = { tipoAfastamentoId: '00000000-0000-4000-8000-000000000002', inicio: '2026-03-01', fim: '2026-03-02' };

  it('motivo de 201 caracteres é recusado com a mensagem no campo; 200 passa (Review Focus 5)', () => {
    const r = NovoAfastamento.safeParse({ ...base, motivo: 'a'.repeat(201) });
    expect(!r.success && r.error.issues[0]).toMatchObject({ path: ['motivo'], message: 'Use no máximo 200 caracteres.' });
    expect(NovoAfastamento.safeParse({ ...base, motivo: 'a'.repeat(200), boletim: 'b'.repeat(60) }).success).toBe(true);
    expect(NovoAfastamento.safeParse({ ...base, boletim: 'b'.repeat(61) }).success).toBe(false);
  });

  it('motivo e boletim são opcionais e podem ser limpos na edição', () => {
    expect(NovoAfastamento.safeParse(base).success).toBe(true);
    expect(EdicaoAfastamento.safeParse({ motivo: null, boletim: null }).success).toBe(true);
    expect(EdicaoAfastamento.safeParse({ motivo: 'a'.repeat(201) }).success).toBe(false);
  });
});
