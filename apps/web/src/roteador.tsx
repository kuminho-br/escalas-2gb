import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { ErroAoAbrir, PaginaNaoEncontrada } from './componentes/TelasDeFalha';
import { routeTree } from './routeTree.gen';

export function criarRoteador(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultErrorComponent: ErroAoAbrir,
    defaultNotFoundComponent: PaginaNaoEncontrada,
    Wrap: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof criarRoteador>;
  }
}
