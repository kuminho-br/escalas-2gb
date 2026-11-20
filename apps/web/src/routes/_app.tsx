import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { consultaEu } from '@/api/eu';
import { Topo } from '@/componentes/Topo';
import { Trilho } from '@/componentes/Trilho';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const eu = await context.queryClient.ensureQueryData(consultaEu);
    if (!eu) throw redirect({ to: '/entrar' });
    return { eu };
  },
  component: Casca,
});

function Casca() {
  const { eu } = Route.useRouteContext();
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoDoMenu = useRef<HTMLButtonElement>(null);
  const fecharMenu = (devolverFoco = false) => {
    setMenuAberto(false);
    if (devolverFoco) botaoDoMenu.current?.focus();
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[84px_1fr]">
      <Trilho eu={eu} aberto={menuAberto} aoFechar={fecharMenu} />
      <div className="flex min-w-0 flex-col">
        <Topo eu={eu} aoAbrirMenu={() => setMenuAberto(true)} botaoDoMenu={botaoDoMenu} />
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
