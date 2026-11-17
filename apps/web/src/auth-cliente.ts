import { createAuthClient } from 'better-auth/react';

/** Cliente do login. A API fica no mesmo endereço do site, em /api/auth. */
export const authCliente = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  basePath: '/api/auth',
  // usa o fetch global no momento da chamada (permite simular a API nos testes)
  fetchOptions: { customFetchImpl: (entrada, opcoes) => fetch(entrada, opcoes) },
});
