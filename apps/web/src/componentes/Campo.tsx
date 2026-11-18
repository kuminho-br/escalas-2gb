import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/componentes/ui/label';

/** Um campo de formulário: rótulo, o controle e, embaixo, a mensagem da API sobre esse campo (ligada ao controle para o leitor de tela). */
export function Campo({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: ReactNode }) {
  const controle = erro && isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-invalid': true, 'aria-describedby': `${id}-erro` })
    : children;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {controle}
      {erro && <p id={`${id}-erro`} className="text-xs text-alerta">{erro}</p>}
    </div>
  );
}
