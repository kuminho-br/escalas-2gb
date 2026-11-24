import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const BASE = 'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-controle px-2 text-apoio leading-none font-medium whitespace-nowrap';

/**
 * A etiqueta do sistema de estilo: 24 px de altura, raio de controle, 13 px peso 500. Quatro tipos, cada um com um sentido só:
 * `servico` (quadradinho de 8 px com a cor do cadastro e o texto em `tinta`: a cor do serviço nunca fica atrás do texto), `falta` (âmbar: o que falta),
 * `erro` (alerta, sempre com ícone) e `neutra` (`passa` e `apagado`).
 */
export function Etiqueta({ tipo, cor, className, children }: { tipo: 'servico' | 'falta' | 'erro' | 'neutra'; cor?: string; className?: string; children: ReactNode }) {
  return (
    <span
      data-etiqueta
      data-tipo={tipo}
      className={cn(
        BASE,
        tipo === 'servico' && 'border border-linha bg-superficie text-tinta',
        tipo === 'falta' && 'bg-pendencia-fundo text-pendencia',
        tipo === 'erro' && 'bg-alerta-fundo text-alerta',
        tipo === 'neutra' && 'bg-passa text-apagado',
        className,
      )}
    >
      {tipo === 'servico' && <i data-quadradinho aria-hidden className="size-2 shrink-0 rounded-xs" style={cor ? { backgroundColor: cor } : undefined} />}
      {tipo === 'erro' && <CircleAlert aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
