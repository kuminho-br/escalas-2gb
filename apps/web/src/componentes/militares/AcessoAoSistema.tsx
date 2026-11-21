import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AcessoDoMilitar, FichaMilitar, Papel, SituacaoDoAcesso } from 'contratos';
import { useState } from 'react';
import { atualizarAcesso, consultaAcesso, darPapel, desativarAcesso, encerrarPapel, gerarSenhaProvisoria } from '@/api/acesso';
import { mensagemDe } from '@/api/cliente';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { hoje } from '@/lib/meses';
import { nomeDoPapel } from '@/lib/papeis';
import { dataBr, Secao } from './Secao';

const SEM_EMAIL = 'Preencha o e-mail institucional para dar acesso.';

const dataDoInstante = (iso: string) => dataBr(new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Recife' }));

function textoDaSituacao(a: AcessoDoMilitar): string {
  const s: SituacaoDoAcesso = a.situacao;
  if (s === 'provisoria') return a.senhaProvisoriaAte ? `Senha provisória até ${dataDoInstante(a.senhaProvisoriaAte)}` : 'Senha provisória';
  return { 'sem-acesso': 'Sem acesso', 'provisoria-vencida': 'Senha provisória vencida', ativo: 'Ativo', desativado: 'Desativado' }[s];
}

/** Acesso ao sistema: a situação da conta, a senha provisória, desativar e os papéis (dar e encerrar). */
export function AcessoAoSistema({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const { data: acesso, error } = useQuery(consultaAcesso(ficha.id));
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState<{ senha: string; validaAte: string } | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (error) return <Secao titulo="Acesso ao sistema"><p role="alert" className="text-sm text-alerta">{mensagemDe(error)}</p></Secao>;
  if (!acesso) return <Secao titulo="Acesso ao sistema"><p className="text-sm text-apagado">Carregando…</p></Secao>;

  async function agir(fn: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await fn();
      await atualizarAcesso(queryClient, ficha.id);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  }
  const gerar = () => agir(async () => setSenha(await gerarSenhaProvisoria(ficha.id)));
  const desativar = () => {
    if (!window.confirm('Desativar o acesso? A pessoa deixa de entrar e as sessões abertas se encerram.')) return;
    return agir(() => desativarAcesso(ficha.id));
  };
  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha!.senha);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  }
  const fecharSenha = () => {
    setSenha(null);
    setCopiada(false);
  };

  return (
    <Secao titulo="Acesso ao sistema">
      <div className="grid gap-3">
        <p className="text-sm"><span className="text-apagado">Situação: </span><strong>{textoDaSituacao(acesso)}</strong></p>
        <p className="text-sm"><span className="text-apagado">E-mail de entrada: </span>{acesso.email ?? '—'}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={!acesso.podeGerarSenha || ocupado} onClick={() => void gerar()}>Gerar senha provisória</Button>
          {acesso.situacao !== 'sem-acesso' && acesso.situacao !== 'desativado' && (
            <Button type="button" variant="outline" disabled={ocupado} onClick={() => void desativar()}>Desativar acesso</Button>
          )}
        </div>
        {!acesso.email && <p className="text-sm text-pendencia">{SEM_EMAIL}</p>}
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}

        <h4 className="mt-2 font-cond text-base font-semibold">Papéis</h4>
        {acesso.papeis.length === 0 ? (
          <p className="text-sm text-apagado">Nenhum papel.</p>
        ) : (
          <ul className="grid gap-1.5">
            {acesso.papeis.map((p) => (
              <LinhaDoPapel key={p.id} p={p} pode={acesso.papeisQuePodeDar.includes(p.papel)} aoEncerrar={(ate) => agir(() => encerrarPapel(p.id, ate))} />
            ))}
          </ul>
        )}
        {acesso.papeisQuePodeDar.length > 0 && <DarPapel acesso={acesso} aoDar={(d) => agir(() => darPapel(ficha.id, d))} />}
      </div>

      <Dialog open={senha !== null} onOpenChange={(aberto) => { if (!aberto) fecharSenha(); }}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Senha provisória</DialogTitle>
            <DialogDescription>Entregue à pessoa agora: ela aparece só uma vez. Ao entrar, a pessoa cria a própria senha.</DialogDescription>
          </DialogHeader>
          {senha && (
            <div className="grid gap-1">
              <p className="font-mono text-2xl font-semibold tracking-wide">{senha.senha}</p>
              <p className="text-sm text-apagado">Vale até {dataDoInstante(senha.validaAte)}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void copiar()}>{copiada ? 'Copiada' : 'Copiar'}</Button>
            <Button type="button" onClick={fecharSenha}>Já entreguei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Secao>
  );
}

function LinhaDoPapel({ p, pode, aoEncerrar }: { p: AcessoDoMilitar['papeis'][number]; pode: boolean; aoEncerrar: (ate: string) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [ate, setAte] = useState(hoje());
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">{nomeDoPapel(p.papel)}</span>
      <span>{p.unidadeSigla}</span>
      <span className="text-apagado">{p.ate ? `de ${dataBr(p.desde)} a ${dataBr(p.ate)}` : `desde ${dataBr(p.desde)}`}</span>
      {pode && !p.ate && !aberto && <Button type="button" size="xs" variant="ghost" className="ml-auto" onClick={() => setAberto(true)}>Encerrar</Button>}
      {aberto && (
        <span className="flex basis-full flex-wrap items-end gap-2">
          <Campo id={`ate-${p.id}`} rotulo="Encerrar em">
            <Input id={`ate-${p.id}`} type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-44" />
          </Campo>
          <Button type="button" size="sm" onClick={() => void aoEncerrar(ate).then(() => setAberto(false))}>Confirmar encerramento</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        </span>
      )}
    </li>
  );
}

function DarPapel({ acesso, aoDar }: { acesso: AcessoDoMilitar; aoDar: (d: { papel: Papel; unidadeId: string; desde: string }) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [papel, setPapel] = useState<Papel>(acesso.papeisQuePodeDar[0]!);
  const [unidadeId, setUnidadeId] = useState('');
  const [desde, setDesde] = useState(hoje());
  if (!aberto) return <div><Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>Dar papel</Button></div>;
  const menor = Math.min(...acesso.unidadesParaPapel.map((u) => u.nivel));
  const unidade = unidadeId || acesso.unidadesParaPapel[0]?.id || '';
  return (
    <form
      className="grid gap-3 sm:grid-cols-[12rem_1fr_10rem]"
      onSubmit={(e) => { e.preventDefault(); void aoDar({ papel, unidadeId: unidade, desde }).then(() => setAberto(false)); }}
    >
      <Campo id="np-papel" rotulo="Papel">
        <Selecao id="np-papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
          {acesso.papeisQuePodeDar.map((p) => <option key={p} value={p}>{nomeDoPapel(p)}</option>)}
        </Selecao>
      </Campo>
      <Campo id="np-unidade" rotulo="Unidade">
        <Selecao id="np-unidade" value={unidade} onChange={(e) => setUnidadeId(e.target.value)}>
          {acesso.unidadesParaPapel.map((u) => <option key={u.id} value={u.id}>{`${'  '.repeat(u.nivel - menor)}${u.sigla}`}</option>)}
        </Selecao>
      </Campo>
      <Campo id="np-desde" rotulo="A partir de">
        <Input id="np-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
      </Campo>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" size="sm">Dar papel</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
