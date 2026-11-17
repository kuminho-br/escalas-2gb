import { queryOptions } from '@tanstack/react-query';

/** Resposta de GET /api/eu (mesmo formato de apps/api/src/rotas/eu.ts). */
export interface Eu {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  papeis: { papel: 'administrador' | 'chefe' | 'escalante'; unidadeId: string; unidadeSigla: string }[];
}

/** Quem está logado; null se não houver sessão. */
export async function buscarEu(): Promise<Eu | null> {
  const r = await fetch('/api/eu', { credentials: 'include' });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error(`Falha ao consultar a sessão (${r.status})`);
  return (await r.json()) as Eu;
}

export const consultaEu = queryOptions({ queryKey: ['eu'], queryFn: buscarEu, staleTime: 60_000 });
