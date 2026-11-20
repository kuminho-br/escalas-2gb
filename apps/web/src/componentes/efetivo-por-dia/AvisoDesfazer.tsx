import { useEffect, useRef } from 'react';
import { Button } from '@/componentes/ui/button';

/** "{nome} desativada." com o botão "Desfazer". Some sozinho em 10 segundos (o erro de um "Desfazer" recusado volta a contar o tempo). */
export function AvisoDesfazer({ texto, erro, salvando, aoDesfazer, aoSumir }: { texto: string; erro: string | null; salvando: boolean; aoDesfazer: () => void; aoSumir: () => void }) {
  const sumir = useRef(aoSumir);
  sumir.current = aoSumir;
  useEffect(() => {
    const t = setTimeout(() => sumir.current(), 10_000);
    return () => clearTimeout(t);
  }, [texto, erro]);
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-linha bg-superficie px-3 py-2 text-sm">
      <span>{texto}</span>
      <Button type="button" variant="outline" size="sm" disabled={salvando} onClick={aoDesfazer}>Desfazer</Button>
      {erro && <span className="basis-full text-alerta">{erro}</span>}
    </div>
  );
}
