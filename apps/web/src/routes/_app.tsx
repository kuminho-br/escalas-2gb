import { createFileRoute, Outlet, redirect, useLocation } from '@tanstack/react-router';
import { JustificarPassado } from '@/componentes/JustificarPassado';
import { PesquisaDoPeculio } from '@/componentes/peculio/EstadoDaPesquisa';
import { useEffect, useRef, useState } from 'react';
import { consultaEu, ehMilitarComum, type Eu } from '@/api/eu';
import { ProvedorDeResposta } from '@/componentes/resposta/ProvedorDeResposta';
import { Topo } from '@/componentes/Topo';
import { Trilho } from '@/componentes/Trilho';
import { FaixaSoConsulta } from '@/componentes/FaixaSoConsulta';
import { Faixa } from '@/laboratorio/Faixa';
import { useModoLaboratorio } from '@/laboratorio/useModoLaboratorio';
import { guardarEstadoDoMenu, lerEstadoDoMenu, type EstadoDoMenu } from '@/lib/estado-do-menu';
import { useTelaEstreita } from '@/lib/useTelaEstreita';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  // o Laboratório (6.59): a faixa no alto de toda tela, e o atributo na página inteira (o que gruda no alto desce a altura da faixa)
  const emLaboratorio = useModoLaboratorio();
  useEffect(() => {
    document.documentElement.toggleAttribute('data-laboratorio', emLaboratorio);
    return () => document.documentElement.removeAttribute('data-laboratorio');
  }, [emLaboratorio]);
  const botaoDoMenu = useRef<HTMLButtonElement>(null);
  const fecharMenu = (devolverFoco = false) => {
    setMenuAberto(false);
    if (devolverFoco) botaoDoMenu.current?.focus();
  };

  // o menu do computador (6.70): largo, recolhido ou escondido, do jeito que esta pessoa deixou neste navegador
  const [guardado, setGuardado] = useState<EstadoDoMenu>(() => lerEstadoDoMenu(eu.usuario.id));
  // de onde o menu saiu ao ser escondido: o botão "Menu" devolve esse estado
  const antesDeEsconder = useRef<EstadoDoMenu>('largo');
  const mudarEstado = (novo: EstadoDoMenu) => {
    if (novo === 'escondido' && guardado !== 'escondido') antesDeEsconder.current = guardado;
    foco.current = novo === 'escondido' ? 'botao' : 'menu';
    setGuardado(novo);
    guardarEstadoDoMenu(eu.usuario.id, novo);
  };
  // o painel do dia da Grade aberto (a busca traz o militar e o dia) numa tela mais estreita que 1440 px: o menu largo recolhe para dar lugar, e volta ao fechar
  const painelAberto = local.pathname.toLowerCase().startsWith('/grade') && Boolean((local.search as Record<string, unknown>).militar) && Boolean((local.search as Record<string, unknown>).dia);
  const telaEstreita = useTelaEstreita();
  const [aberturaForcada, setAberturaForcada] = useState(false);
  useEffect(() => setAberturaForcada(false), [painelAberto]);
  const recolheuSozinho = guardado === 'largo' && painelAberto && telaEstreita && !aberturaForcada;
  const estado: EstadoDoMenu = recolheuSozinho ? 'recolhido' : guardado;
  // quem apertou "Abrir" com o painel aberto quer o menu largo mesmo assim, até fechar o painel
  const escolher = (novo: EstadoDoMenu) => {
    if (recolheuSozinho && novo === 'largo') setAberturaForcada(true);
    mudarEstado(novo);
  };
  // depois de esconder o foco vai para o botão "Menu"; depois de trazer o menu de volta, para o primeiro item (quem usa o teclado não se perde)
  const foco = useRef<'botao' | 'menu' | null>(null);
  const botaoFlutuante = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const quem = foco.current;
    foco.current = null;
    if (quem === 'botao') botaoFlutuante.current?.focus();
    else if (quem === 'menu' && estado !== 'escondido') document.querySelector<HTMLElement>('nav[aria-label="Navegação principal"] ul a[href]')?.focus();
  }, [guardado]);
  // a tela cheia da Grade (6.70): sem menu e sem cabeçalho; a busca da Grade diz quando é
  const cheia = local.pathname.toLowerCase().startsWith('/grade') && (local.search as Record<string, unknown>).cheia === true;
  const comMenu = comTrilho && !cheia;
  const escondido = comMenu && estado === 'escondido';

  return (
    <ProvedorDeResposta>
    <JustificarPassado>
    {emLaboratorio && <Faixa />}
    <div className={cn('min-h-dvh', comMenu && estado === 'largo' && 'md:grid md:grid-cols-[240px_1fr]', comMenu && estado === 'recolhido' && 'md:grid md:grid-cols-[84px_1fr]')}>
      {comMenu && <Trilho modulo={modulo} eu={eu} aberto={menuAberto} aoFechar={fecharMenu} estado={estado} aoMudarEstado={escolher} />}
      {/* escondido: o botão "Menu" fica no alto, à esquerda, por cima do cabeçalho (que abre espaço para ele) */}
      {escondido && (
        <button
          ref={botaoFlutuante}
          type="button"
          onClick={() => mudarEstado(antesDeEsconder.current)}
          className="fixed top-2 left-3 z-30 inline-flex h-10 items-center gap-2 rounded-full bg-vinho pr-4 pl-3 font-cond text-corpo font-semibold text-white shadow-md hover:bg-vinho-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta max-md:hidden"
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden />
          Menu
        </button>
      )}
      <div className="flex min-w-0 flex-col">
        {!cheia && <Topo eu={eu} aoAbrirMenu={() => setMenuAberto(true)} botaoDoMenu={botaoDoMenu} semTrilho={!comTrilho} menuEscondido={escondido} />}
        <main className={cn('flex-1', cheia ? 'px-2 py-2 md:px-4 md:py-3' : 'px-4 py-6 md:px-8')}>
          {/* a faixa das telas de escala numa unidade só de consulta: a pessoa vê e não altera nada */}
          {eu.soConsulta && modulo?.id === 'escalas' && <FaixaSoConsulta unidade={eu.unidade.sigla} />}
          {/* a pesquisa do Pecúlio e a seleção vivem aqui, acima das rotas: abrir a ficha de um militar e voltar não as perde; sair do módulo as zera */}
          <PesquisaDoPeculio ativa={modulo?.id === 'peculio'}>
            <Outlet />
          </PesquisaDoPeculio>
        </main>
      </div>
    </div>
    </JustificarPassado>
    </ProvedorDeResposta>
  );
}
