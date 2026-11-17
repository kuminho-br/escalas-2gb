// Avisa, em vez de estourar 500, quando o código novo está no ar e o banco ainda não recebeu
// as migrações dele (no ambiente de teste elas são aplicadas à mão: pnpm --filter api db:migrar:teste).
import type { MiddlewareHandler } from 'hono';
import type { Banco } from './banco/banco.ts';

export const MENSAGEM_MIGRACAO_PENDENTE =
  'O banco de dados está desatualizado. Peça ao administrador para aplicar as migrações pendentes (pnpm --filter api db:migrar:teste).';

async function pendentesDe(banco: Banco, esperadas: string[]): Promise<string[]> {
  try {
    const { rows } = await banco.query<{ nome: string }>('select nome from migracao_aplicada');
    const feitas = new Set(rows.map((r) => r.nome));
    return esperadas.filter((n) => !feitas.has(n));
  } catch (e) {
    if ((e as { code?: string } | null)?.code === '42P01') return [...esperadas]; // tabela de controle ainda não existe
    throw e;
  }
}

/**
 * Responde 503 em toda rota, menos /api/saude, enquanto faltar migração. Quando o banco fica em dia,
 * não confere mais (migração não se desfaz); enquanto falta, confere de novo a cada `intervaloMs`.
 */
export function exigirMigracoesEmDia(
  banco: Banco,
  esperadas: string[],
  opcoes: { intervaloMs?: number; agora?: () => number } = {},
): MiddlewareHandler {
  const intervalo = opcoes.intervaloMs ?? 5000;
  const agora = opcoes.agora ?? Date.now;
  let emDia = false;
  let pendentes: string[] = [];
  let conferidoEm = -Infinity;

  return async (c, next) => {
    if (c.req.path === '/api/saude' || c.req.path.startsWith('/api/saude/')) return next();
    if (!emDia && agora() - conferidoEm >= intervalo) {
      pendentes = await pendentesDe(banco, esperadas);
      conferidoEm = agora();
      emDia = pendentes.length === 0;
    }
    if (emDia) return next();
    return c.json({ erro: MENSAGEM_MIGRACAO_PENDENTE, pendentes }, 503);
  };
}
