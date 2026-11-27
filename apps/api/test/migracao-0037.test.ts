import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir, migrarReal as migrar } from './banco-teste.ts';

// Entrega 6.28, Task 1: a tabela dos dias vermelhos, ligada à escala, com auditoria. Dados fictícios (D7).
let banco: Banco;
let escala: string;
let unidade: string;
const q = async <T>(sql: string, p: unknown[] = []) => (await banco.query<T>(sql, p)).rows;

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  unidade = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-M37', nome: 'Grupamento M37', mae_id: raiz, desde: '2026-01-01' });
  escala = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Oficiais de operações', titulo: 'ESCALA', militares_doc: 'escalados', dias_doc: 'com_escalados', ativa: true, distribuicao: 'rodada_de_cotas' });
});
afterAll(async () => { await banco.fechar?.(); });

describe('migração 0037: dias vermelhos', () => {
  it('migrar de novo não muda nada (a tabela já existe)', async () => {
    await migrar(banco);
    expect(await q('select 1 from dia_vermelho')).toHaveLength(0);
  });

  it('um dia vermelho por escala e dia, e a auditoria acha a unidade pela escala', async () => {
    await banco.query("insert into dia_vermelho (escala_id, dia) values ($1, '2026-12-25')", [escala]);
    await expect(banco.query("insert into dia_vermelho (escala_id, dia) values ($1, '2026-12-25')", [escala])).rejects.toMatchObject({ code: '23505' });
    const a = await q<{ unidade_id: string }>("select unidade_id from auditoria where tabela = 'dia_vermelho' and acao = 'insert'");
    expect(a).toEqual([{ unidade_id: unidade }]);
  });

  it('apagar a escala leva os dias vermelhos junto', async () => {
    await banco.query('delete from escala where id = $1', [escala]);
    expect(await q('select 1 from dia_vermelho')).toHaveLength(0);
  });
});
