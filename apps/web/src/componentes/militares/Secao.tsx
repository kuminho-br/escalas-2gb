import type { ReactNode } from 'react';

/** Bloco da ficha: título, conteúdo e, opcionalmente, ações à direita do título. */
export function Secao({ titulo, acoes, children }: { titulo: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-linha bg-superficie p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-cond text-lg font-semibold">{titulo}</h3>
        {acoes}
      </header>
      {children}
    </section>
  );
}

export const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
