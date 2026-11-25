import { createFileRoute, redirect } from '@tanstack/react-router';

/** O endereço antigo da ficha de consulta (favoritos, links): leva à ficha dentro do Pecúlio Geral, voltando à mesma pesquisa. */
export const Route = createFileRoute('/_app/consulta_/$id')({
  validateSearch: (s: Record<string, unknown>): { texto?: string; unidade?: string } => ({
    texto: typeof s.texto === 'string' && s.texto ? s.texto : undefined,
    unidade: typeof s.unidade === 'string' && s.unidade ? s.unidade : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: '/peculio/militar/$id', params: { id: params.id }, search: { de: 'pesquisa', ...search }, replace: true });
  },
});
