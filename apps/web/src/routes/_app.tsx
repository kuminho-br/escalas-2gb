import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { consultaEu, type Eu } from '@/api/eu';
import { Topo } from '@/componentes/Topo';
import { Trilho } from '@/componentes/Trilho';
import { escolherUnidade, lerUnidadeGuardada } from '@/lib/unidade-de-trabalho';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const dados = await context.queryClient.ensureQueryData(consultaEu);
    if (!dados) throw redirect({ to: '/entrar' });
    // entrou com a senha provisória: nada abre antes de criar a senha
    if (dados.trocarSenha) throw redirect({ to: '/criar-senha' });
    // a unidade em que as telas trabalham: a última escolhida neste navegador (se ainda vale) ou a do papel mais baixo; sem nenhuma, a orientação
    const unidade = escolherUnidade(dados, lerUnidadeGuardada());
    if (!unidade) throw redirect({ to: '/sem-lotacao' });
    const eu: Eu = { ...dados, unidade };
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
