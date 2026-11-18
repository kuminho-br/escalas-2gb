import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Padrão dos cadastros: lista à esquerda e detalhe à direita (especificação de telas, "Cadastros").
 * No celular, mostra um de cada vez: o detalhe quando há item escolhido.
 */
export function ListaDetalhe({
  titulo,
  acoes,
  lista,
  detalhe,
  temDetalhe,
}: {
  titulo: string;
  acoes?: ReactNode;
  lista: ReactNode;
  detalhe: ReactNode;
  temDetalhe: boolean;
}) {
  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cond text-[28px] leading-tight font-semibold">{titulo}</h1>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </header>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
        {/* a lista fica parada e rola sozinha: o detalhe rola com a página (rolagens independentes) */}
        <div
          className={cn(
            'min-w-0 rounded-xl border border-linha bg-superficie lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto',
            temDetalhe && 'max-lg:hidden',
          )}
        >
          {lista}
        </div>
        <div className={cn('min-w-0', !temDetalhe && 'max-lg:hidden')}>{detalhe}</div>
      </div>
    </section>
  );
}
