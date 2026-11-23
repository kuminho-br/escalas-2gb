import { createFileRoute, redirect } from '@tanstack/react-router';

// Endereço antigo (favoritos e links): a lista agora é a aba "Modelos de guarnição" de Configurações da escala.
export const Route = createFileRoute('/_app/guarnicoes/')({
  beforeLoad: () => {
    throw redirect({ to: '/configuracoes-da-escala', search: { aba: 'modelos' }, replace: true });
  },
});
