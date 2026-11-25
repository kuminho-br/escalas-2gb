import { CircleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { foiCancelado, mensagemDe } from '@/api/cliente';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { cn } from '@/lib/utils';
import { ContextoDeResposta, type PedidoDeAviso, type PedidoDeConfirmacao, type RespostaDoSistema } from './contexto';

const TEMPO_COM_DESFAZER = 8000;
const TEMPO_SEM_DESFAZER = 4000;

type AvisoNoAr = PedidoDeAviso & { id: number };

/**
 * O aviso de resultado: embaixo, no meio da área de trabalho, a 16 px da borda. Fundo `tinta`, texto branco; o de erro é de superfície, com borda de `alerta`.
 * Some em 8 s com "Desfazer" e em 4 s sem; não some com o mouse em cima nem com o foco dentro; o de erro espera a pessoa.
 */
function AvisoNaTela({ aviso, aoFechar, aoDesfazer }: { aviso: AvisoNoAr; aoFechar: () => void; aoDesfazer: () => void }) {
  const [parado, setParado] = useState(false);
  useEffect(() => {
    if (aviso.erro || parado) return;
    const t = setTimeout(aoFechar, aviso.desfazer ? TEMPO_COM_DESFAZER : TEMPO_SEM_DESFAZER);
    return () => clearTimeout(t);
  }, [aviso.id, aviso.erro, aviso.desfazer, parado, aoFechar]);
  return (
    <div
      role="status"
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
      className={cn(
        'fixed bottom-4 left-1/2 z-60 flex min-h-11 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-controle py-1.5 pr-2 pl-4 text-corpo shadow-por-cima',
        aviso.erro ? 'border border-alerta bg-superficie text-tinta' : 'bg-tinta text-white',
      )}
    >
      {aviso.erro && <CircleAlert aria-hidden className="size-5 shrink-0 text-alerta" strokeWidth={1.75} />}
      <span className="min-w-0">{aviso.texto}</span>
      {!aviso.erro && aviso.desfazer && (
        <button type="button" onClick={aoDesfazer} className="min-h-9 shrink-0 rounded-controle px-3 font-medium underline underline-offset-2 hover:bg-white/10 focus-visible:outline-white">
          Desfazer
        </button>
      )}
      {aviso.erro && aviso.tentarDeNovo && (
        <Button
          type="button"
          variant="secundario"
          size="sm"
          onClick={() => {
            aviso.tentarDeNovo?.();
            aoFechar();
          }}
        >
          Tentar de novo
        </Button>
      )}
      {aviso.erro && (
        <Button type="button" variant="discreto" size="icon-sm" aria-label="Fechar" onClick={aoFechar}>
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}

type PerguntaNoAr = PedidoDeConfirmacao & { responder: (v: boolean) => void };

/** A confirmação: um diálogo de até 440 px, com "Cancelar" (secundário) e o verbo (principal, ou perigoso cheio, apagado até a pessoa digitar o que se pede). */
function ConfirmacaoNaTela({ pergunta }: { pergunta: PerguntaNoAr }) {
  const [digitado, setDigitado] = useState('');
  const liberado = !pergunta.digitar || digitado.trim() === pergunta.digitar;
  return (
    <Dialog open onOpenChange={(aberto) => !aberto && pergunta.responder(false)}>
      <DialogContent className="sm:max-w-110" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{pergunta.titulo}</DialogTitle>
          <DialogDescription className={pergunta.texto ? undefined : 'sr-only'}>{pergunta.texto ?? pergunta.titulo}</DialogDescription>
        </DialogHeader>
        {pergunta.digitar && (
          <div className="grid gap-1.5">
            <Label htmlFor="confirmar-digitar">Digite {pergunta.digitar} para confirmar</Label>
            <Input id="confirmar-digitar" value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="secundario" onClick={() => pergunta.responder(false)}>
            Cancelar
          </Button>
          <Button type="button" variant={pergunta.perigoso ? 'perigoso-cheio' : 'principal'} disabled={!liberado} onClick={() => pergunta.responder(true)}>
            {pergunta.verbo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A resposta do sistema, num lugar só: o aviso de resultado (`useAviso`) e a confirmação (`useConfirmar`). Fica no casco (`routes/_app.tsx`), para toda tela responder do mesmo jeito.
 */
export function ProvedorDeResposta({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<AvisoNoAr | null>(null);
  const [pergunta, setPergunta] = useState<PerguntaNoAr | null>(null);
  const contador = useRef(0);
  const avisar = useCallback((a: PedidoDeAviso) => setAviso({ ...a, id: ++contador.current }), []);
  const fechar = useCallback(() => setAviso(null), []);
  const confirmar = useCallback(
    (c: PedidoDeConfirmacao) =>
      new Promise<boolean>((resolver) => {
        // o foco volta a quem abriu a pergunta (o botão que a pessoa tocou), se ele ainda está na tela
        const quemAbriu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPergunta({
          ...c,
          responder: (v) => {
            setPergunta(null);
            resolver(v);
            setTimeout(() => quemAbriu?.isConnected && quemAbriu.focus(), 0);
          },
        });
      }),
    [],
  );
  const valor = useMemo<RespostaDoSistema>(() => ({ avisar, confirmar }), [avisar, confirmar]);
  const desfazer = useCallback(() => {
    const f = aviso?.desfazer;
    if (!f) return;
    // o desfazer vale uma vez só; se a API o recusa ("A escala mudou desde então…"), o motivo aparece num aviso de erro
    setAviso(null);
    // desistir do diálogo do motivo (7.4) não é erro: o aviso já saiu e nada mais aparece
    void f().catch((e: unknown) => { if (!foiCancelado(e)) avisar({ texto: e instanceof Error ? e.message : mensagemDe(e), erro: true }); });
  }, [aviso, avisar]);
  return (
    <ContextoDeResposta.Provider value={valor}>
      {children}
      {aviso && <AvisoNaTela key={aviso.id} aviso={aviso} aoFechar={fechar} aoDesfazer={desfazer} />}
      {pergunta && <ConfirmacaoNaTela key={pergunta.titulo} pergunta={pergunta} />}
    </ContextoDeResposta.Provider>
  );
}
