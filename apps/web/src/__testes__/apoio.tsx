import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { Eu } from '@/api/eu';
import { criarRoteador } from '@/roteador';

export const EU_EXEMPLO: Eu = {
  usuario: { id: 'u1', nome: 'SD BM ANDRADE', email: 'andrade@exemplo.test' },
  militar: { matricula: '990001-1', postoGrad: 'SD BM', nomeGuerra: 'ANDRADE' },
  papeis: [{ papel: 'escalante', unidadeId: 'x', unidadeSigla: '1ª SB' }],
};

type Resposta = { status: number; corpo?: unknown } | 'rede';

/** Simula a API: cada caminho devolve um status e um corpo JSON, ou falha de rede. */
export function simularApi(rotas: Record<string, Resposta>) {
  const fetchFalso = vi.fn(async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const caminho = new URL(url, 'http://localhost').pathname;
    const r = rotas[caminho] ?? { status: 404 };
    if (r === 'rede') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchFalso);
  return fetchFalso;
}

export function abrir(caminho: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = criarRoteador(queryClient, createMemoryHistory({ initialEntries: [caminho] }));
  render(<RouterProvider router={router} />);
  return router;
}
