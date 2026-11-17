// PGlite (Postgres embutido): só desenvolvimento local e testes. Fica fora do pacote de produção.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { PGliteDialect } from 'kysely-pglite-dialect';
import type { Banco, Consulta } from './banco.ts';

type PgliteConsulta = Pick<PGlite, 'query' | 'exec'>;

function consultaPglite(c: PgliteConsulta): Consulta {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const r = await c.query<T>(sql, params);
      return { rows: r.rows };
    },
    async exec(sql: string) {
      await c.exec(sql);
    },
  };
}

/** Sem pasta, o banco fica em memória. */
export async function bancoPglite(pasta?: string): Promise<Banco> {
  if (pasta) mkdirSync(dirname(pasta), { recursive: true });
  const db = await PGlite.create(pasta, { extensions: { ltree, btree_gist } });
  return {
    ...consultaPglite(db),
    transacao: (fn) => db.transaction((tx) => fn(consultaPglite(tx))),
    fechar: () => db.close(),
    dialeto: new PGliteDialect(db),
  };
}
