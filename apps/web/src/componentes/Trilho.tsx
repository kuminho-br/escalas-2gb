import { Link, type LinkProps } from '@tanstack/react-router';
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
    { nome: 'Cotas', icone: PieChart, soCadastro: true },
  ],
  [
    { nome: 'Militares', icone: Users, soCadastro: true },
    { nome: 'Serviços', icone: Clock, soCadastro: true },
    { nome: 'Guarnições', icone: Truck, soCadastro: true },
    { nome: 'Escalas', icone: FileText, soCadastro: true },
    { nome: 'Feriados', icone: CalendarDays, soCadastro: true },
  ],
];
const PE: Item[] = [
  { nome: 'Configurações', icone: Settings, soCadastro: true },
  { nome: 'Estrutura', icone: Network },
  { nome: 'Histórico', icone: History },
  { nome: 'Ajuda', icone: CircleHelp },
];

const classeItem = 'flex h-9 items-center gap-3 rounded-md px-3 text-[15px] focus-visible:outline-white';

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
        <Icone className="size-[18px]" aria-hidden />
        {item.nome}
      </Link>
    );
  }
  return (
    <span aria-disabled="true" title="Disponível nas próximas versões" className={cn(classeItem, 'cursor-default text-white/40')}>
      <Icone className="size-[18px]" aria-hidden />
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
          'fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-vinho px-3 py-4 text-white transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0',
          aberto ? 'translate-x-0' : '-translate-x-full max-md:invisible',
        )}
      >
        <div className="mb-4 flex items-center justify-between px-3">
          <span className="font-cond text-lg font-semibold tracking-tight">Escalas 2º GB</span>
          <button type="button" onClick={aoFechar} className="rounded p-1 text-white/80 md:hidden" aria-label="Fechar menu">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-1 flex-col">
          {blocos.map((bloco, i) => (
            <ul key={i} className={cn('grid gap-0.5', i > 0 && 'mt-3 border-t border-white/15 pt-3')}>
              {bloco.map((item) => (
                <li key={item.nome}>
                  <ItemTrilho item={item} aoNavegar={aoFechar} />
                </li>
              ))}
            </ul>
          ))}
          <ul className="mt-auto grid gap-0.5 border-t border-white/15 pt-3">
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
