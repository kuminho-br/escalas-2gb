import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { TransicaoDoLogin } from '@/componentes/TransicaoDoLogin';
import { useTransicao } from '@/lib/transicao-login/armazem';
import { tituloDaAba } from '@/lib/titulo-da-aba';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Raiz,
});

/** As telas e, por cima delas, a camada da transição do login. Enquanto a cena cobre a tela, as telas por baixo não recebem foco nem cliques. */
function Raiz() {
  const { fase } = useTransicao();
  // o nome da tela na aba do navegador, a cada navegação
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    document.title = tituloDaAba(caminho);
  }, [caminho]);
  return (
    <>
      <div className="contents" inert={fase === 'cobrindo' || fase === 'afastando'}>
        <Outlet />
      </div>
      <TransicaoDoLogin />
    </>
  );
}
