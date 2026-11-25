import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router';
import { PesquisaDoPeculio } from '@/componentes/peculio/EstadoDaPesquisa';
import { useRef, useState } from 'react';
import { consultaEu, ehMilitarComum, type Eu } from '@/api/eu';
import { ProvedorDeResposta } from '@/componentes/resposta/ProvedorDeResposta';
import { Topo } from '@/componentes/Topo';
import { Trilho } from '@/componentes/Trilho';
import { FaixaSoConsulta } from '@/componentes/FaixaSoConsulta';
import { moduloDoEndereco, TELAS_DE_LEITURA } from '@/lib/modulos';
import { escolherUnidade, lerUnidadeDeConsulta, lerUnidadeGuardada } from '@/lib/unidade-de-trabalho';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const dados = await context.queryClient.ensureQueryData(consultaEu);
    if (!dados) throw redirect({ to: '/entrar' });
    // entrou com a senha provisória: nada abre antes de criar a senha
    if (dados.trocarSenha) throw redirect({ to: '/criar-senha' });
    // a unidade em que as telas trabalham: a de consulta escolhida nesta aba, a última escolhida neste navegador (se ainda vale) ou a do papel mais baixo; sem nenhuma, a orientação
    const unidade = escolherUnidade(dados, lerUnidadeGuardada(), lerUnidadeDeConsulta());
    if (!unidade) throw redirect({ to: '/sem-lotacao' });
    const eu: Eu = { ...dados, unidade, soConsulta: dados.unidadesSoConsulta.some((u) => u.id === unidade.id) };
    // quem abre o endereço de um módulo que não vê volta ao início, com o aviso (a barreira é só da tela; a API confere o papel de qualquer jeito)
    const modulo = moduloDoEndereco(location.pathname, location.search as Record<string, unknown>);
    if (modulo && !modulo.ve(eu)) throw redirect({ to: '/', search: { aviso: 'outro-papel' } });
    // o Pecúlio é de todos, mas a lista do Pecúlio (e a ficha aberta por ela) é de quem tem nível de acesso: quem não tem só tem a Consulta
    const primeiro = (location.pathname.split('/')[1] ?? '').toLowerCase();
    // quem não tem nível de acesso só abre a pesquisa e a ficha de consulta dentro dele (a lista da unidade e os aniversários são de quem tem nível); /consulta redireciona
    const segundo = (location.pathname.split('/')[2] ?? '').toLowerCase();
    if (modulo?.id === 'peculio' && primeiro !== 'consulta' && ehMilitarComum(eu) && !['pesquisar', 'militar'].includes(segundo)) throw redirect({ to: '/', search: { aviso: 'outro-papel' } });
    // numa unidade só de consulta a Confecção abre só nas telas de leitura: as outras (Militares, Turnos, Escalas, Feriados, Oficiais, Configurações) levam à Grade geral
    if (eu.soConsulta && modulo?.id === 'escalas' && !TELAS_DE_LEITURA.has((location.pathname.split('/')[1] ?? '').toLowerCase())) throw redirect({ to: '/grade' });
    return { eu };
  },
  component: Casca,
});

function Casca() {
  const { eu } = Route.useRouteContext();
  const local = useLocation();
  const modulo = moduloDoEndereco(local.pathname, local.search as Record<string, unknown>);
  // o trilho é do módulo em que a pessoa está; na tela inicial e na Minha ficha não há
  const comTrilho = modulo !== null && modulo.itens.length > 0;
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoDoMenu = useRef<HTMLButtonElement>(null);
  const fecharMenu = (devolverFoco = false) => {
    setMenuAberto(false);
    if (devolverFoco) botaoDoMenu.current?.focus();
  };

  return (
    <ProvedorDeResposta>
    <div className={comTrilho ? 'min-h-dvh md:grid md:grid-cols-[84px_1fr]' : 'min-h-dvh'}>
      {comTrilho && <Trilho modulo={modulo} eu={eu} aberto={menuAberto} aoFechar={fecharMenu} />}
      <div className="flex min-w-0 flex-col">
        <Topo eu={eu} aoAbrirMenu={() => setMenuAberto(true)} botaoDoMenu={botaoDoMenu} semTrilho={!comTrilho} />
        <main className="flex-1 px-4 py-6 md:px-8">
          {/* a faixa das telas de escala numa unidade só de consulta: a pessoa vê e não altera nada */}
          {eu.soConsulta && modulo?.id === 'escalas' && <FaixaSoConsulta unidade={eu.unidade.sigla} />}
          {/* a pesquisa do Pecúlio e a seleção vivem aqui, acima das rotas: abrir a ficha de um militar e voltar não as perde; sair do módulo as zera */}
          <PesquisaDoPeculio ativa={modulo?.id === 'peculio'}>
            <Outlet />
          </PesquisaDoPeculio>
        </main>
      </div>
    </div>
    </ProvedorDeResposta>
  );
}
