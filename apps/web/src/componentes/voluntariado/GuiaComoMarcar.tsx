import type { Faixa } from 'dominio';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';

/** A tecla do número do dia (a mesma no calendário e no desenho do guia): borda, sombra embaixo, "afunda" ao apertar. */
export const CLASSE_DA_TECLA =
  'rounded-md border border-input bg-superficie px-2 text-left font-cond text-base leading-none font-semibold shadow-[0_1px_0_var(--color-input)]';

const hh = (min: number) => `${String(Math.floor((min % 1440) / 60)).padStart(2, '0')}h`;

/**
 * "Como marcar": um dia de exemplo desenhado com os blocos reais da seção (não clicável) e o que cada parte faz.
 * É o mesmo no computador e no celular; muda só o verbo (clicar, tocar) e a dica.
 */
export function GuiaComoMarcar({ blocos, celular, aoFechar }: { blocos: Faixa[]; celular: boolean; aoFechar: () => void }) {
  const cortes = [...new Set(blocos.flatMap((b) => [b.inicio, b.fim]))].sort((a, b) => a - b);
  const verbo = celular ? 'Tocar' : 'Clicar';
  return (
    <section aria-label="Como marcar" className="grid gap-3 rounded-lg border border-dashed border-input bg-fundo/40 p-3">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-cond text-base font-semibold">Como marcar</h3>
        <Button type="button" size="sm" variant="outline" onClick={aoFechar}>Entendi</Button>
      </header>
      <div data-desenho-do-guia aria-hidden className="grid max-w-xl grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
        <span className={cn(CLASSE_DA_TECLA, 'inline-flex min-h-7 min-w-8 items-center')}>5</span>
        <div className="flex h-7 rounded border border-linha bg-superficie">
          {blocos.map((b) => (
            <span key={b.inicio} style={{ flex: b.fim - b.inicio }} className="min-w-0 border-r border-linha last:border-r-0" />
          ))}
        </div>
        <span />
        <div className="relative h-4 text-xs text-apagado">
          {cortes.map((c, i) => {
            const ultimo = i === cortes.length - 1;
            return (
              <span key={c} data-hora-do-guia className={cn('absolute', i > 0 && !ultimo && '-translate-x-1/2')} style={ultimo ? { right: 0 } : { left: `${(c / 1440) * 100}%` }}>{hh(c)}</span>
            );
          })}
        </div>
      </div>
      <ul className="grid gap-0.5 text-sm">
        <li>{verbo} no número marca o dia inteiro.</li>
        <li>{verbo} num bloco marca só esse horário.</li>
      </ul>
      <p className="text-xs text-apagado">
        {celular ? 'Deslizar o dedo rola a página e não marca nada.' : 'Arraste com o mouse por cima dos blocos ou dos números para marcar vários de uma vez. Passe o mouse num bloco para ver o horário.'}
      </p>
    </section>
  );
}
