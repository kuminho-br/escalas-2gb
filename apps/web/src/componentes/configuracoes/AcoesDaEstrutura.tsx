import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NoDaArvore, PessoaNoEfeito, TipoDeUnidadeComUso } from 'contratos';
import { useState, type FormEvent, type ReactNode } from 'react';
import { alterarUnidade, consultaEfeitoDeMover, criarUnidade, excluirUnidade, extinguirUnidade } from '@/api/estrutura';
import { camposDe, mensagemDe } from '@/api/cliente';
import { nomeDoPapel } from '@/lib/papeis';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { hoje, mesAtual } from '@/lib/meses';
import { PainelDaArvore } from '@/componentes/EscolherUnidade';
import { montarArvore } from '@/lib/arvore-de-unidades';

/** A janela de uma ação sobre uma unidade: some quando a ação grava, e quem a abriu atualiza a árvore. */
type Comum = { no: NoDaArvore; aoFechar: () => void };

/** Depois de mudar a árvore: ela é buscada de novo, e as telas que dependem das unidades (seletor, lotação, escalas) também. */
export function useAtualizarArvore() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries();
}

/** Tudo o que uma ação pode dar de errado: a mensagem do campo (quando a API aponta um) e a geral. */
function useErros() {
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  return {
    campos, erro,
    limpar: () => { setCampos({}); setErro(null); },
    /** `soNoCampo`: a janela tem o campo que a API aponta, e a mensagem aparece embaixo dele; nas outras, a mensagem aparece sempre na janela. */
    registrar: (e: unknown, soNoCampo = false) => {
      const doCampo = camposDe(e);
      setCampos(doCampo);
      setErro(soNoCampo && Object.keys(doCampo).length ? null : mensagemDe(e));
    },
  };
}

const Erro = ({ texto }: { texto: string | null }) => (texto ? <p role="alert" className="text-sm text-alerta">{texto}</p> : null);

