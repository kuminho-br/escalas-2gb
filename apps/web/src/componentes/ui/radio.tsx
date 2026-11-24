import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * O círculo de escolher (um entre vários): 20 px, borda `encaixe`; o escolhido fica cheio de `tinta`, com um miolo branco. É um `<input type="radio">` de verdade,
 * então o teclado, o grupo por `name` e o leitor de tela são os do navegador.
 */
export function Radio({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="radio"
      data-slot="radio"
      className={cn(
        'size-5 shrink-0 appearance-none rounded-full border border-encaixe bg-superficie transition-colors hover:border-tinta checked:border-tinta checked:bg-tinta checked:ring-[5px] checked:ring-inset checked:ring-superficie disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
