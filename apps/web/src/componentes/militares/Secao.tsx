import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bloco da ficha (dentro do FichaPainel, que desenha a moldura e as linhas entre os blocos): título, conteúdo e, opcionalmente, ações à direita do título.
 * Com `recolhida`, começa fechado: o título vira um botão que mostra o `resumo` e abre o conteúdo.
 */
export function Secao({ titulo, acoes, resumo, recolhida, children }: { titulo: string; acoes?: ReactNode; resumo?: string; recolhida?: boolean; children: ReactNode }) {
  const [aberta, setAberta] = useState(!recolhida);
  const idConteudo = useId();
  return (
    <section className="p-4">
      <header className={cn('flex items-center justify-between gap-2', aberta && 'mb-3')}>
        {recolhida ? (
          <h3 className="min-w-0 flex-1 font-cond text-lg font-semibold">
            <button type="button" aria-expanded={aberta} aria-controls={idConteudo} onClick={() => setAberta(!aberta)} className="flex w-full items-center gap-2 text-left">
              <ChevronRight className={cn('size-4 shrink-0 transition-transform', aberta && 'rotate-90')} aria-hidden />
              <span>{titulo}</span>
              {resumo && <span className="truncate font-sans text-sm font-normal text-apagado">{resumo}</span>}
            </button>
          </h3>
        ) : (
          <h3 className="font-cond text-lg font-semibold">{titulo}</h3>
        )}
        {aberta && acoes}
      </header>
      {aberta && <div id={idConteudo}>{children}</div>}
    </section>
  );
}

export const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
