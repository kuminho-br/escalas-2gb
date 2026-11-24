import { FileSpreadsheet, Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/componentes/ui/button';
import { Label } from '@/componentes/ui/label';
import { cn } from '@/lib/utils';

/**
 * O envio de arquivo do sistema de estilo. Vazio: borda tracejada `encaixe` e o botão secundário "Escolher arquivo". Com arquivo: borda cheia `linha`, o nome em peso 600
 * e "Trocar". O `<input type="file">` fica no lugar (escondido só da vista): o rótulo, o teclado e o leitor de tela são os do navegador.
 */
export function EnvioDeArquivo({ id, rotulo, accept, arquivo, aoEscolher }: { id: string; rotulo: string; accept?: string; arquivo: File | null; aoEscolher: (arquivo: File | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <div
        data-envio
        className={cn('flex min-h-(--altura-controle) flex-wrap items-center gap-3 rounded-controle border bg-superficie px-3 py-2', arquivo ? 'border-linha' : 'border-dashed border-encaixe')}
      >
        <input id={id} ref={entrada} type="file" accept={accept} className="sr-only" onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)} />
        {arquivo ? (
          <>
            <FileSpreadsheet aria-hidden className="size-4 shrink-0 text-apagado" />
            <span className="min-w-0 flex-1 truncate text-corpo font-semibold" title={arquivo.name}>{arquivo.name}</span>
            <Button type="button" variant="secundario" size="sm" onClick={() => entrada.current?.click()}>Trocar</Button>
          </>
        ) : (
          <>
            <Upload aria-hidden className="size-4 shrink-0 text-apagado" />
            <span className="min-w-0 flex-1 text-corpo text-apagado">Nenhum arquivo escolhido.</span>
            <Button type="button" variant="secundario" size="sm" onClick={() => entrada.current?.click()}>Escolher arquivo</Button>
          </>
        )}
      </div>
    </div>
  );
}
