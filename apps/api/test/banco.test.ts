import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';

describe('bancoPglite', () => {
  it('cria as pastas que faltam no caminho', async () => {
    const pasta = join(mkdtempSync(join(tmpdir(), 'pglite-')), 'a', 'b');
    const banco = await bancoPglite(pasta);
    const { rows } = await banco.query<{ n: number }>('select 1 as n');
    expect(rows[0]!.n).toBe(1);
    await banco.fechar();
  }, 120_000);
});
