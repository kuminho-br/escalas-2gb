import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** <select> nativo com o visual dos campos (acessível e leve no celular). */
export function Selecao({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-superficie px-2.5 text-sm shadow-xs disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
