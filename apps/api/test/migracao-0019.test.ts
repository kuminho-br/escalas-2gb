import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir } from './banco-teste.ts';

// Dados fictícios (D7): uma escala que já existia antes da migração. Um banco só (a memória da máquina de teste é curta).
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}
const novaEscala = (banco: Banco, unidade: string, nome: string) =>
  inserir(banco, 'escala', { unidade_id: unidade, nome, titulo: nome.toUpperCase(), militares_doc: 'todos', dias_doc: 'todos' });

let banco: Banco;
let unidade: string;
let antiga: string;
beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0019');
  unidade = (await banco.query<{ id: string }>('select id from unidade limit 1')).rows[0]!.id;
  antiga = await novaEscala(banco, unidade, 'Antiga');
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0019: escalas que montam os blocos do voluntariado', () => {
  it('a escala que já existia entra nos blocos (o comportamento de hoje), e a nova também', async () => {
    const marca = (id: string) => banco.query<{ m: boolean }>('select monta_blocos_voluntariado as m from escala where id = $1', [id]).then((r) => r.rows[0]!.m);
    expect(await marca(antiga)).toBe(true);
    expect(await marca(await novaEscala(banco, unidade, 'Nova'))).toBe(true);
  });

  it('a marca não aceita nulo', async () => {
    await expect(banco.query('update escala set monta_blocos_voluntariado = null where id = $1', [antiga])).rejects.toMatchObject({ code: '23502' });
  });
});
