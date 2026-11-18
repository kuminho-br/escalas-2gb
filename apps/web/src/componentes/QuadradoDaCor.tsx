import { corClara } from '@/lib/cores';
import { cn } from '@/lib/utils';

/** O quadradinho com a cor de um serviço; a cor muito clara ganha borda, para não sumir no branco. */
export function QuadradoDaCor({ cor, className }: { cor: string; className?: string }) {
  const clara = corClara(cor);
  return <span aria-hidden data-claro={clara ? '' : undefined} className={cn('size-3 shrink-0 rounded-sm', clara && 'border border-black/30', className)} style={{ backgroundColor: cor }} />;
}
