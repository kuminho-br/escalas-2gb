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
        {/* a lista fica parada e só os itens dela rolam (a lista marca a área com data-lista-rolavel); o detalhe rola com a página. 10rem = o que está acima da coluna ao abrir a página, para o rodapé da lista caber à vista */}
        <div
          className={cn(
            'flex min-w-0 flex-col rounded-xl border border-linha bg-superficie lg:sticky lg:top-20 lg:max-h-[calc(100dvh-10rem)] lg:overflow-hidden',
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
