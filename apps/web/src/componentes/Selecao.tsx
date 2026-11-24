import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A lista de opções do sistema de estilo: um `<select>` nativo (acessível, e no celular abre a lista do aparelho) com o visual do campo. */
export function Selecao({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-(--altura-controle) w-full min-w-0 rounded-controle border border-encaixe bg-superficie px-3 text-corpo transition-colors hover:border-tinta disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2 aria-invalid:border-alerta',
        className,
      )}
      {...props}
    />
  );
}
