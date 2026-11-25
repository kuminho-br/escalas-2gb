import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cancelado, ErroApi, justificativa as registro, type PedirJustificativa } from '@/api/cliente';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Label } from '@/componentes/ui/label';
import { Textarea } from '@/componentes/ui/textarea';

type Aberta = { tentar: (texto: string) => Promise<unknown>; resolver: (v: unknown) => void; rejeitar: (e: unknown) => void };

/**
 * "Alterar o passado" (7.4): o diálogo do motivo, único para o site todo. Mexer num turno que já começou, numa escala que não é rascunho, pede o motivo a quem pode (gestor, coordenador,
 * administrador); a API responde 400 no campo `justificativa`, `pedir` chama este diálogo e repete a mudança com o texto. Assim nenhuma tela precisa saber de antemão se o turno é passado.
 * Cancelar rejeita com `Cancelado`, e a escala fica como estava; o motivo curto demais volta como erro do campo, com o diálogo aberto e o texto digitado.
 */
export function JustificarPassado({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState<Aberta | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  // o clique duplo em "Confirmar" não repete a mudança: a trava vale já, antes do próximo desenho
  const trava = useRef(false);
  // o pedido aberto agora: um segundo pedido com o diálogo aberto cancela o primeiro em silêncio (nenhuma promessa fica pendurada)
  const atual = useRef<Aberta | null>(null);

  useEffect(() => {
    const pedir: PedirJustificativa = (_mensagem, tentar) =>
      new Promise((resolver, rejeitar) => {
        atual.current?.rejeitar(new Cancelado());
        const nova: Aberta = { tentar: tentar as Aberta['tentar'], resolver: resolver as Aberta['resolver'], rejeitar };
        atual.current = nova;
        setTexto('');
        setErro(null);
        setAberta(nova);
      });
    return registro.registrar(pedir);
  }, []);

  const fechar = () => {
    atual.current = null;
    setAberta(null);
    setTexto('');
    setErro(null);
  };
  const cancelar = () => {
    if (trava.current) return;
    aberta?.rejeitar(new Cancelado());
    fechar();
  };
  const confirmar = async () => {
    if (!aberta || trava.current) return;
    trava.current = true;
    setGravando(true);
    setErro(null);
    try {
      const resposta = await aberta.tentar(texto.trim());
      registro.aceito(texto.trim());
      aberta.resolver(resposta);
      fechar();
    } catch (e) {
      if (e instanceof ErroApi && e.status === 400 && e.campos?.justificativa) {
        // o motivo não serviu (curto demais): o diálogo continua aberto, com o texto, e a mensagem da API no campo
        setErro(e.campos.justificativa);
      } else {
        // outra recusa (403, 409…): vira o erro normal da tela que pediu a mudança
        aberta.rejeitar(e);
        fechar();
      }
    } finally {
      trava.current = false;
      setGravando(false);
    }
  };

  return (
    <>
      {children}
      <Dialog open={aberta !== null} onOpenChange={(o) => { if (!o) cancelar(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Alterar o passado</DialogTitle>
            <DialogDescription>Este turno já começou. Diga o motivo da alteração: ele fica registrado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="motivo-do-passado">Motivo</Label>
            <Textarea id="motivo-do-passado" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'motivo-erro' : undefined} />
            {erro && <p id="motivo-erro" role="alert" className="text-sm text-alerta">{erro}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secundario" onClick={cancelar} disabled={gravando}>Cancelar</Button>
            <Button type="button" onClick={() => void confirmar()} disabled={gravando}>{gravando ? 'Registrando…' : 'Confirmar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
