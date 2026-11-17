import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Banco } from './banco.ts';

export const PASTA_MIGRACOES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'banco', 'migracoes');

/** Aplica, em ordem de nome, os .sql ainda não aplicados. Cada arquivo numa transação. */
export async function migrar(banco: Banco, pasta = PASTA_MIGRACOES): Promise<string[]> {
  await banco.exec(
    'create table if not exists migracao_aplicada (nome text primary key, aplicada_em timestamptz not null default now())',
  );
  const { rows } = await banco.query<{ nome: string }>('select nome from migracao_aplicada');
  const feitas = new Set(rows.map((r) => r.nome));
  const pendentes = readdirSync(pasta)
    .filter((f) => f.endsWith('.sql') && !feitas.has(f))
    .sort();
  for (const nome of pendentes) {
    const sql = readFileSync(join(pasta, nome), 'utf8');
    await banco.transacao(async (tx) => {
      await tx.exec(sql);
      await tx.query('insert into migracao_aplicada (nome) values ($1)', [nome]);
    });
  }
  return pendentes;
}
