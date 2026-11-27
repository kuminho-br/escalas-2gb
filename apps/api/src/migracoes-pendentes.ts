// Avisa, em vez de estourar 500, quando o código novo está no ar e o banco ainda não recebeu
// as migrações dele (no ambiente de teste elas são aplicadas à mão: pnpm --filter api db:migrar:teste).
import type { MiddlewareHandler } from 'hono';
import type { Banco } from './banco/banco.ts';
import { SCHEMA_ESPELHO } from './laboratorio/constantes.ts';

/** O Laboratório (6.59) responde com isto quando o espelho está atrás do real (ou ainda não existe): o real segue normal. */
export const MENSAGEM_LABORATORIO_EM_MANUTENCAO = 'O Laboratório está em manutenção.';
const doLaboratorio = (caminho: string) => caminho.startsWith('/api/lab/') || caminho.startsWith('/api/laboratorio/');

// A tela mostra só esta frase (quem lê é o escalante): sem comando de terminal e sem a lista dos arquivos, que vai para o log do servidor.
export const MENSAGEM_MIGRACAO_PENDENTE = 'O sistema está sendo atualizado. Tente de novo em alguns minutos; se continuar, avise o administrador.';

async function pendentesDe(banco: Banco, esperadas: string[], tabela = 'migracao_aplicada'): Promise<string[]> {
  try {
    const { rows } = await banco.query<{ nome: string }>(`select nome from ${tabela}`);
    const feitas = new Set(rows.map((r) => r.nome));
    return esperadas.filter((n) => !feitas.has(n));
  } catch (e) {
    const codigo = (e as { code?: string } | null)?.code;
    if (codigo === '42P01' || codigo === '3F000') return [...esperadas]; // a tabela de controle (ou o schema do espelho) ainda não existe
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
  let conferidoEm = -Infinity;
  // o espelho tem o seu próprio registro de migrações; só os pedidos do Laboratório dependem dele
  let espelhoEmDia = false;
  let espelhoConferidoEm = -Infinity;

  return async (c, next) => {
    if (c.req.path === '/api/saude' || c.req.path.startsWith('/api/saude/')) return next();
    if (!emDia && agora() - conferidoEm >= intervalo) {
      const pendentes = await pendentesDe(banco, esperadas);
      conferidoEm = agora();
      emDia = pendentes.length === 0;
      // a lista vai para o log uma vez por conferência (não a cada pedido)
      if (!emDia) console.error(`Faltam migrações no banco: ${pendentes.join(', ')}. Aplique-as (pnpm --filter api db:migrar:teste no ambiente de teste).`);
    }
    if (!emDia) return c.json({ erro: MENSAGEM_MIGRACAO_PENDENTE }, 503);
    if (!doLaboratorio(c.req.path)) return next();
    if (!espelhoEmDia && agora() - espelhoConferidoEm >= intervalo) {
      const pendentes = await pendentesDe(banco, esperadas, `${SCHEMA_ESPELHO}.migracao_aplicada`);
      espelhoConferidoEm = agora();
      espelhoEmDia = pendentes.length === 0;
      if (!espelhoEmDia) console.error(`Faltam migrações no espelho (Laboratório): ${pendentes.join(', ')}.`);
    }
    return espelhoEmDia ? next() : c.json({ erro: MENSAGEM_LABORATORIO_EM_MANUTENCAO }, 503);
  };
}
