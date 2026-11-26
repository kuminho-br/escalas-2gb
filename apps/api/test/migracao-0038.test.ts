import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal as migrar } from './banco-teste.ts';

// Entrega 6.18: a migração 0038 cria o índice de nome único sem caixa onde não há repetição e não derruba o sistema onde há. Dados fictícios (D7).
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
let u1: string;
let u2: string;
const duplicar = (sql: string, p: unknown[]) => banco.query(sql, p);

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0038');
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  u1 = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-M38A', nome: 'Grupamento A', mae_id: raiz, desde: '2026-01-01' });
  u2 = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-M38B', nome: 'Grupamento B', mae_id: raiz, desde: '2026-01-01' });
  // a unidade 2 já tem dois serviços que só diferem na caixa (de antes da regra)
  await inserir(banco, 'servico', { unidade_id: u2, nome: 'Pronto', tipo: 'ordinario', cor: '#336699' });
  await inserir(banco, 'servico', { unidade_id: u2, nome: 'PRONTO', tipo: 'ordinario', cor: '#336699' });
  await inserir(banco, 'escala', { unidade_id: u1, nome: 'Ordinario', titulo: 'T', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(banco, 'funcao', { unidade_id: u1, nome: 'Motorista' });
  await inserir(banco, 'equipe', { unidade_id: u1, nome: 'ALFA', ordem_ciclo: 1 });
  await migrar(banco);
});
afterAll(async () => {
  await banco.fechar?.();
});

describe('migração 0038: nome único sem caixa', () => {
  it('escala, função e equipe sem repetição ganham o índice: o mesmo nome com outra caixa é recusado (23505)', async () => {
    await expect(duplicar("insert into escala (unidade_id, nome, titulo, militares_doc, dias_doc) values ($1, 'ORDINARIO', 'T', 'todos', 'todos')", [u1])).rejects.toMatchObject({ code: '23505' });
    await expect(duplicar("insert into funcao (unidade_id, nome) values ($1, 'motorista')", [u1])).rejects.toMatchObject({ code: '23505' });
    await expect(duplicar("insert into equipe (unidade_id, nome, ordem_ciclo) values ($1, 'alfa', 9)", [u1])).rejects.toMatchObject({ code: '23505' });
  });

  it('unidades diferentes podem repetir o nome', async () => {
    await expect(duplicar("insert into funcao (unidade_id, nome) values ($1, 'Motorista')", [u2])).resolves.toBeDefined();
  });

  it('o serviço de uma base que já tinha repetição na caixa fica sem o índice (a migração não falha), e os outros nomes seguem normais', async () => {
    const idx = (await banco.query<{ indexname: string }>("select indexname from pg_indexes where indexname like '%_unidade_nome_sem_caixa'")).rows.map((r) => r.indexname).sort();
    expect(idx).toContain('escala_unidade_nome_sem_caixa');
    expect(idx).not.toContain('servico_unidade_nome_sem_caixa');
  });

  it('o militar ganha o e-mail pessoal, opcional', async () => {
    const col = (await banco.query<{ is_nullable: string }>("select is_nullable from information_schema.columns where table_name = 'militar' and column_name = 'email_pessoal'")).rows[0];
    expect(col?.is_nullable).toBe('YES');
  });
});

describe('migração 0038: a auditoria usa o codigo quando a tabela não tem id', () => {
  it('gravar numa tabela com chave "codigo" e sem "id" não quebra, e o registro é identificado pelo codigo', async () => {
    await banco.exec("create table teste_codigo (codigo text primary key, nome text); create trigger auditoria_registro after insert or update or delete on teste_codigo for each row execute function registrar_auditoria();");
    await banco.query("insert into teste_codigo (codigo, nome) values ('abc', 'um')");
    const { rows } = await banco.query<{ registro_id: string; acao: string }>("select registro_id, acao from auditoria where tabela = 'teste_codigo'");
    expect(rows).toEqual([{ registro_id: 'abc', acao: 'insert' }]);
  });
});
