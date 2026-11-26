import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MudarAviso, type Aviso } from 'contratos';
import { useState, type FormEvent } from 'react';
import { atualizarAvisos, mudarAviso, publicarAviso, retirarAviso } from '@/api/avisos';
import { camposDe, mensagemDe } from '@/api/cliente';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import type { Eu } from '@/api/eu';
import { Campo } from '@/componentes/Campo';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Textarea } from '@/componentes/ui/textarea';
import { hoje } from '@/lib/meses';

/** O que a janela faz: publica um aviso novo, edita um que já existe, ou pede a confirmação de retirar. */
export type ModoDaJanela = { tipo: 'publicar' } | { tipo: 'editar'; aviso: Aviso } | { tipo: 'retirar'; aviso: Aviso };

/** O primeiro campo recusado do esquema, campo a campo (os limites do título e do texto, ditos antes de enviar). */
function recusadosPeloEsquema(erros: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const e of erros) {
    const k = String(e.path[0] ?? '');
    if (k && !(k in campos)) campos[k] = e.message;
  }
  return campos;
}

/**
 * A janela dos avisos (6.56): "Publicar aviso" (unidade da árvore, título, texto, fixar no topo e "vale até" opcional), "Editar aviso" (a mesma, com a unidade parada: para mudar de unidade,
 * retire o aviso e publique outro) e a confirmação de retirar, na própria janela. Erro da API fica na janela, que continua aberta.
 */
/** O que a janela fez com sucesso: publicou (com o aviso novo), editou ou retirou. */
export type Concluido = { tipo: 'publicar'; aviso: Aviso } | { tipo: 'editar' | 'retirar' };

export function JanelaDoAviso({ eu, modo, aoFechar, aoConcluir }: { eu: Eu; modo: ModoDaJanela; aoFechar: () => void; aoConcluir?: (feito: Concluido) => void }) {
  const queryClient = useQueryClient();
  const todas = useQuery(consultaUnidadesDaBusca);
  const aviso = modo.tipo === 'publicar' ? null : modo.aviso;
  const [unidade, setUnidade] = useState(aviso?.unidadeId ?? (eu.unidades.some((u) => u.id === eu.unidade.id) ? eu.unidade.id : (eu.unidades[0]?.id ?? '')));
  const [titulo, setTitulo] = useState(aviso?.titulo ?? '');
  const [texto, setTexto] = useState(aviso?.texto ?? '');
  const [fixado, setFixado] = useState(aviso?.fixado ?? false);
  const [valeAte, setValeAte] = useState(aviso?.valeAte ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [gravando, setGravando] = useState(false);

  async function gravar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const dados = { titulo, texto, fixado, valeAte: valeAte || null };
    // os limites do título e do texto (e a data) são conferidos antes de enviar; a unidade vem da árvore, e a API a confere
    const conferido = MudarAviso.safeParse(dados);
    const recusados = conferido.success ? {} : recusadosPeloEsquema(conferido.error.issues);
    // a data só se confere com o dia de hoje (a API confere de novo): sem o `min` do campo, que trava o envio com a mensagem do navegador
    if (valeAte && valeAte < hoje() && aviso?.valeAte !== valeAte) recusados.valeAte = 'A data já passou.';
    if (!conferido.success || Object.keys(recusados).length > 0) {
      setCampos(recusados);
      return;
    }
    setCampos({});
    setGravando(true);
    try {
      let feito: Concluido;
      if (aviso) {
        await mudarAviso(aviso.id, conferido.data);
        feito = { tipo: 'editar' };
      } else {
        feito = { tipo: 'publicar', aviso: await publicarAviso({ unidadeId: unidade, titulo: dados.titulo, texto: dados.texto, fixado, valeAte: dados.valeAte }) };
      }
      atualizarAvisos(queryClient);
      aoConcluir?.(feito);
      aoFechar();
    } catch (err) {
      setErro(mensagemDe(err));
      setCampos(camposDe(err));
    } finally {
      setGravando(false);
    }
  }

  async function retirar() {
    if (modo.tipo !== 'retirar') return;
    setErro(null);
    setGravando(true);
    try {
      await retirarAviso(modo.aviso.id);
      atualizarAvisos(queryClient);
      aoConcluir?.({ tipo: 'retirar' });
      aoFechar();
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setGravando(false);
    }
  }

  if (modo.tipo === 'retirar') {
    return (
      <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar aviso</DialogTitle>
            <DialogDescription>Retirar este aviso? Ele sai da tela inicial de todos.</DialogDescription>
          </DialogHeader>
          {erro && <p role="alert" className="text-corpo text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="secundario" onClick={aoFechar} disabled={gravando}>Cancelar</Button>
            <Button type="button" variant="perigoso-cheio" onClick={() => void retirar()} disabled={gravando}>Retirar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{aviso ? 'Editar aviso' : 'Publicar aviso'}</DialogTitle>
          <DialogDescription>O aviso aparece na tela inicial de quem está na unidade e nas de baixo dela. Não há notificação nem e-mail.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void gravar(e)} className="grid gap-3">
          <Campo id="av-unidade" rotulo="Unidade" erro={campos.unidadeId}>
            <EscolherUnidade id="av-unidade" rotulo="Unidade" unidades={eu.unidades} todas={todas.data} valor={unidade} aoEscolher={setUnidade} disabled={Boolean(aviso)} textoDoValor={aviso?.unidadeSigla} />
          </Campo>
          <Campo id="av-titulo" rotulo="Título" erro={campos.titulo}>
            <Input id="av-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo id="av-texto" rotulo="Texto" erro={campos.texto}>
            <Textarea id="av-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} />
          </Campo>
          <div className="flex items-center gap-2">
            <Checkbox id="av-fixado" checked={fixado} onChange={(e) => setFixado(e.target.checked)} />
            <Label htmlFor="av-fixado">Fixar no topo</Label>
          </div>
          <Campo id="av-vale" rotulo="Vale até" opcional erro={campos.valeAte}>
            <Input id="av-vale" type="date" value={valeAte} onChange={(e) => setValeAte(e.target.value)} />
          </Campo>
          {erro && <p role="alert" className="text-corpo text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="secundario" onClick={aoFechar} disabled={gravando}>Cancelar</Button>
            <Button type="submit" disabled={gravando || !unidade}>{aviso ? 'Salvar' : 'Publicar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
