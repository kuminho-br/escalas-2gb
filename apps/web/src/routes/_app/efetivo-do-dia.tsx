import { createFileRoute, redirect } from '@tanstack/react-router';

// O endereço antigo da tela (até a 3.2.2): vai para o Efetivo por dia, levando a data.
export const Route = createFileRoute('/_app/efetivo-do-dia')({
  validateSearch: (s: Record<string, unknown>): { data?: string } => ({ data: typeof s.data === 'string' ? s.data : undefined }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/efetivo-por-dia', search: search.data ? { data: search.data } : {}, replace: true });
  },
});
