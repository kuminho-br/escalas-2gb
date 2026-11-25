import { createFileRoute, redirect } from '@tanstack/react-router';

/** O endereço antigo da Consulta de militares (favoritos, links): leva à tela equivalente do Pecúlio Geral, com a busca. */
export const Route = createFileRoute('/_app/consulta')({
  validateSearch: (s: Record<string, unknown>): { texto?: string; unidade?: string } => ({
    texto: typeof s.texto === 'string' && s.texto.trim() ? s.texto.trim() : undefined,
    unidade: typeof s.unidade === 'string' && s.unidade ? s.unidade : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/peculio/pesquisar', search, replace: true });
  },
});
