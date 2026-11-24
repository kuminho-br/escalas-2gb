import { useEffect, useRef } from 'react';
import { Button } from '@/componentes/ui/button';

/** "{nome} desativada." com o botão "Desfazer". Some sozinho em 10 segundos, contados de novo depois de cada tentativa de desfazer. */
export function AvisoDesfazer({ texto, erro, salvando, aoDesfazer, aoSumir }: { texto: string; erro: string | null; salvando: boolean; aoDesfazer: () => void; aoSumir: () => void }) {
  const sumir = useRef(aoSumir);
  sumir.current = aoSumir;
  useEffect(() => {
    // enquanto o "Desfazer" está em andamento o tempo não conta: o erro de um desfazer recusado nunca some sem ser visto
    if (salvando) return;
    const t = setTimeout(() => sumir.current(), 10_000);
    return () => clearTimeout(t);
  }, [texto, erro, salvando]);
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-linha bg-superficie px-3 py-2 text-sm">
      <span>{texto}</span>
      <Button type="button" variant="secundario" size="sm" disabled={salvando} onClick={aoDesfazer}>Desfazer</Button>
      {erro && <span className="basis-full text-alerta">{erro}</span>}
    </div>
  );
}
