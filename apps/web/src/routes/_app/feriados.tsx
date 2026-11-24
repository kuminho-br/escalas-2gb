import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { Feriado } from 'contratos';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemComCampo, mensagemDe } from '@/api/cliente';
import { atualizarFeriados, consultaFeriados, copiarFeriadosFixos, criarFeriado, editarFeriado, removerFeriado } from '@/api/feriados';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { Selecao } from '@/componentes/Selecao';
import { useDescartarDigitado } from '@/componentes/DescartarDigitado';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { hoje } from '@/lib/meses';

export const Route = createFileRoute('/_app/feriados')({
  component: Feriados,
});

const diaMes = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;
const diaDaSemana = (data: string) => new Date(`${data}T00:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });

function Feriados() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const anoAtual = Number(hoje().slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const feriados = useQuery(consultaFeriados(eu.unidade.id, ano));
  const [dialogo, setDialogo] = useState<{ feriado?: Feriado } | null>(null);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const anos = [...new Set([...Array.from({ length: 7 }, (_, i) => anoAtual - 3 + i), ano])].sort();

  const { salvando: copiando, travar } = useTrava();
  // travada: dois cliques seguidos mandam um pedido só, e o botão fica apagado enquanto copia
  const copiar = travar(async () => {
    setAviso(null);
    try {
      const { copiados } = await copiarFeriadosFixos(eu.unidade.id, ano - 1, ano);
      atualizarFeriados(queryClient);
      setAviso({
        erro: false,
        texto:
          copiados === 0
            ? `Nenhum feriado novo: os fixos de ${ano - 1} já estão em ${ano}, ou não há nenhum.`
            : `${copiados} ${copiados === 1 ? 'feriado copiado' : 'feriados copiados'}.`,
      });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  });

  // o feriado de outro ano some da lista do ano que está aberta: troca para o ano dele e diz isso
  function salvou(f: Feriado) {
    const doAno = Number(f.data.slice(0, 4));
    if (doAno === ano) return;
    setAno(doAno);
    setAviso({ erro: false, texto: `Feriado salvo em ${doAno}.` });
  }

  async function remover(f: Feriado) {
    if (!window.confirm(`Remover o feriado "${f.descricao}" (${diaMes(f.data)})?`)) return;
    setAviso(null);
    try {
      await removerFeriado(f.id);
      atualizarFeriados(queryClient);
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cond text-titulo leading-tight font-semibold">Feriados</h1>
        <div className="flex flex-wrap gap-2">
          <ImportarPlanilha cadastro="feriados" rotulo="os feriados" aoConcluir={() => atualizarFeriados(queryClient)} />
          <Button variant="outline" disabled={copiando} onClick={() => void copiar()}>Copiar feriados fixos de {ano - 1}</Button>
          <Button onClick={() => setDialogo({})}>
            <Plus aria-hidden />
            Novo feriado
          </Button>
        </div>
      </header>

      <div className="mt-6 rounded-xl border border-linha bg-superficie">
        <div className="flex flex-wrap items-end gap-4 border-b border-linha p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="feriados-ano">Ano</Label>
            <Selecao id="feriados-ano" value={String(ano)} onChange={(e) => setAno(Number(e.target.value))} className="w-32">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </Selecao>
          </div>
          {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'pb-2 text-sm text-alerta' : 'pb-2 text-sm text-apagado'}>{aviso.texto}</p>}
        </div>

        {feriados.isPending && <p className="p-4 text-apagado">Carregando…</p>}
        {feriados.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(feriados.error)}</p>}
        {feriados.data && feriados.data.length === 0 && (
          <p className="p-4 text-apagado">Nenhum feriado em {ano}. Use "Novo feriado" ou "Copiar feriados fixos de {ano - 1}".</p>
        )}
        {feriados.data && feriados.data.length > 0 && (
          <ul className="p-2">
            {feriados.data.map((f) => <ItemFeriado key={f.id} f={f} aoEditar={() => setDialogo({ feriado: f })} aoRemover={() => void remover(f)} />)}
          </ul>
        )}
      </div>

      {dialogo && <FeriadoDialogo key={dialogo.feriado?.id ?? 'novo'} unidadeId={eu.unidade.id} ano={ano} feriado={dialogo.feriado} aoFechar={() => setDialogo(null)} aoSalvar={salvou} />}
    </section>
  );
}

function ItemFeriado({ f, aoEditar, aoRemover }: { f: Feriado; aoEditar: () => void; aoRemover: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent">
      <span className="w-14 shrink-0 font-cond text-base font-semibold">{diaMes(f.data)}</span>
      <span className="w-28 shrink-0 text-xs text-apagado">{diaDaSemana(f.data)}</span>
      <span className={f.herdado ? 'text-apagado' : 'font-medium'}>{f.descricao}</span>
      {!f.fixo && <span className="rounded border border-linha px-1.5 text-xs">móvel</span>}
      {f.herdado ? (
        <span className="ml-auto rounded border border-linha px-1.5 text-xs text-apagado" title="Cadastrado numa unidade acima: não se edita aqui">
          {f.unidadeSigla}
          <span className="sr-only">cadastrado em {f.unidadeSigla}; não se edita aqui</span>
        </span>
      ) : (
        <span className="ml-auto flex gap-1">
          <Button type="button" size="icon" variant="ghost" aria-label={`Editar ${f.descricao}`} onClick={aoEditar}>
            <Pencil aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Remover ${f.descricao}`} onClick={aoRemover}>
            <Trash2 aria-hidden />
          </Button>
        </span>
      )}
    </li>
  );
}

function FeriadoDialogo({ unidadeId, ano, feriado, aoFechar, aoSalvar }: { unidadeId: string; ano: number; feriado?: Feriado; aoFechar: () => void; aoSalvar: (f: Feriado) => void }) {
  const queryClient = useQueryClient();
  const descarte = useDescartarDigitado(aoFechar);
  const [data, setData] = useState(feriado?.data ?? `${ano}-01-01`);
  const [descricao, setDescricao] = useState(feriado?.descricao ?? '');
  const [fixo, setFixo] = useState(feriado?.fixo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const dados = { data, descricao: descricao.trim(), fixo };
    try {
      const salvo = feriado ? await editarFeriado(feriado.id, dados) : await criarFeriado(unidadeId, dados);
      atualizarFeriados(queryClient);
      aoFechar();
      aoSalvar(salvo);
    } catch (err) {
      setErro(mensagemComCampo(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={descarte.aoMudarAberto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{feriado ? 'Editar feriado' : 'Novo feriado'}</DialogTitle>
          <DialogDescription>O feriado vale para esta seção e para as de baixo.</DialogDescription>
        </DialogHeader>
        <form ref={descarte.ref} onSubmit={salvar} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor="fr-data">Data</Label>
              <Input id="fr-data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fr-descricao">Descrição</Label>
              <Input id="fr-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} required />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fixo} onChange={(e) => setFixo(e.target.checked)} className="size-4 accent-vinho" />
            Cai no mesmo dia todo ano
          </label>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando}>Salvar</Button>
          </DialogFooter>
        </form>
        {descarte.confirmacao}
      </DialogContent>
    </Dialog>
  );
}
