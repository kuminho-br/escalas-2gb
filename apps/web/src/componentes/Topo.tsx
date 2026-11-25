import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, Menu } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useMemo, useState, type Ref } from 'react';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import type { Eu } from '@/api/eu';
import { podeDescartar } from '@/componentes/AlteracoesPendentes';
import { classeDaCaixaDaArvore, focarNaArvore, PainelDaArvore } from '@/componentes/EscolherUnidade';
import { useSair } from '@/componentes/useSair';
import { montarArvore } from '@/lib/arvore-de-unidades';
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
export function Topo({ eu, aoAbrirMenu, botaoDoMenu, semTrilho = false }: { eu: Eu; aoAbrirMenu: () => void; botaoDoMenu?: Ref<HTMLButtonElement>; semTrilho?: boolean }) {
  const router = useRouter();
  const nome = `${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`;
  const { sair, erroSair } = useSair();
  // as unidades de trabalho e, num grupo à parte, as só de consulta (o militar comum tem a lotação nas duas listas: ali ela é de consulta)
  const consulta = eu.unidadesSoConsulta;
  const trabalho = useMemo(() => eu.unidades.filter((u) => !consulta.some((c) => c.id === u.id)), [eu.unidades, consulta]);
  // o seletor só existe com mais de uma unidade; com uma só (o auxiliar de uma seção, o militar comum), o caminho é só para leitura
  const temSeletor = trabalho.length + consulta.length > 1;
  // a escolha é pela árvore, nó a nó (6.45): a árvore da corporação dá lugar às unidades da pessoa (as de cima entram como passagem, apagadas)
  const [aberto, setAberto] = useState(false);
  const todas = useQuery({ ...consultaUnidadesDaBusca, enabled: temSeletor }).data;
  const arvoreDeTrabalho = useMemo(() => montarArvore(trabalho, todas), [trabalho, todas]);
  const arvoreDeConsulta = useMemo(() => montarArvore(consulta, todas), [consulta, todas]);

  function escolher(id: string, soConsulta: boolean) {
    setAberto(false);
    // com alteração pendente, pergunta antes de mexer em qualquer coisa: se a pessoa desiste, a unidade e a tela continuam como estavam
    if (!podeDescartar()) return;
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
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-linha bg-superficie px-4 md:px-8">
      {semTrilho ? (
        // sem o trilho (tela inicial e Minha ficha) o brasão com o nome do sistema leva de volta ao início
        <Link to="/" aria-label="Ir para o início" className="-ml-1 flex shrink-0 items-center gap-2.5 rounded">
          <img src="/brasao-cbmpe.png" alt="Brasão do Corpo de Bombeiros Militar de Pernambuco" width={36} height={36} className="size-8 rounded-full md:size-9" />
          <strong className="font-cond text-lg font-semibold whitespace-nowrap max-sm:hidden">Escalas 2º GB</strong>
        </Link>
      ) : (
        <button ref={botaoDoMenu} type="button" onClick={aoAbrirMenu} className="-ml-1 rounded p-1.5 text-tinta md:hidden" aria-label="Abrir menu">
          <Menu className="size-5" aria-hidden />
        </button>
      )}
      {/* no celular só a seção atual cabe; o caminho inteiro vale do computador em diante */}
      <nav aria-label="Unidade" className="min-w-0 flex-1 font-cond text-corpo text-apagado">
        {temSeletor ? (
          <Popover.Root open={aberto} onOpenChange={setAberto}>
            <Popover.Trigger aria-label={`Unidade de trabalho: ${eu.unidade.caminho.join(' / ')}${eu.soConsulta ? ' (só consulta)' : ''}`} className="flex max-w-full items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent">
              <span data-caminho-curto aria-hidden className="truncate font-medium text-tinta md:hidden">{eu.unidade.sigla}</span>
              <span aria-hidden className="max-md:hidden truncate font-medium text-tinta">{eu.unidade.caminho.join(' / ')}</span>
              <ChevronDown className="size-4 shrink-0 text-apagado" aria-hidden />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" sideOffset={4} collisionPadding={16} className={`${classeDaCaixaDaArvore} font-sans`} onOpenAutoFocus={focarNaArvore}>
                {/* as unidades de trabalho e, num grupo à parte, as só de consulta: cada grupo é uma árvore */}
                <PainelDaArvore
                  valor={eu.unidade.id}
                  grupos={[
                    ...(trabalho.length > 0 ? [{ rotulo: 'Unidade de trabalho', nos: arvoreDeTrabalho, aoEscolher: (id: string) => escolher(id, false) }] : []),
                    ...(consulta.length > 0 ? [{ rotulo: 'Só consulta', titulo: 'Só consulta', nos: arvoreDeConsulta, aoEscolher: (id: string) => escolher(id, true) }] : []),
                  ]}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          <>
            {/* no celular só a seção atual cabe; o caminho inteiro vale do computador em diante */}
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
          </>
        )}
      </nav>
      {erroSair && (
        <p role="alert" className="absolute top-full right-4 mt-2 max-w-[calc(100%-2rem)] rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-alerta shadow-sm md:right-8">
          {erroSair}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-cond text-corpo font-medium hover:bg-accent">
          {nome}
          <ChevronDown className="size-4 text-apagado" aria-hidden />
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
