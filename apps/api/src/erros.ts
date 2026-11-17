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
  for (const p of r.error.issues) {
    const k = p.path.join('.');
    if (!(k in campos)) campos[k] = p.message;
  }
  return { ok: false, resposta: c.json({ erro: 'Confira os campos destacados.', campos }, 400) };
}

const MENSAGENS: Record<string, string> = {
  '23505': 'Já existe um cadastro com esse nome.',
  '23P01': 'As datas se sobrepõem a outro período já cadastrado.',
  '23503': 'Não dá para apagar: o cadastro já está em uso.',
};

/** Erro do banco que o usuário pode resolver vira 409 legível; qualquer outro é relançado. */
export function respostaDoErroDoBanco(c: Context, e: unknown): Response {
  const codigo = (e as { code?: string } | null)?.code;
  if (codigo && codigo in MENSAGENS) return c.json({ erro: MENSAGENS[codigo]! }, 409);
  if (codigo === 'P0001') return c.json({ erro: (e as Error).message }, 409);
  throw e;
}
