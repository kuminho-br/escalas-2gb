import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, Menu } from 'lucide-react';
import { useMemo, useState, type Ref } from 'react';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import type { Eu } from '@/api/eu';
import { podeDescartar } from '@/componentes/AlteracoesPendentes';
import { DegrausDaUnidade } from '@/componentes/DegrausDaUnidade';
import { useSair } from '@/componentes/useSair';
import { montarArvore } from '@/lib/arvore-de-unidades';
import { iniciaisDe, nomeDoPapel, papelNaUnidade } from '@/lib/papeis';
import { cn } from '@/lib/utils';
import { guardarUnidade, guardarUnidadeDeConsulta } from '@/lib/unidade-de-trabalho';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu';

/** `botaoDoMenu` é a referência do botão que abre o menu do celular: o foco volta a ele quando o menu fecha pelo teclado. */
export function Topo({ eu, aoAbrirMenu, botaoDoMenu, semTrilho = false, menuEscondido = false }: { eu: Eu; aoAbrirMenu: () => void; botaoDoMenu?: Ref<HTMLButtonElement>; semTrilho?: boolean; /** o menu está escondido: o botão "Menu" flutua no alto, à esquerda, e o cabeçalho abre espaço para ele */ menuEscondido?: boolean }) {
  const router = useRouter();
  const nome = `${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`;
  const nivel = papelNaUnidade(eu);
  const { sair, erroSair } = useSair();
  // as unidades de trabalho e, num grupo à parte, as só de consulta (o militar comum tem a lotação nas duas listas: ali ela é de consulta)
  const consulta = eu.unidadesSoConsulta;
  const trabalho = useMemo(() => eu.unidades.filter((u) => !consulta.some((c) => c.id === u.id)), [eu.unidades, consulta]);
  // o seletor só existe com mais de uma unidade; com uma só (o auxiliar de uma seção, o militar comum), o caminho é só para leitura
  const temSeletor = trabalho.length + consulta.length > 1;
  // os degraus (6.61): as unidades da pessoa, de trabalho e só de consulta, numa árvore só; a árvore da corporação dá lugar às unidades de cima (passagens)
  const todas = useQuery({ ...consultaUnidadesDaBusca, enabled: temSeletor }).data;
  const arvore = useMemo(() => montarArvore([...trabalho, ...consulta], todas), [trabalho, consulta, todas]);
  const acessoDe = (id: string) => (consulta.some((u) => u.id === id) ? ('consulta' as const) : trabalho.some((u) => u.id === id) ? ('trabalho' as const) : undefined);

  /** Guarda a unidade e leva à lista da tela. Devolve false se a pessoa desistiu (alteração pendente): nada muda. */
  function escolher(id: string, soConsulta: boolean): boolean {
    // com alteração pendente, pergunta antes de mexer em qualquer coisa: se a pessoa desiste, a unidade e a tela continuam como estavam
    if (!podeDescartar()) return false;
    // a unidade de consulta vale só nesta aba e não é lembrada na próxima entrada: o sistema abre na última unidade de trabalho
    if (soConsulta) guardarUnidadeDeConsulta(id);
    else {
      guardarUnidade(id);
      guardarUnidadeDeConsulta(null);
    }
    // trocar de unidade leva à lista da tela atual (/militares/abc vai para /militares): uma ficha de outra unidade não fica aberta
    const primeiro = router.state.location.pathname.split('/')[1] ?? '';
    void router.invalidate();
    // o mês que a pessoa está olhando continua na outra unidade (o resto da busca é da unidade de antes)
    const mes = (router.state.location.search as { mes?: unknown }).mes;
    void router.navigate({ to: `/${primeiro}` as '/', ...(typeof mes === 'string' ? { search: { mes } as never } : {}), ignoreBlocker: true });
    return true;
  }

  return (
    <header className={cn('sticky top-[var(--faixa)] z-20 flex h-14 items-center gap-3 border-b border-linha bg-superficie px-4 pt-0.75 md:gap-4 md:px-6', menuEscondido && 'md:pl-31')}>
      {/* o fio vinho amarra o topo à identidade do sistema */}
      <span data-fio-vinho aria-hidden className="absolute inset-x-0 top-0 h-0.75 bg-vinho" />
      {semTrilho ? (
        // sem o trilho (tela inicial e Minha ficha) o brasão com o nome do sistema leva de volta ao início
        <>
          <Link to="/" aria-label="Ir para o início" className="-ml-1 flex shrink-0 items-center gap-2.5 rounded-controle">
            <img src="/brasao-2gb.png" alt="Brasão do 2º Grupamento de Bombeiros" width={34} height={34} className="size-8 object-contain md:size-8.5" />
            <strong className="font-cond text-lg font-semibold whitespace-nowrap max-sm:hidden">
              Sistema de Gestão <span className="whitespace-nowrap">- 2º GB</span>
            </strong>
          </Link>
          <span aria-hidden className="h-6 w-px shrink-0 bg-linha max-md:hidden" />
        </>
      ) : (
        <button ref={botaoDoMenu} type="button" onClick={aoAbrirMenu} className="-ml-1 rounded p-1.5 text-tinta md:hidden" aria-label="Abrir menu">
          <Menu className="size-5" aria-hidden />
        </button>
      )}
      {temSeletor ? (
        <DegrausDaUnidade arvore={arvore} unidade={eu.unidade} soConsulta={eu.soConsulta} acessoDe={acessoDe} aoEscolher={escolher} />
      ) : (
        // com uma unidade só (o auxiliar de uma seção, o militar comum) o caminho é só para leitura; no celular só a seção atual cabe
        <nav aria-label="Unidade" className="min-w-0 flex-1 font-cond text-corpo text-apagado">
          <span data-caminho-curto aria-hidden className="truncate font-medium text-tinta md:hidden">{eu.unidade.caminho.at(-1)}</span>
          <ol className="flex min-w-0 items-center gap-2 max-md:sr-only">
            {eu.unidade.caminho.map((sigla, i, todas) => {
              const atual = i === todas.length - 1;
              return (
                <li key={i} aria-current={atual ? 'location' : undefined} className={atual ? 'flex min-w-0 items-center gap-2 font-medium text-tinta' : 'flex shrink-0 items-center gap-2'}>
                  {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-apagado/60" />}
                  <span className="truncate">{sigla}</span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      {erroSair && (
        <p role="alert" className="absolute top-full right-4 mt-2 max-w-[calc(100%-2rem)] rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-alerta shadow-sm md:right-8">
          {erroSair}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-controle py-1 pr-2 pl-1 hover:bg-accent">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-vinho font-cond text-corpo font-semibold text-white">{iniciaisDe(eu.militar.nomeGuerra)}</span>
          <span className="grid gap-0.5 text-left max-md:sr-only">
            <b className="font-cond text-corpo leading-none font-semibold whitespace-nowrap">{nome}</b>
            {nivel && <small className="text-apoio leading-none whitespace-nowrap text-apagado">{nomeDoPapel(nivel)}</small>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-apagado max-md:hidden" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="font-normal text-apagado">{eu.usuario.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={sair}>Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
