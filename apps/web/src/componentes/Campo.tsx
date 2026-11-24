import { CircleAlert } from 'lucide-react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/componentes/ui/label';

/**
 * Um campo de formulário do sistema de estilo: o rótulo (15 px, peso 500) a 6 px do controle e, embaixo, a ajuda (13 px, `apagado`) e a mensagem da API sobre
 * esse campo (13 px, peso 500, `alerta`, com ícone). As duas se ligam ao controle por `aria-describedby`, e o erro marca o controle como inválido.
 * `opcional` acrescenta "(opcional)" ao rótulo.
 */
export function Campo({ id, rotulo, ajuda, erro, opcional, children }: { id: string; rotulo: string; ajuda?: string; erro?: string; opcional?: boolean; children: ReactNode }) {
  const descricao = [ajuda && `${id}-ajuda`, erro && `${id}-erro`].filter(Boolean).join(' ');
  let controle = children;
  if (isValidElement<Record<string, unknown>>(children) && (descricao || erro)) {
    const dele = children.props['aria-describedby'];
    controle = cloneElement(children as ReactElement<Record<string, unknown>>, {
      ...(erro ? { 'aria-invalid': true } : {}),
      ...(descricao ? { 'aria-describedby': [typeof dele === 'string' ? dele : '', descricao].filter(Boolean).join(' ') } : {}),
    });
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{opcional ? `${rotulo} (opcional)` : rotulo}</Label>
      {controle}
      {ajuda && <p id={`${id}-ajuda`} className="text-apoio text-apagado">{ajuda}</p>}
      {erro && (
        <p id={`${id}-erro`} className="flex items-start gap-1.5 text-apoio font-medium text-alerta">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
          {erro}
        </p>
      )}
    </div>
  );
}
