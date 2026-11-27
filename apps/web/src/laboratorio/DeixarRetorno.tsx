import { useQueryClient } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { enviarRetorno, type FerramentaDeTeste } from '@/api/laboratorio';
import { mensagemComCampo } from '@/api/cliente';
import { useAviso } from '@/componentes/resposta/useAviso';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Label } from '@/componentes/ui/label';
import { Radio } from '@/componentes/ui/radio';
import { Textarea } from '@/componentes/ui/textarea';

const NOTAS = [1, 2, 3, 4, 5];

/**
 * A janela do retorno (6.60): o que a pessoa achou e uma nota de 1 a 5. Grava a tela em que ela estava (a rota de agora; a API tira os parâmetros). Se a API recusa, o erro
 * aparece na janela, que continua aberta com o que foi escrito.
 */
export function DeixarRetorno({ ferramentas, ferramentaInicial, aoFechar }: { ferramentas: FerramentaDeTeste[]; ferramentaInicial?: string; aoFechar: () => void }) {
  const tela = useRouterState({ select: (s) => s.location.pathname });
  const avisar = useAviso();
  const queryClient = useQueryClient();
  const [ferramentaId, setFerramentaId] = useState(ferramentaInicial ?? ferramentas[0]?.id ?? '');
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const escolhida = ferramentas.find((f) => f.id === ferramentaId);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nota === null) {
      setErro('Escolha uma nota de 1 a 5.');
      return;
    }
    setEnviando(true);
    try {
      await enviarRetorno({ ferramentaId, tela, texto: texto.trim(), nota });
      void queryClient.invalidateQueries({ queryKey: ['laboratorio', 'retornos'] });
      aoFechar();
      avisar({ texto: 'Retorno enviado. Obrigado.' });
    } catch (err) {
      setErro(mensagemComCampo(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deixar retorno</DialogTitle>
          <DialogDescription>{escolhida ? `Sobre: ${escolhida.nome}.` : 'Conte o que você achou.'} Quem lê sabe que foi você.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4">
          {ferramentas.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="retorno-ferramenta">Ferramenta</Label>
              <Selecao id="retorno-ferramenta" value={ferramentaId} onChange={(e) => setFerramentaId(e.target.value)}>
                {ferramentas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </Selecao>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="retorno-texto">O que você achou?</Label>
            <Textarea id="retorno-texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={4} required />
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-corpo font-medium">Nota</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {NOTAS.map((n) => (
                <label key={n} className="flex items-center gap-2 text-corpo">
                  <Radio name="retorno-nota" value={n} checked={nota === n} onChange={() => setNota(n)} />
                  {n}
                </label>
              ))}
            </div>
            <p className="text-apoio text-apagado">1 é a pior nota, 5 é a melhor.</p>
          </fieldset>
          {erro && <p role="alert" className="text-corpo text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={enviando}>Enviar retorno</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
