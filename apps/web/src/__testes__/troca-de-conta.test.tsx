import { describe, expect, it } from 'vitest';
import { criarQueryClient } from '@/lib/consultas';

// 6.65 (pool 36 c): ao entrar com uma conta diferente da anterior na mesma aba, as consultas da conta anterior não aparecem, nem por um instante.
const eu = (id: string) => ({ usuario: { id, nome: id, email: `${id}@exemplo.test` } });

describe('troca de conta na mesma aba', () => {
  it('com outra conta, as consultas da anterior são descartadas e a nova fica', () => {
    const cliente = criarQueryClient();
    cliente.setQueryData(['eu'], eu('a'));
    cliente.setQueryData(['proximos-servicos'], { servicos: [{ alocacaoId: 'x' }] });
    cliente.setQueryData(['minha-escala', '2026-12'], { dias: [1] });
    cliente.setQueryData(['eu'], eu('b'));
    expect(cliente.getQueryData(['proximos-servicos'])).toBeUndefined();
    expect(cliente.getQueryData(['minha-escala', '2026-12'])).toBeUndefined();
    expect(cliente.getQueryData(['eu'])).toEqual(eu('b'));
  });

  it('a mesma conta de novo (a sessão renovada, o Sair e o entrar): o que estava em cache fica', () => {
    const cliente = criarQueryClient();
    cliente.setQueryData(['eu'], eu('a'));
    cliente.setQueryData(['proximos-servicos'], { servicos: [] });
    cliente.setQueryData(['eu'], null); // sessão que terminou
    cliente.setQueryData(['eu'], eu('a'));
    expect(cliente.getQueryData(['proximos-servicos'])).toEqual({ servicos: [] });
  });

  it('depois do Sair (null) e do login com outra conta, o cache da anterior não volta', () => {
    const cliente = criarQueryClient();
    cliente.setQueryData(['eu'], eu('a'));
    cliente.setQueryData(['proximos-servicos'], { servicos: [{ alocacaoId: 'x' }] });
    cliente.setQueryData(['eu'], null);
    cliente.setQueryData(['eu'], eu('b'));
    expect(cliente.getQueryData(['proximos-servicos'])).toBeUndefined();
  });

  it('a primeira conta da aba não descarta nada', () => {
    const cliente = criarQueryClient();
    cliente.setQueryData(['proximos-servicos'], { servicos: [] });
    cliente.setQueryData(['eu'], eu('a'));
    expect(cliente.getQueryData(['proximos-servicos'])).toEqual({ servicos: [] });
  });
});
