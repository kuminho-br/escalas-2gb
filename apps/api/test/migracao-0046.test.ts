import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { inserir } from './banco-teste.ts';

// Dados fictícios (D7). A migração 0046 leva cada prévia lançada (escala_previa, 0045) para escala_estado como prévia, com quem lançou e quando, e apaga a tabela antiga.
describe('migração 0046', () => {
  it('cada linha de escala_previa vira uma linha previa de escala_estado, e a tabela antiga some', async () => {
    const banco = await bancoPglite();
    const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
    for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0046')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
    await migrar(banco, ate);
    const secao = (await banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
    const escala = await inserir(banco, 'escala', { unidade_id: secao, nome: 'Ordinário', titulo: 'ESCALA', militares_doc: 'todos', dias_doc: 'todos' });
    const outra = await inserir(banco, 'escala', { unidade_id: secao, nome: 'Outra', titulo: 'ESCALA', militares_doc: 'todos', dias_doc: 'todos' });
    await banco.query("insert into escala_previa (escala_id, mes, lancada_em) values ($1, '2026-12-01', '2026-11-20T10:00:00Z'), ($2, '2027-01-01', '2026-11-21T11:30:00Z')", [escala, outra]);
    expect(await migrar(banco)).toContain('0046_escala_estado.sql');
    const linhas = (await banco.query<{ escala_id: string; mes: string; estado: string; em_retificacao: boolean; mudou_em: string }>(
      "select escala_id, to_char(mes, 'YYYY-MM-DD') as mes, estado, em_retificacao, to_char(mudou_em at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') as mudou_em from escala_estado order by mes",
    )).rows;
    expect(linhas).toEqual([
      { escala_id: escala, mes: '2026-12-01', estado: 'previa', em_retificacao: false, mudou_em: '2026-11-20T10:00:00Z' },
      { escala_id: outra, mes: '2027-01-01', estado: 'previa', em_retificacao: false, mudou_em: '2026-11-21T11:30:00Z' },
    ]);
    expect((await banco.query("select 1 from information_schema.tables where table_name = 'escala_previa'")).rows).toEqual([]);
  });
});
