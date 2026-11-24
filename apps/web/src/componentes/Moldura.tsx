import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A moldura da tela do sistema de estilo: o único lugar que escreve o título (h1) das telas. Cabeçalho com o título à esquerda (28 px estreita; 20 px no celular) e,
 * à direita, o contexto (o mês) e a ação principal; `antes` (um "Voltar") e `subtitulo` acompanham o título. `filtros` é a faixa de superfície com linha em cima e
 * embaixo, 52 px de altura mínima, que fica parada ao rolar. O resto é a área de trabalho, que usa a largura toda.
 */
export function Moldura({ titulo, antes, subtitulo, contexto, acaoPrincipal, filtros, leitura, children }: { titulo: ReactNode; antes?: ReactNode; subtitulo?: ReactNode; contexto?: ReactNode; acaoPrincipal?: ReactNode; filtros?: ReactNode; /** Tela de leitura: o conteúdo tem até 720 px de largura. */ leitura?: boolean; children?: ReactNode }) {
  return (
    <section className={cn('grid gap-4', leitura && 'mx-auto w-full max-w-180')}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {antes}
          <h1 className="font-cond text-bloco leading-tight font-semibold md:text-titulo">{titulo}</h1>
          {subtitulo && <p className="text-corpo text-apagado">{subtitulo}</p>}
        </div>
        {(contexto || acaoPrincipal) && (
          <div className="flex flex-wrap items-center gap-2">
            {contexto}
            {acaoPrincipal}
          </div>
        )}
      </header>
      {filtros && (
        <div data-filtros className="sticky top-0 z-10 flex min-h-13 flex-wrap items-center gap-3 border-y border-linha bg-superficie px-3 py-2">
          {filtros}
        </div>
      )}
      {children}
    </section>
  );
}
