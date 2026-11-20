import { createFileRoute, redirect } from '@tanstack/react-router';

// Endereço antigo (favoritos e links): a ficha agora fica em Configurações.
export const Route = createFileRoute('/_app/guarnicoes/$id')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/configuracoes/modelos-de-guarnicao/$id', params: { id: params.id }, replace: true });
  },
});
