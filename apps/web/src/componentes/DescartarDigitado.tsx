import { useCallback, useRef, useState } from 'react';
import { AlertDialog } from 'radix-ui';
import { Button } from '@/componentes/ui/button';

/** O que a pessoa digitou no formulário: os campos de texto, número, data, e-mail etc. e as áreas de texto, com o valor de agora. */
function digitado(form: HTMLFormElement): string {
  const campos = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].filter((c) => !['checkbox', 'radio', 'hidden', 'file', 'submit', 'button'].includes((c as HTMLInputElement).type));
  return JSON.stringify(campos.map((c) => c.value));
}

/**
 * Fechar um diálogo de criação com algo digitado pergunta "Descartar o que foi digitado?" (6.17): Esc, o X e o clique fora passam pela pergunta; sem nada
 * digitado, fecha direto. "Algo digitado" é qualquer campo de texto diferente do que o formulário tinha ao abrir (os campos controlados e os livres se
 * medem do mesmo jeito, pelo valor na tela). Uso: `ref` no `<form>`, `aoMudarAberto` no `onOpenChange` do `Dialog` e `confirmacao` dentro do `DialogContent`.
 * Fechar depois de gravar (o `aoFechar` chamado direto) não passa pela pergunta.
 */
export function useDescartarDigitado(aoFechar: () => void) {
  const form = useRef<HTMLFormElement | null>(null);
  const inicial = useRef('');
  const [perguntando, setPerguntando] = useState(false);
  const ref = useCallback((f: HTMLFormElement | null) => {
    form.current = f;
    if (f) inicial.current = digitado(f);
  }, []);
  const aoMudarAberto = (aberto: boolean) => {
    if (aberto) return;
    if (form.current && digitado(form.current) !== inicial.current) setPerguntando(true);
    else aoFechar();
  };
  const confirmacao = (
    <AlertDialog.Root open={perguntando} onOpenChange={setPerguntando}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <AlertDialog.Content className="fixed top-[50%] left-[50%] z-[60] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg outline-none sm:max-w-sm">
          <AlertDialog.Title className="text-lg leading-none font-semibold">Descartar o que foi digitado?</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-apagado">O que você escreveu nesta janela se perde.</AlertDialog.Description>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline">Continuar editando</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button type="button" onClick={aoFechar}>Descartar</Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
  return { ref, aoMudarAberto, confirmacao };
}
