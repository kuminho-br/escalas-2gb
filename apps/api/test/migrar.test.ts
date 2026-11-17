import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar } from '../src/banco/migrar.ts';

let banco: Banco;
let pasta: string;

beforeEach(async () => {
  banco = await bancoPglite();
  pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
});
afterEach(async () => {
  await banco.fechar();
});

describe('migrar', () => {
  it('aplica em ordem e registra', async () => {
    writeFileSync(join(pasta, '0002_b.sql'), 'create table b (id int references a(id));');
    writeFileSync(join(pasta, '0001_a.sql'), 'create table a (id int primary key);');
    expect(await migrar(banco, pasta)).toEqual(['0001_a.sql', '0002_b.sql']);
    const { rows } = await banco.query<{ nome: string }>('select nome from migracao_aplicada order by nome');
    expect(rows.map((r) => r.nome)).toEqual(['0001_a.sql', '0002_b.sql']);
  });

  it('segunda vez nao aplica nada', async () => {
    writeFileSync(join(pasta, '0001_a.sql'), 'create table a (id int primary key);');
    await migrar(banco, pasta);
    expect(await migrar(banco, pasta)).toEqual([]);
  });

  it('falha desfaz o arquivo inteiro', async () => {
    writeFileSync(join(pasta, '0001_a.sql'), 'create table a (id int primary key);\nselect * from tabela_que_nao_existe;');
    await expect(migrar(banco, pasta)).rejects.toThrow();
    const { rows } = await banco.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_name in ('a')",
    );
    expect(rows[0]!.n).toBe(0);
    const aplicadas = await banco.query<{ n: number }>('select count(*)::int as n from migracao_aplicada');
    expect(aplicadas.rows[0]!.n).toBe(0);
  });
});
