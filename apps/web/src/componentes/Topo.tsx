import { useRouter } from '@tanstack/react-router';
import { ChevronDown, ChevronRight, Menu } from 'lucide-react';
import type { Ref } from 'react';
import type { Eu } from '@/api/eu';
import { podeDescartar } from '@/componentes/AlteracoesPendentes';
import { useSair } from '@/componentes/useSair';
import { guardarUnidade } from '@/lib/unidade-de-trabalho';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu';

/** `botaoDoMenu` é a referência do botão que abre o menu do celular: o foco volta a ele quando o menu fecha pelo teclado. */
export function Topo({ eu, aoAbrirMenu, botaoDoMenu }: { eu: Eu; aoAbrirMenu: () => void; botaoDoMenu?: Ref<HTMLButtonElement> }) {
  const router = useRouter();
  const nome = `${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`;
  const { sair, erroSair } = useSair();
  // o seletor só existe com mais de uma unidade; com uma só (o auxiliar de uma seção, o militar comum), o caminho é só para leitura
  const menorNivel = Math.min(...eu.unidades.map((u) => u.nivel));

  function escolher(id: string) {
    // com alteração pendente, pergunta antes de mexer em qualquer coisa: se a pessoa desiste, a unidade e a tela continuam como estavam
    if (!podeDescartar()) return;
    guardarUnidade(id);
    // trocar de unidade leva à lista da tela atual (/militares/abc vai para /militares): uma ficha de outra unidade não fica aberta
    const primeiro = router.state.location.pathname.split('/')[1] ?? '';
    void router.invalidate();
    void router.navigate({ to: `/${primeiro}` as '/', ignoreBlocker: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-linha bg-superficie px-4 md:px-8">
      <button ref={botaoDoMenu} type="button" onClick={aoAbrirMenu} className="-ml-1 rounded p-1.5 text-tinta md:hidden" aria-label="Abrir menu">
        <Menu className="size-5" aria-hidden />
      </button>
      {/* no celular só a seção atual cabe; o caminho inteiro vale do computador em diante */}
      <nav aria-label="Unidade" className="min-w-0 flex-1 font-cond text-[15px] text-apagado">
        {eu.unidades.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Unidade de trabalho: ${eu.unidade.caminho.join(' / ')}`} className="flex max-w-full items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent">
              <span data-caminho-curto aria-hidden className="truncate font-medium text-tinta md:hidden">{eu.unidade.sigla}</span>
              <span aria-hidden className="max-md:hidden truncate font-medium text-tinta">{eu.unidade.caminho.join(' / ')}</span>
              <ChevronDown className="size-4 shrink-0 text-apagado" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              {eu.unidades.map((u) => (
                <DropdownMenuItem key={u.id} data-nivel={u.nivel - menorNivel} aria-current={u.id === eu.unidade.id ? 'true' : undefined} style={{ paddingLeft: `${0.5 + (u.nivel - menorNivel) * 1}rem` }} onSelect={() => escolher(u.id)}>
                  <span className={u.id === eu.unidade.id ? 'font-semibold text-tinta' : undefined}>{u.sigla}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-cond text-[15px] font-medium hover:bg-accent">
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
