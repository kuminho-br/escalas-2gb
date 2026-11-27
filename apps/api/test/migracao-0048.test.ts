import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { inserir, migrarReal } from './banco-teste.ts';

// Dados fictícios (D7). A migração 0048 acrescenta `militar.de_teste`: a marca que diz o que é de teste. Quem já existe fica sem marca; a matrícula não diz nada.
describe('migração 0048', () => {
  it('o militar que já existia fica sem marca, e a coluna nasce falsa e obrigatória nos dois schemas', async () => {
    const banco = await bancoPglite();
    try {
      const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
      for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0048')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
      await migrarReal(banco, ate);
      const sd = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
      const antigo = await inserir(banco, 'militar', { matricula: '990321-1', posto_grad_id: sd, nome_guerra: 'ANTIGO' });

      expect(await migrar(banco)).toContain('0048_militar_de_teste.sql');
      expect((await banco.query<{ de_teste: boolean }>('select de_teste from public.militar where id = $1', [antigo])).rows[0]!.de_teste).toBe(false);
      for (const schema of ['public', 'laboratorio']) {
        const coluna = (
          await banco.query<{ data_type: string; is_nullable: string; column_default: string | null }>(
            "select data_type, is_nullable, column_default from information_schema.columns where table_schema = $1 and table_name = 'militar' and column_name = 'de_teste'",
            [schema],
          )
        ).rows[0];
        expect(coluna, schema).toEqual({ data_type: 'boolean', is_nullable: 'NO', column_default: 'false' });
      }
      // um militar novo, sem dizer nada da marca, nasce sem ela
      const novo = await inserir(banco, 'militar', { matricula: '990322-2', posto_grad_id: sd, nome_guerra: 'NOVO' });
      expect((await banco.query<{ de_teste: boolean }>('select de_teste from public.militar where id = $1', [novo])).rows[0]!.de_teste).toBe(false);
    } finally {
      await banco.fechar();
    }
  }, 60000);
});
