import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Uma etiqueta de dado numa linha de lista: 24 px de altura, raio 6, 13 px peso 500, com o ícone de 14 px. Neutra (`passa`, borda `linha`, texto `tinta`); a que
 * marca um dado que falta é âmbar (`falta`). A cor tem um sentido só: a de falta. O texto longo corta com reticências, e a dica mostra inteiro.
 */
export function EtiquetaDeDado({ icone: Icone, falta = false, children }: { icone: LucideIcon; falta?: boolean; children: string }) {
  return (
    <span
      data-etiqueta
      title={children}
      className={cn(
        'inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-md border px-2 text-apoio leading-none font-medium',
        falta ? 'border-pendencia/40 bg-pendencia-fundo text-pendencia' : 'border-linha bg-passa text-tinta',
      )}
    >
      <Icone aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{children}</span>
    </span>
  );
}
