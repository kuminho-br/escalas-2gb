import type { ReactNode } from 'react';

/**
 * A lista de militares do Pecúlio Geral (6.50): um painel só, com uma divisória de 1 px entre as linhas. É a mesma peça do Pecúlio da unidade e da
 * pesquisa; cada tela põe as suas linhas (`<li>`), e o `rotulo` é o nome da lista para o leitor de tela.
 */
export function ListaDeMilitares({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-linha bg-superficie">
      <ul aria-label={rotulo} className="divide-y divide-linha">
        {children}
      </ul>
    </div>
  );
}

/** O espaço da linha: o mesmo nas duas telas, com o toque de passar o mouse. */
export const classeDaLinhaDeMilitar = 'grid gap-0.5 px-4 py-3 hover:bg-accent';
