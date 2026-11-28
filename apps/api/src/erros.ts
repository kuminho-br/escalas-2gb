// Respostas de erro da API: { erro, campos? }, com a mensagem dizendo o que fazer.
import type { Context } from 'hono';
import type { z } from 'zod';

/** Lê e valida o corpo JSON; inválido vira 400 com a mensagem por campo. */
export async function lerCorpo<T>(c: Context, esquema: z.ZodType<T>): Promise<{ ok: true; dados: T } | { ok: false; resposta: Response }> {
  let bruto: unknown;
  try {
    bruto = await c.req.json();
  } catch {
    return { ok: false, resposta: c.json({ erro: 'Não foi possível ler os dados enviados.' }, 400) };
  }
  const r = esquema.safeParse(bruto);
  if (r.success) return { ok: true, dados: r.data };
  const campos: Record<string, string> = {};
  // chave que o contrato não conhece: diz qual (e não só "confira os campos")
  const desconhecidas = r.error.issues.flatMap((p) => (p.code === 'unrecognized_keys' ? (p as { keys: string[] }).keys : []));
  if (desconhecidas.length) return { ok: false, resposta: c.json({ erro: `Campo desconhecido: ${desconhecidas.join(', ')}.` }, 400) };
  for (const p of r.error.issues) {
    const k = p.path.join('.');
    if (!(k in campos)) campos[k] = p.message;
  }
  return { ok: false, resposta: c.json({ erro: 'Confira os campos destacados.', campos }, 400) };
}

const MENSAGENS: Record<string, string> = {
  '23505': 'Já existe um cadastro com esse nome.',
  '23P01': 'As datas se sobrepõem a outro período já cadastrado.',
  '23503': 'Não dá para remover: o cadastro já está em uso.',
  // duas pessoas mexendo na mesma escala ao mesmo tempo, cada uma esperando a outra (o Postgres derruba uma): a pessoa tenta de novo
  '40P01': 'Outra pessoa estava mexendo na mesma escala ao mesmo tempo. Tente de novo.',
};

// o Postgres diz "insert or update" quando a referência é de quem se grava e "update or delete" quando se tenta remover o que é referenciado
const REFERENCIA_AO_GRAVAR = 'Um dos cadastros escolhidos não existe mais. Recarregue a tela e escolha de novo.';

/**
 * Erro do banco que o usuário pode resolver vira 409 legível; qualquer outro é relançado.
 * `mensagens` troca o texto padrão de um código (ex.: matrícula repetida).
 */
export function respostaDoErroDoBanco(c: Context, e: unknown, mensagens: Record<string, string> = {}): Response {
  const codigo = (e as { code?: string } | null)?.code;
  if (codigo && codigo in mensagens) return c.json({ erro: mensagens[codigo]! }, 409);
  if (codigo === '23503' && /^insert or update/i.test((e as Error).message ?? '')) return c.json({ erro: REFERENCIA_AO_GRAVAR }, 409);
  if (codigo && codigo in MENSAGENS) return c.json({ erro: MENSAGENS[codigo]! }, 409);
  if (codigo === 'P0001') return c.json({ erro: (e as Error).message }, 409);
  throw e;
}
