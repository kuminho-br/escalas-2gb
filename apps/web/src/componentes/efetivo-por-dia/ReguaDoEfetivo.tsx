import { textoMinutos } from '@/lib/turnos';
import { cn } from '@/lib/utils';

export type Janela = { inicio: number; fim: number };

/** A posição (em %) de um minuto do dia dentro da janela. */
export const posicao = (janela: Janela, min: number) => `${((min - janela.inicio) / (janela.fim - janela.inicio || 1)) * 100}%`;

/** As linhas vinho de 00h e 24h do dia, quando caem dentro da janela: a moldura do dia, que atravessa a régua e as linhas do tempo. */
export function LimitesDoDia({ janela, className }: { janela: Janela; className?: string }) {
  return (
    <>
      {[0, 1440]
        .filter((m) => m >= janela.inicio && m <= janela.fim)
        .map((m) => (
          <span
            key={m}
            data-limite-do-dia
            aria-hidden
            className={cn('pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 rounded-full bg-vinho', className)}
            style={{ left: posicao(janela, m) }}
          />
        ))}
    </>
  );
}

/**
 * A régua comum a todos os cards do dia: só os pontos de interesse (os inícios e fins dos horários vinculados) e, quando a janela passa
 * da meia-noite, "D" sob o dia e "D+1" sob o dia seguinte.
 */
export function ReguaDoEfetivo({ janela, marcas }: { janela: Janela; marcas: number[] }) {
  const passa = janela.fim > 1440 && janela.inicio < 1440;
  return (
    <div data-testid="regua-do-dia" aria-hidden className="grid gap-x-3 sm:grid-cols-[8rem_1fr]">
      <span className="hidden sm:block" />
      <div>
        <div className="relative h-5 text-xs text-apagado">
          {marcas.map((m) => (
            <span
              key={m}
              className={cn('absolute whitespace-nowrap', m === janela.inicio ? 'translate-x-0' : m === janela.fim ? '-translate-x-full' : '-translate-x-1/2')}
              style={{ left: posicao(janela, m) }}
            >
              {textoMinutos(m)}
            </span>
          ))}
        </div>
        <div className="relative h-2 border-b border-linha">
          {marcas.map((m) => (
            <span key={m} className="absolute bottom-0 h-2 w-px bg-linha" style={{ left: posicao(janela, m) }} />
          ))}
          <LimitesDoDia janela={janela} className="-top-1" />
        </div>
        {passa && (
          <div className="relative h-4 font-cond text-xs font-semibold text-tinta">
            <span className="absolute -translate-x-1/2" style={{ left: posicao(janela, (janela.inicio + 1440) / 2) }}>D</span>
            <span className="absolute -translate-x-1/2" style={{ left: posicao(janela, (1440 + janela.fim) / 2) }}>D+1</span>
          </div>
        )}
      </div>
    </div>
  );
}
