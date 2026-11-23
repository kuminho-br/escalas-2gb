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
  // um formulário por vez: dar um nível de acesso ou encerrar um deles (os outros botões ficam desligados enquanto um está aberto)
  const [aberto, setAberto] = useState<{ tipo: 'dar' } | { tipo: 'encerrar'; papelId: string } | null>(null);

  if (error) return <Secao titulo="Acesso ao sistema"><p role="alert" className="text-sm text-alerta">{mensagemDe(error)}</p></Secao>;
  if (!acesso) return <Secao titulo="Acesso ao sistema"><p className="text-sm text-apagado">Carregando…</p></Secao>;

  /** Devolve se deu certo: o formulário só fecha quando deu. */
  async function agir(fn: () => Promise<unknown>): Promise<boolean> {
    setErro(null);
    setOcupado(true);
    try {
      await fn();
      await atualizarAcesso(queryClient, ficha.id);
      return true;
    } catch (e) {
      setErro(mensagemDe(e));
      return false;
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

        <h4 className="mt-2 font-cond text-base font-semibold">Níveis de acesso</h4>
        {acesso.papeis.length === 0 ? (
          <p className="text-sm text-apagado">Nenhum nível de acesso.</p>
        ) : (
          <ul className="grid gap-1.5">
            {acesso.papeis.map((p) => (
              <LinhaDoPapel
                key={p.id}
                p={p}
                pode={acesso.papeisQuePodeDar.includes(p.papel)}
                aberto={aberto?.tipo === 'encerrar' && aberto.papelId === p.id}
                desligado={aberto !== null}
                aoAbrir={() => setAberto({ tipo: 'encerrar', papelId: p.id })}
                aoFechar={() => setAberto(null)}
                aoEncerrar={async (ate) => {
                  if (await agir(() => encerrarPapel(p.id, ate))) setAberto(null);
                }}
              />
            ))}
          </ul>
        )}
        {acesso.papeisQuePodeDar.length > 0 && (
          <DarPapel
            acesso={acesso}
            aberto={aberto?.tipo === 'dar'}
            desligado={aberto?.tipo === 'encerrar'}
            aoAbrir={() => setAberto({ tipo: 'dar' })}
            aoFechar={() => setAberto(null)}
            aoDar={async (d) => {
              if (await agir(() => darPapel(ficha.id, d))) setAberto(null);
            }}
          />
        )}
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

function LinhaDoPapel({ p, pode, aberto, desligado, aoAbrir, aoFechar, aoEncerrar }: {
  p: AcessoDoMilitar['papeis'][number];
  pode: boolean;
  aberto: boolean;
  /** há outro formulário aberto (ou este): o botão "Encerrar" fica desligado */
  desligado: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  aoEncerrar: (ate: string) => Promise<void>;
}) {
  const [ate, setAte] = useState(hoje());
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="font-medium">{nomeDoPapel(p.papel)}</span>
      <span>{p.unidadeSigla}</span>
      <span className="text-apagado">{p.ate ? `de ${dataBr(p.desde)} a ${dataBr(p.ate)}` : `desde ${dataBr(p.desde)}`}</span>
      {pode && !p.ate && !aberto && <Button type="button" size="xs" variant="ghost" className="ml-auto" disabled={desligado} onClick={aoAbrir}>Encerrar</Button>}
      {aberto && (
        <span className="flex basis-full flex-wrap items-end gap-2">
          <Campo id={`ate-${p.id}`} rotulo="Encerrar em">
            <Input id={`ate-${p.id}`} type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-44" />
          </Campo>
          <Button type="button" size="sm" onClick={() => void aoEncerrar(ate)}>Confirmar encerramento</Button>
          <Button type="button" size="sm" variant="ghost" onClick={aoFechar}>Cancelar</Button>
        </span>
      )}
    </li>
  );
}

function DarPapel({ acesso, aberto, desligado, aoAbrir, aoFechar, aoDar }: {
  acesso: AcessoDoMilitar;
  aberto: boolean;
  /** um "Encerrar" está aberto: o botão que abre este formulário fica desligado */
  desligado: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  aoDar: (d: { papel: Papel; unidadeId: string; desde: string }) => Promise<void>;
}) {
  const [papel, setPapel] = useState<Papel>(acesso.papeisQuePodeDar[0]!);
  const [unidadeId, setUnidadeId] = useState('');
  const [desde, setDesde] = useState(hoje());
  if (!aberto) return <div><Button type="button" variant="outline" size="sm" disabled={desligado} onClick={aoAbrir}>Dar nível de acesso</Button></div>;
  const menor = Math.min(...acesso.unidadesParaPapel.map((u) => u.nivel));
  const unidade = unidadeId || acesso.unidadesParaPapel[0]?.id || '';
  return (
    <form
      className="grid gap-3 sm:grid-cols-[12rem_1fr_10rem]"
      onSubmit={(e) => { e.preventDefault(); void aoDar({ papel, unidadeId: unidade, desde }); }}
    >
      <Campo id="np-papel" rotulo="Nível de acesso">
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
        <Button type="submit" size="sm">Dar nível de acesso</Button>
        <Button type="button" size="sm" variant="ghost" onClick={aoFechar}>Cancelar</Button>
      </div>
    </form>
  );
}
