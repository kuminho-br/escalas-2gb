import { PostgresDialect, type Dialect } from 'kysely';
import pg from 'pg';

export interface Consulta {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Vários comandos, sem parâmetros. */
  exec(sql: string): Promise<void>;
}

export interface Banco extends Consulta {
  transacao<T>(fn: (tx: Consulta) => Promise<T>): Promise<T>;
  fechar(): Promise<void>;
  /** Dialeto Kysely para o Better Auth, sobre a mesma conexão. */
  dialeto: Dialect;
}

/**
 * Transação em nome de um usuário: a auditoria grava `usuario_id`.
 * `set_config(..., true)` vale só até o fim da transação, então não sobra para a próxima.
 */
export function comUsuario<T>(banco: Banco, usuarioId: string, fn: (tx: Consulta) => Promise<T>): Promise<T> {
  return banco.transacao(async (tx) => {
    await tx.query("select set_config('app.usuario_id', $1, true)", [usuarioId]);
    return fn(tx);
  });
}

function consultaPg(c: pg.Pool | pg.PoolClient): Consulta {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const r = await c.query(sql, params as unknown[] | undefined);
      return { rows: r.rows as T[] };
    },
    async exec(sql: string) {
      await c.query(sql);
    },
  };
}

export function bancoPg(url: string): Banco {
  const pool = new pg.Pool({ connectionString: url, max: 3 });
  return {
    ...consultaPg(pool),
    async transacao(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('begin');
        const r = await fn(consultaPg(cliente));
        await cliente.query('commit');
        return r;
      } catch (e) {
        await cliente.query('rollback');
        throw e;
      } finally {
        cliente.release();
      }
    },
    fechar: () => pool.end(),
    dialeto: new PostgresDialect({ pool }),
  };
}
