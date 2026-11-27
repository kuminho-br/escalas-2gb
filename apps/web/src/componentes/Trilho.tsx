import { Link, type LinkProps } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { ChevronsLeft, ChevronsRight, PanelLeftClose, X } from 'lucide-react';
import type { Eu } from '@/api/eu';
import type { Item, Modulo } from '@/lib/modulos';
import type { EstadoDoMenu } from '@/lib/estado-do-menu';
import { cn } from '@/lib/utils';

// celular e menu largo: ícone e nome lado a lado; recolhido (computador): o trilho de 84 px, com o ícone e o nome pequeno embaixo (esboço telas-v12)
const classeItem = 'flex h-10 items-center gap-2.5 rounded-md px-2.5 text-corpo focus-visible:outline-white';
const classeItemRecolhido = 'md:h-auto md:min-h-13 md:w-[72px] md:flex-col md:justify-center md:gap-0.5 md:rounded-[10px] md:px-0.5 md:py-1.5 md:text-center md:font-cond md:text-[11.5px] md:leading-[1.15] md:font-medium';

function ItemTrilho({ item, aoNavegar, recolhido }: { item: Item; aoNavegar: () => void; recolhido: boolean }) {
  const Icone = item.icone;
  const classe = cn(classeItem, recolhido && classeItemRecolhido);
  if (item.para) {
    return (
      <Link
        to={item.para}
        onClick={aoNavegar}
        className={cn(classe, 'text-white/90 hover:bg-white/12 hover:text-white')}
        activeProps={{ className: 'bg-white font-semibold text-vinho hover:bg-white hover:text-vinho' }}
        activeOptions={item.exato ? { exact: true } : undefined}
      >
        <Icone className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
        {item.nome}
      </Link>
    );
  }
  return (
    <span aria-disabled="true" title="Disponível nas próximas versões" className={cn(classe, 'cursor-default text-white/40')}>
      <Icone className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      {item.nome}
    </span>
  );
}

/**
 * O menu lateral (6.70). No celular abre de lado, sempre com os nomes ao lado dos ícones. No computador tem três estados (`estado`): largo (240 px), recolhido (o
 * trilho de 84 px) e escondido (sai da tela; o botão "Menu" da casca o traz de volta). `aoFechar(true)` devolve o foco ao botão que abriu o menu do celular (Esc e
 * "Fechar menu"); sem argumento (fundo escuro, ir a uma tela) não mexe no foco.
 */
export function Trilho({ modulo, eu, aberto, aoFechar, estado, aoMudarEstado }: { modulo: Modulo; eu: Eu; aberto: boolean; aoFechar: (devolverFoco?: boolean) => void; estado: EstadoDoMenu; aoMudarEstado: (e: EstadoDoMenu) => void }) {
  const nav = useRef<HTMLElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  const recolhido = estado === 'recolhido';
  // no celular, ao abrir o menu o foco vai para o primeiro item, e Esc fecha
  useEffect(() => {
    if (!aberto) return;
    nav.current?.querySelector<HTMLElement>('ul a[href]')?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current(true);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto]);
  // o item que a pessoa não pode usar não aparece (e o bloco que ficou vazio some)
  const blocos = modulo.itens.map((b) => b.filter((i) => !i.ve || i.ve(eu))).filter((b) => b.length > 0);
  // numa unidade só de consulta o pé (Configurações e Estrutura) não aparece: tudo ali altera ou ainda não existe
  const pe = eu.soConsulta ? [] : (modulo.pe ?? []);
  const botao = cn(
    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-apoio text-white/85 hover:bg-white/12 hover:text-white focus-visible:outline-white',
    recolhido && 'md:h-11.5 md:flex-none md:flex-col md:gap-0.5 md:px-0 md:font-cond md:text-[11.5px] md:leading-none md:font-medium',
  );
  return (
    <>
      {aberto && <div className="fixed inset-0 z-30 bg-tinta/40 md:hidden" onClick={() => aoFechar()} aria-hidden />}
      <nav
        ref={nav}
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 max-w-[84%] flex-col gap-3 bg-vinho px-3 py-4 text-white transition-transform md:sticky md:top-0 md:h-dvh md:max-w-none md:translate-x-0 md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          estado === 'largo' && 'md:w-60',
          recolhido && 'md:w-[84px] md:items-center md:px-1.5 md:py-3',
          estado === 'escondido' && 'md:hidden',
          aberto ? 'translate-x-0' : '-translate-x-full max-md:invisible',
        )}
      >
        <div className="flex items-center justify-between">
          {/* a marca do sistema: o brasão do 2º GB, a unidade em que a pessoa trabalha e o nome do sistema */}
          <Link
            to="/"
            onClick={() => aoFechar()}
            aria-label="Ir para o início"
            className={cn('grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 rounded-md py-1 pr-1.5 pl-1.5 focus-visible:outline-white', recolhido && 'md:grid-cols-1 md:justify-items-center md:gap-0.5 md:px-0')}
          >
            <img src="/brasao-2gb.png" alt="Brasão do 2º Grupamento de Bombeiros" width={40} height={40} className={cn('size-10 object-contain', recolhido && 'md:size-11')} />
            <span className={cn('grid min-w-0', recolhido && 'md:justify-items-center')}>
              <b className={cn('truncate font-cond text-nome leading-5 font-semibold', recolhido && 'md:text-[13px] md:leading-3.5')}>{eu.unidade.sigla}</b>
              <small className={cn('text-xs leading-4 text-white/85', recolhido && 'md:hidden')}>Sistema de Gestão - 2º GB</small>
            </span>
          </Link>
          <button type="button" onClick={() => aoFechar(true)} className="rounded p-1 text-white/80 md:hidden" aria-label="Fechar menu">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {/* "Recolher" e "Esconder" logo abaixo da unidade, onde o olho já está; no celular o menu só abre e fecha */}
        <div className={cn('flex gap-1 border-b border-white/25 pb-2.5 max-md:hidden', recolhido && 'md:flex-col md:items-center md:gap-1.5')}>
          <button type="button" onClick={() => aoMudarEstado(recolhido ? 'largo' : 'recolhido')} className={botao}>
            {recolhido ? <ChevronsRight className="size-4.5" aria-hidden /> : <ChevronsLeft className="size-4.5" aria-hidden />}
            <span>{recolhido ? 'Abrir' : 'Recolher'}</span>
          </button>
          <button type="button" onClick={() => aoMudarEstado('escondido')} className={botao}>
            <PanelLeftClose className="size-4.5" aria-hidden />
            <span>Esconder</span>
          </button>
        </div>
        <div className={cn('flex w-full flex-1 flex-col gap-3', recolhido && 'md:items-center')}>
          {blocos.map((bloco, i) => (
            <ul key={i} className={cn('grid gap-0.5', i > 0 && 'border-t border-white/25 pt-2.5', recolhido && 'md:justify-items-center')}>
              {bloco.map((item) => (
                <li key={item.nome}>
                  <ItemTrilho item={item} aoNavegar={() => aoFechar()} recolhido={recolhido} />
                </li>
              ))}
            </ul>
          ))}
          <ul className={cn('mt-auto grid gap-0.5 border-t border-white/25 pt-2.5', recolhido && 'md:justify-items-center')}>
            {pe.map((item) => (
              <li key={item.nome}>
                <ItemTrilho item={item} aoNavegar={() => aoFechar()} recolhido={recolhido} />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
