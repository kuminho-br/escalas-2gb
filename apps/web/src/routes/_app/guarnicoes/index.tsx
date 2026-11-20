import { createFileRoute, redirect } from '@tanstack/react-router';

// Endereço antigo (favoritos e links): a lista agora é a aba "Modelos de guarnição" de Configurações.
export const Route = createFileRoute('/_app/guarnicoes/')({
  beforeLoad: () => {
    throw redirect({ to: '/configuracoes', search: { aba: 'modelos' }, replace: true });
  },
});