function Janela({ titulo, descricao, aoFechar, children }: { titulo: string; descricao?: ReactNode; aoFechar: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : <DialogDescription className="sr-only">{titulo}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

const OpcoesDeTipo = ({ tipos }: { tipos: TipoDeUnidadeComUso[] }) => tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>);

/** "Nova unidade abaixo de X": sigla, nome, tipo e o mês em que a unidade passa a valer. */
export function NovaUnidadeAbaixo({ no, tipos, aoFechar }: Comum & { tipos: TipoDeUnidadeComUso[] }) {
  const atualizar = useAtualizarArvore();
  const { campos, erro, limpar, registrar } = useErros();
  const { salvando, travar } = useTrava();
  const [sigla, setSigla] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState(tipos.find((t) => t.codigo === no.tipo.codigo)?.codigo ?? tipos[0]?.codigo ?? '');
  const [mes, setMes] = useState(mesAtual());
  const salvar = travar(async () => {
    limpar();
    try {
      await criarUnidade({ maeId: no.id, tipo, sigla, nome, desde: `${mes}-01` });
      atualizar();
      aoFechar();
    } catch (e) {
      // a unidade de cima (`maeId`) não tem campo na janela: sem outro campo apontado, a mensagem fica na janela
      registrar(e, !('maeId' in camposDe(e)));
    }
  });
  return (
    <Janela titulo={`Nova unidade abaixo de ${no.sigla}`} descricao="A unidade nova começa a valer no mês escolhido." aoFechar={aoFechar}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <Campo id="nu-sigla" rotulo="Sigla" erro={campos.sigla}><Input id="nu-sigla" value={sigla} onChange={(e) => setSigla(e.target.value)} maxLength={20} required autoFocus /></Campo>
        <Campo id="nu-nome" rotulo="Nome" erro={campos.nome}><Input id="nu-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required /></Campo>
        <Campo id="nu-tipo" rotulo="Tipo" erro={campos.tipo}><Selecao id="nu-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><OpcoesDeTipo tipos={tipos} /></Selecao></Campo>
        <Campo id="nu-mes" rotulo="Vale a partir de" erro={campos.desde}><Input id="nu-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} required /></Campo>
        <Erro texto={erro} />
        <DialogFooter>
          <Button type="button" variant="discreto" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" disabled={salvando || !tipo}>Criar unidade</Button>
        </DialogFooter>
      </form>
    </Janela>
  );
}

/** "Renomear": sigla, nome e tipo. Só o que mudou vai para a API. */
export function RenomearUnidade({ no, tipos, aoFechar }: Comum & { tipos: TipoDeUnidadeComUso[] }) {
  const atualizar = useAtualizarArvore();
  const { campos, erro, limpar, registrar } = useErros();
  const { salvando, travar } = useTrava();
  const [sigla, setSigla] = useState(no.sigla);
  const [nome, setNome] = useState(no.nome);
  const [tipo, setTipo] = useState(no.tipo.codigo);
  const mudou = { ...(sigla !== no.sigla ? { sigla } : {}), ...(nome !== no.nome ? { nome } : {}), ...(tipo !== no.tipo.codigo ? { tipo } : {}) };
  const salvar = travar(async () => {
    limpar();
    try {
      await alterarUnidade(no.id, mudou);
      atualizar();
      aoFechar();
    } catch (e) {
      registrar(e, !('maeId' in camposDe(e)));
    }
  });
  return (
    <Janela titulo={`Renomear ${no.sigla}`} aoFechar={aoFechar}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <Campo id="ru-sigla" rotulo="Sigla" erro={campos.sigla}><Input id="ru-sigla" value={sigla} onChange={(e) => setSigla(e.target.value)} maxLength={20} required autoFocus /></Campo>
        <Campo id="ru-nome" rotulo="Nome" erro={campos.nome}><Input id="ru-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required /></Campo>
        <Campo id="ru-tipo" rotulo="Tipo" erro={campos.tipo}>
          <Selecao id="ru-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {/* o tipo atual fica na lista mesmo que o cadastro de tipos tenha mudado */}
            {!tipos.some((t) => t.codigo === no.tipo.codigo) && <option value={no.tipo.codigo}>{no.tipo.nome}</option>}
            <OpcoesDeTipo tipos={tipos} />
          </Selecao>
        </Campo>
        <Erro texto={erro} />
        <DialogFooter>
          <Button type="button" variant="discreto" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" disabled={salvando || Object.keys(mudou).length === 0}>Salvar</Button>
        </DialogFooter>
      </form>
    </Janela>
  );
}

const quem = (p: PessoaNoEfeito) => `${p.nome}, ${nomeDoPapel(p.papel)} em ${p.unidadeSigla}`;

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium">{titulo}</p>
      <ul className="mt-0.5 list-disc pl-5 text-sm text-apagado">{itens.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

/** As unidades de uma árvore, em linha, cada uma com a unidade de cima: de onde sai a árvore de destino de um "mover". */
function achatar(no: NoDaArvore, maeId: string | null = null): { no: NoDaArvore; maeId: string | null }[] {
  return [{ no, maeId }, ...no.filhas.flatMap((f) => achatar(f, no.id))];
}
const dentroDe = (no: NoDaArvore): Set<string> => new Set(achatar(no).map((x) => x.no.id));

/**
 * "Mover para…": a árvore de destino (só as unidades que a pessoa edita, sem a própria unidade nem as de baixo) e, antes de salvar, o aviso do
 * efeito: quem passa a alcançar e quem deixa de alcançar, quem passa a ver, o que a unidade herda e quem passa a ser irmã dela.
 */
export function MoverUnidade({ no, arvore, aoFechar }: Comum & { arvore: NoDaArvore }) {
  const atualizar = useAtualizarArvore();
  const { erro, limpar, registrar } = useErros();
  const { salvando, travar } = useTrava();
  const [destino, setDestino] = useState('');
  const proprias = dentroDe(no);
  // os destinos são as unidades que a pessoa edita, fora a própria unidade e as de baixo; o resto da árvore só dá lugar a elas (passagem)
  const foraDaPropria = achatar(arvore).filter((x) => !proprias.has(x.no.id)).map((x) => ({ id: x.no.id, sigla: x.no.sigla, maeId: x.maeId, podeEditar: x.no.podeEditar }));
  const destinos = montarArvore(foraDaPropria.filter((x) => x.podeEditar), foraDaPropria);
  const efeito = useQuery({ ...consultaEfeitoDeMover(no.id, destino), enabled: destino !== '' });
  const mover = travar(async () => {
    limpar();
    try {
      await alterarUnidade(no.id, { maeId: destino });
      atualizar();
      aoFechar();
    } catch (e) {
      registrar(e);
    }
  });
  const e = efeito.data;
  return (
    <Janela titulo={`Mover ${no.sigla} para…`} descricao="Escolha a unidade de cima nova. A mudança vale na hora para quem tem nível de acesso nelas." aoFechar={aoFechar}>
      <form onSubmit={(ev: FormEvent) => { ev.preventDefault(); void mover(); }} className="grid gap-3">
        {/* pela árvore, nó a nó (6.45): a unidade que a pessoa não edita mas fica no caminho entra de passagem, e cada destino aparece no lugar dele */}
        <div className="grid gap-1">
          <p className="text-sm font-medium">Unidade de cima</p>
          <div className="max-h-72 overflow-hidden rounded-md border border-linha">
            <PainelDaArvore valor={destino} grupos={[{ rotulo: 'Unidade de cima', nos: destinos, aoEscolher: setDestino }]} />
          </div>
        </div>
        {destino !== '' && efeito.isPending && <p className="text-sm text-apagado">Calculando o que muda…</p>}
        {efeito.error && <p role="alert" className="text-sm text-alerta">{mensagemDe(efeito.error)}</p>}
        {e && (
          <div className="grid gap-2 rounded-md border border-linha bg-fundo/60 p-3" aria-label="O que muda">
            <p className="text-sm font-medium">O que muda ao mover {no.sigla}</p>
            <Lista titulo="Passam a alcançar a unidade" itens={e.passamAAlcancar.map(quem)} />
            <Lista titulo="Deixam de alcançar a unidade" itens={e.deixamDeAlcancar.map(quem)} />
            <Lista titulo="Passam a ver a unidade, sem editar" itens={e.passamAVer.map(quem)} />
            <Lista titulo="Deixam de ver a unidade" itens={e.deixamDeVer.map(quem)} />
            <Lista titulo="Passa a herdar" itens={e.passaAHerdar.map((h) => `${h.unidadeSigla}: ${[h.parametros && `${h.parametros} parâmetros`, h.feriados && `${h.feriados} feriados`, h.funcoes && `${h.funcoes} funções`].filter(Boolean).join(', ')}`)} />
            <Lista titulo="Deixa de herdar" itens={e.deixaDeHerdar.map((h) => `${h.unidadeSigla}: ${[h.parametros && `${h.parametros} parâmetros`, h.feriados && `${h.feriados} feriados`, h.funcoes && `${h.funcoes} funções`].filter(Boolean).join(', ')}`)} />
            <Lista titulo="Passam a ser irmãs dela" itens={e.irmasNovas} />
            {[e.passamAAlcancar, e.deixamDeAlcancar, e.passamAVer, e.deixamDeVer, e.passaAHerdar, e.deixaDeHerdar, e.irmasNovas].every((l) => l.length === 0) && (
              <p className="text-sm text-apagado">Ninguém muda de alcance e nada muda no que a unidade herda.</p>
            )}
          </div>
        )}
        <Erro texto={erro} />
        <DialogFooter>
          <Button type="button" variant="discreto" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" disabled={salvando || !e}>Mover</Button>
        </DialogFooter>
      </form>
    </Janela>
  );
}

/** O que está ligado à unidade, em uma frase: o histórico (nada some ao extinguir) e o que ainda precisa mudar de lugar. */
export function oQueEstaLigado(no: NoDaArvore): string {
  return no.ligados.historico.join(', ');
}

/** "Extinguir": a unidade deixa de valer depois do último dia escolhido e some das escolhas; o histórico fica. */
export function ExtinguirUnidade({ no, aoFechar }: Comum) {
  const atualizar = useAtualizarArvore();
  const { erro, limpar, registrar } = useErros();
  const { salvando, travar } = useTrava();
  const [ate, setAte] = useState(hoje());
  const preso = no.ligados.unidades > 0 || no.ligados.militaresHoje > 0;
  const salvar = travar(async () => {
    limpar();
    try {
      await extinguirUnidade(no.id, ate);
      atualizar();
      aoFechar();
    } catch (e) {
      registrar(e);
    }
  });
  return (
    <Janela titulo={`Extinguir ${no.sigla}?`} descricao="A unidade deixa de valer depois do último dia escolhido e some das escolhas. O histórico dela continua." aoFechar={aoFechar}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        {no.ligados.historico.length > 0 && <p className="text-sm text-apagado">Ligado a esta unidade: {oQueEstaLigado(no)}. Por isso ela se extingue, e não se exclui.</p>}
        {preso && <p className="text-sm">{`Antes de extinguir, mova ${no.ligados.unidades} unidades e ${no.ligados.militaresHoje} militares lotados.`}</p>}
        <Campo id="ex-ate" rotulo="Último dia da unidade"><Input id="ex-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} required /></Campo>
        <Erro texto={erro} />
        <DialogFooter>
          <Button type="button" variant="discreto" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" disabled={salvando || !ate}>Extinguir</Button>
        </DialogFooter>
      </form>
    </Janela>
  );
}

/** "Excluir": só para a unidade sem nada ligado, e não se desfaz. */
export function ExcluirUnidade({ no, aoFechar }: Comum) {
  const atualizar = useAtualizarArvore();
  const { erro, limpar, registrar } = useErros();
  const { salvando, travar } = useTrava();
  const excluir = travar(async () => {
    limpar();
    try {
      await excluirUnidade(no.id);
      atualizar();
      aoFechar();
    } catch (e) {
      registrar(e);
    }
  });
  return (
    <Janela titulo={`Excluir ${no.sigla}?`} descricao="A unidade não tem nada ligado a ela. Excluir não se desfaz." aoFechar={aoFechar}>
      <Erro texto={erro} />
      <DialogFooter>
        <Button type="button" variant="discreto" onClick={aoFechar}>Cancelar</Button>
        <Button type="button" variant="perigoso-cheio" disabled={salvando} onClick={() => void excluir()}>Excluir</Button>
      </DialogFooter>
    </Janela>
  );
}
