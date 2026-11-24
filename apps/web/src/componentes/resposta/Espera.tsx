import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A espera do sistema de estilo: blocos de raio de controle no lugar e na altura do que vai aparecer, com um brilho de `linha` a `passa`. Só aparece depois de 200 ms,
 * para a tela não piscar quando a resposta é rápida (até lá, o lugar já está reservado). "Carregando…" é só para leitor de tela.
 * `altura` (px) é a do conteúdo que vai chegar; `linhas`, quantos blocos.
 */
export function Espera({ linhas = 3, altura, className }: { linhas?: number; altura?: number; className?: string }) {
  const [vista, setVista] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVista(true), 200);
    return () => clearTimeout(t);
  }, []);
  const estilo = altura ? { minHeight: `${altura}px` } : undefined;
  if (!vista) return <div aria-hidden style={estilo} />;
  return (
    <div role="status" style={estilo} className={cn('grid content-start gap-2', className)}>
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} data-bloco aria-hidden className="espera-brilho h-11 rounded-controle" />
      ))}
    </div>
  );
}
