import { Link, type LinkProps } from '@tanstack/react-router';
import { Fragment } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  Clock,
  FileText,
  History,
  LayoutGrid,
  ListTree,
  Network,
  PieChart,
  Settings,
  Sun,
  Truck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ehMilitarComum, type Eu } from '@/api/eu';
import { cn } from '@/lib/utils';

type Item = { nome: string; icone: LucideIcon; para?: LinkProps['to']; soCadastro?: boolean };

// Blocos da barra lateral (especificação de telas, "Navegação"). Só os itens com `para` existem nesta fase.
const BLOCOS: Item[][] = [
  [
    { nome: 'Grade geral', icone: LayoutGrid, para: '/' },
    { nome: 'Escala do mês', icone: ListTree },
    { nome: 'Efetivo do dia', icone: Sun },
  ],
  [
    { nome: 'Voluntariado', icone: CalendarCheck, soCadastro: true },
    { nome: 'Cotas', icone: PieChart, para: '/cotas', soCadastro: true },
  ],
  [
    { nome: 'Militares', icone: Users, para: '/militares', soCadastro: true },
    { nome: 'Serviços', icone: Clock, para: '/servicos', soCadastro: true },
    { nome: 'Guarnições', icone: Truck, para: '/guarnicoes', soCadastro: true },
    { nome: 'Escalas', icone: FileText, para: '/escalas', soCadastro: true },
    { nome: 'Feriados', icone: CalendarDays, para: '/feriados', soCadastro: true },
  ],
];
const PE: Item[] = [
  { nome: 'Configurações', icone: Settings, para: '/configuracoes', soCadastro: true },
  { nome: 'Estrutura', icone: Network },
  { nome: 'Histórico', icone: History },
  { nome: 'Ajuda', icone: CircleHelp },
];

// celular: ícone e nome lado a lado; computador: o trilho de 84 px, com o ícone e o nome pequeno embaixo (esboço telas-v12)
const classeItem =
  'flex h-9 items-center gap-3 rounded-md px-3 text-[15px] focus-visible:outline-white md:h-auto md:w-[72px] md:flex-col md:justify-center md:gap-0.5 md:rounded-[10px] md:px-0.5 md:py-1 md:text-center md:font-cond md:text-[11.5px] md:leading-[1.15] md:font-medium';

function ItemTrilho({ item, aoNavegar }: { item: Item; aoNavegar: () => void }) {
  const Icone = item.icone;
  if (item.para) {
    return (
      <Link
        to={item.para}
        onClick={aoNavegar}
        className={cn(classeItem, 'text-white/85 hover:bg-white/10 hover:text-white')}
        activeProps={{ className: 'bg-white/15 font-medium text-white' }}
        activeOptions={{ exact: item.para === '/' }}
      >
        <Icone className="size-[18px] md:size-5" aria-hidden />
        {item.nome}
      </Link>
    );
  }
  return (
    <span aria-disabled="true" title="Disponível nas próximas versões" className={cn(classeItem, 'cursor-default text-white/40')}>
      <Icone className="size-[18px] md:size-5" aria-hidden />
      {item.nome}
    </span>
  );
}

export function Trilho({ eu, aberto, aoFechar }: { eu: Eu; aberto: boolean; aoFechar: () => void }) {
  // o militar comum não vê cadastros (adendo do design, "Atores")
  const visivel = (i: Item) => !(i.soCadastro && ehMilitarComum(eu));
  const blocos = BLOCOS.map((b) => b.filter(visivel)).filter((b) => b.length > 0);
  const pe = PE.filter(visivel);
  return (
    <>
      {aberto && <div className="fixed inset-0 z-30 bg-tinta/40 md:hidden" onClick={aoFechar} aria-hidden />}
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-vinho px-3 py-4 text-white transition-transform md:sticky md:top-0 md:h-dvh md:w-[84px] md:translate-x-0 md:items-center md:overflow-y-auto md:px-0 md:py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          aberto ? 'translate-x-0' : '-translate-x-full max-md:invisible',
        )}
      >
        <div className="mb-4 flex items-center justify-between px-3 md:mb-2.5 md:justify-center md:px-0">
          <span className="font-cond text-lg font-semibold tracking-tight md:hidden">Escalas 2º GB</span>
          <span role="img" aria-label="Escalas 2º GB" className="hidden size-[42px] place-items-center rounded-full bg-[#F2C200] font-cond text-xs font-bold text-vinho md:grid">2º GB</span>
          <button type="button" onClick={aoFechar} className="rounded p-1 text-white/80 md:hidden" aria-label="Fechar menu">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex w-full flex-1 flex-col md:items-center">
          {blocos.map((bloco, i) => (
            <Fragment key={i}>
              {i > 0 && <hr aria-hidden className="mx-auto my-2.5 hidden h-px w-12 border-0 bg-white/30 md:block" />}
              <ul className={cn('grid gap-0.5 md:justify-items-center', i > 0 && 'mt-3 border-t border-white/15 pt-3 md:mt-0 md:border-0 md:pt-0')}>
                {bloco.map((item) => (
                  <li key={item.nome}>
                    <ItemTrilho item={item} aoNavegar={aoFechar} />
                  </li>
                ))}
              </ul>
            </Fragment>
          ))}
          <hr aria-hidden className="mx-auto mt-auto mb-2.5 hidden h-px w-12 border-0 bg-white/30 md:block" />
          <ul className="grid gap-0.5 border-t border-white/15 pt-3 max-md:mt-auto md:justify-items-center md:border-0 md:pt-0">
            {pe.map((item) => (
              <li key={item.nome}>
                <ItemTrilho item={item} aoNavegar={aoFechar} />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
