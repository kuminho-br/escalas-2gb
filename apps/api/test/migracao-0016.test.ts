import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

// Dados fictícios (D7): um militar de matrícula inexistente.
let banco: Banco;
let militar: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  const posto = await inserir(banco, 'posto_grad', { sigla: 'SD-V', nome: 'Soldado V', ordem: 905 });
  militar = await inserir(banco, 'militar', { matricula: '990992-1', posto_grad_id: posto, nome_guerra: 'LANCADO' });
});
afterAll(async () => {
  await banco.fechar();
});

const lancamento = (mes: string) => inserir(banco, 'voluntariado_lancamento', { militar_id: militar, mes });

describe('migração 0016: lançamento do voluntariado', () => {
  it('o mesmo militar e mês não entram duas vezes', async () => {
    await lancamento('2026-12-01');
    await expect(lancamento('2026-12-01')).rejects.toMatchObject({ code: '23505' });
    await lancamento('2027-01-01');
  });

  it('o mês precisa ser o dia 1', async () => {
    await expect(lancamento('2026-12-15')).rejects.toMatchObject({ code: '23514' });
  });

  it('o lançamento entra na auditoria, na criação e quando é desfeito', async () => {
    const id = await lancamento('2027-02-01');
    await banco.query('delete from voluntariado_lancamento where id = $1', [id]);
    const acoes = (await banco.query<{ acao: string }>("select acao from auditoria where tabela = 'voluntariado_lancamento' and registro_id = $1 order by id", [id])).rows.map((r) => r.acao);
    expect(acoes).toEqual(['insert', 'delete']);
  });
});
