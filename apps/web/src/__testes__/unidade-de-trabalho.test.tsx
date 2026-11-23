import type { UnidadeDeTrabalho } from 'contratos';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { escolherUnidade, esquecerUnidadeDaAba, guardarUnidade, lerUnidadeGuardada } from '@/lib/unidade-de-trabalho';

const u = (id: string, sigla: string, nivel: number): UnidadeDeTrabalho => ({ id, sigla, nivel, caminho: ['CBMPE', ...Array(nivel).fill('x'), sigla], tipo: nivel === 3 ? 'grupamento' : 'secao' });
const GB = u('gb', '2º GB', 3);
const SB1 = u('sb1', '1ª SB', 4);
const SB2 = u('sb2', '2ª SB', 4);
const papel = (unidadeId: string, papel: 'gestor' | 'escalante' = 'escalante') => ({ papel, unidadeId, unidadeSigla: '' });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  esquecerUnidadeDaAba();
});

describe('escolherUnidade', () => {
  const gestor = { papeis: [papel('gb', 'gestor')], unidades: [GB, SB1, SB2], lotacao: null };

  it('vale a guardada se ainda for acessível', () => {
    expect(escolherUnidade(gestor, 'sb2')).toBe(SB2);
  });

  it('guardada inacessível cai no papel mais baixo (Review Focus 1)', () => {
    expect(escolherUnidade(gestor, 'sb-que-saiu')).toBe(GB);
  });

  it('sem guardada, vale o papel mais baixo; empate pela sigla', () => {
    expect(escolherUnidade(gestor, null)).toBe(GB);
    const duasSecoes = { papeis: [papel('sb2'), papel('sb1')], unidades: [SB1, SB2], lotacao: null };
    expect(escolherUnidade(duasSecoes, null)).toBe(SB1);
    // um papel na seção e outro no grupamento: a seção é a mais baixa
    expect(escolherUnidade({ papeis: [papel('gb', 'gestor'), papel('sb2')], unidades: [GB, SB1, SB2], lotacao: null }, null)).toBe(SB2);
  });

  it('militar comum fica na lotação', () => {
    expect(escolherUnidade({ papeis: [], unidades: [SB2], lotacao: SB2 }, 'sb1')).toBe(SB2);
  });

  it('sem unidades, devolve null', () => {
    expect(escolherUnidade({ papeis: [], unidades: [], lotacao: null }, null)).toBeNull();
  });
});

describe('unidade guardada no navegador', () => {
  it('guarda e lê', () => {
    guardarUnidade('sb1');
    expect(lerUnidadeGuardada()).toBe('sb1');
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('sb1');
  });

  it('localStorage que lança erro não quebra, e a escolha vale na sessão (Review Focus 3)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => guardarUnidade('sb2')).not.toThrow();
    expect(lerUnidadeGuardada()).toBe('sb2');
  });
});

describe('duas abas', () => {
  it('a escolha de outra aba não muda a unidade desta: vale a que esta aba já lia', () => {
    localStorage.setItem('unidade-de-trabalho', 'sb1');
    expect(lerUnidadeGuardada()).toBe('sb1');
    // a outra aba escolhe a 2ª SB
    localStorage.setItem('unidade-de-trabalho', 'sb2');
    expect(lerUnidadeGuardada()).toBe('sb1');
    // quem escolhe nesta aba vale para esta aba e fica guardado para a próxima vez
    guardarUnidade('gb');
    expect(lerUnidadeGuardada()).toBe('gb');
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('gb');
  });
});
