import { cn } from '@/lib/utils';

/** O número sobre uma barra: a largura é o valor em relação ao maior da coluna (0 quando o maior é 0). */
export function BarraComparativa({ valor, maximo, className }: { valor: number; maximo: number; className?: string }) {
  const pct = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : 0;
  return (
    <span className={cn('relative block h-6 overflow-hidden rounded bg-black/[0.04]', className)}>
      <span data-barra aria-hidden className="absolute inset-y-0 left-0 rounded bg-vinho/20" style={{ width: `${pct}%` }} />
      <span className="relative z-10 grid h-full place-items-center font-cond text-sm font-semibold">{valor}</span>
    </span>
  );
}
