import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TransicaoDoLogin } from '@/componentes/TransicaoDoLogin';
import { useTransicao } from '@/lib/transicao-login/armazem';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Raiz,
});

/** As telas e, por cima delas, a camada da transição do login. Enquanto a cena cobre a tela, as telas por baixo não recebem foco nem cliques. */
function Raiz() {
  const { fase } = useTransicao();
  return (
    <>
      <div className="contents" inert={fase === 'cobrindo' || fase === 'afastando'}>
        <Outlet />
      </div>
      <TransicaoDoLogin />
    </>
  );
}
