import type { ReactNode } from 'react';
import { Label } from '@/componentes/ui/label';

/** Um campo de formulário: rótulo, o controle e, embaixo, a mensagem da API sobre esse campo. */
export function Campo({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {erro && <p className="text-xs text-alerta">{erro}</p>}
    </div>
  );
}
