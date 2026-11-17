import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { inserir } from './banco-teste.ts';

describe('migração 0010', () => {
  it('a migração preenche o máximo vazio com o mínimo', async () => {
    const banco = await bancoPglite();
    const ate0009 = mkdtempSync(join(tmpdir(), 'migracoes-'));
    for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0010')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate0009, f));
    await migrar(banco, ate0009);
    const secao = (await banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
    const funcao = await inserir(banco, 'funcao', { unidade_id: secao, nome: 'Motorista' });
    const g = await inserir(banco, 'guarnicao', { unidade_id: secao, nome: 'ABT' });
    const v = await inserir(banco, 'guarnicao_versao', { guarnicao_id: g, vigencia_desde: '2026-11-01' });
    await inserir(banco, 'composicao', { guarnicao_versao_id: v, funcao_id: funcao, minimo: 2, maximo: null });
    expect(await migrar(banco)).toContain('0010_maximo_obrigatorio.sql');
    expect((await banco.query<{ maximo: number }>('select maximo from composicao')).rows).toEqual([{ maximo: 2 }]);
    await expect(banco.query('update composicao set maximo = null')).rejects.toThrow();
    await banco.fechar();
  });
});
