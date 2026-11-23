import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { criarRoteador } from '@/roteador';

export const EU_EXEMPLO: EuDaApi = {
  usuario: { id: 'u1', nome: 'SD BM ANDRADE', email: 'andrade@exemplo.test' },
  militar: { matricula: '990001-1', postoGrad: 'SD BM', nomeGuerra: 'ANDRADE' },
  papeis: [{ papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }],
  unidades: [{ id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4, tipo: 'secao' }],
  unidadesSoConsulta: [],
  lotacao: null,
  trocarSenha: false,
  nivelSoEmUnidadeExtinta: false,
};

/** `espera`: a resposta só sai quando a promessa se resolve (para testar o que acontece enquanto grava). */
type Resposta = { status: number; corpo?: unknown; espera?: Promise<unknown> } | 'rede';

/**
 * Simula a API: cada rota devolve um status e um corpo JSON, ou falha de rede.
 * A chave é 'METODO /caminho' ou só '/caminho' (qualquer método); a query não conta.
 */
export function simularApi(rotas: Record<string, Resposta>) {
  const fetchFalso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const caminho = new URL(url, 'http://localhost').pathname;
    const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase();
    const r = rotas[`${metodo} ${caminho}`] ?? rotas[caminho] ?? { status: 404 };
    if (r === 'rede') throw new TypeError('Failed to fetch');
    if (r.espera) await r.espera;
    // 204 e afins não têm corpo (o Response recusa um)
    const semCorpo = [204, 205, 304].includes(r.status);
    return new Response(semCorpo ? null : JSON.stringify(r.corpo ?? {}), { status: r.status, headers: semCorpo ? undefined : { 'Content-Type': 'application/json' } });
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

/** Corpo JSON da última chamada a 'METODO /caminho'. */
export function corpoEnviado(fetchFalso: ReturnType<typeof simularApi>, rota: string): unknown {
  const [metodo, caminho] = rota.split(' ');
  const chamada = fetchFalso.mock.calls.filter(([e, init]) => {
    const url = typeof e === 'string' ? e : e instanceof URL ? e.href : e.url;
    return new URL(url, 'http://localhost').pathname === caminho && (init?.method ?? 'GET').toUpperCase() === metodo;
  }).at(-1);
  if (!chamada) throw new Error(`Nenhuma chamada a ${rota}`);
  return JSON.parse(String(chamada[1]?.body));
}

/** Quantas vezes 'METODO /caminho' foi chamado. */
export function chamadasA(fetchFalso: ReturnType<typeof simularApi>, rota: string): number {
  const [metodo, caminho] = rota.split(' ');
  return fetchFalso.mock.calls.filter(([e, init]) => {
    const url = typeof e === 'string' ? e : e instanceof URL ? e.href : e.url;
    return new URL(url, 'http://localhost').pathname === caminho && (init?.method ?? 'GET').toUpperCase() === metodo;
  }).length;
}

/** Uma promessa que se resolve quando `soltar()` é chamado. */
export function trava(): { espera: Promise<void>; soltar: () => void } {
  let soltar!: () => void;
  const espera = new Promise<void>((r) => (soltar = r));
  return { espera, soltar };
}
