import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import type { Banco } from '../banco/banco.ts';

function mesmoSegredo(recebido: string | undefined, esperado: string | undefined): boolean {
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** /api/saude é público; /api/saude/banco consulta o banco (mantém o Supabase acordado) e exige o segredo do cron. */
export function rotasSaude(banco: Banco, cronSecret?: string): Hono {
  const r = new Hono();
  r.get('/', (c) => c.json({ ok: true }));
  r.get('/banco', async (c) => {
    if (!mesmoSegredo(c.req.header('Authorization'), cronSecret)) return c.json({ erro: 'Não autorizado' }, 401);
    await banco.query('select 1');
    return c.json({ ok: true, banco: 'ok' });
  });
  return r;
}
