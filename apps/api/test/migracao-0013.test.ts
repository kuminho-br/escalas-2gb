import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir, migrarReal as migrar } from './banco-teste.ts';

// Dados fictícios (D7): um serviço de diária da 1ª SB e cotas dele.
async function bancoAte0012(): Promise<Banco> {
  const banco = await bancoPglite();
  const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0013')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
  await migrar(banco, ate);
  return banco;
}
const aplicar0013 = async (banco: Banco) => {
  const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql'))) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
  await migrar(banco, ate);
};
async function cenario(banco: Banco) {
  const secao = (await banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
  const servico = await inserir(banco, 'servico', { unidade_id: secao, nome: 'Bioma', tipo: 'diaria', cor: '#C08A1E' });
  const cota = (origem = 'interna', mes = '2026-12-01') => inserir(banco, 'cota', { mes, unidade_id: secao, servico_id: servico, quantidade: 2, origem, prioridade: 1 });
  return { cota };
}

describe('migração 0013', () => {
  it('depois dela, a mesma cota (unidade, mês, serviço e origem) não entra duas vezes; outra origem ou outro mês entra', async () => {
    const banco = await bancoAte0012();
    const { cota } = await cenario(banco);
    await aplicar0013(banco);
    await cota('interna');
    await expect(cota('interna')).rejects.toMatchObject({ code: '23505' });
    await expect(cota('externa')).resolves.toBeTruthy();
    await expect(cota('interna', '2027-01-01')).resolves.toBeTruthy();
  });

  it('com cotas repetidas já gravadas, a migração para dizendo quantas e não apaga nada', async () => {
    const banco = await bancoAte0012();
    const { cota } = await cenario(banco);
    await cota('interna');
    await cota('interna');
    await expect(aplicar0013(banco)).rejects.toThrow(/1 cota repetida/);
    expect((await banco.query<{ n: number }>('select count(*)::int as n from cota')).rows[0]!.n).toBe(2);
  });
});
