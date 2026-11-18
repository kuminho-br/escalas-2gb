import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import type { LinhaGuarnicao } from 'contratos';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarGuarnicoes, consultaGuarnicoes, criarGuarnicao } from '@/api/guarnicoes';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { classeItemEscolhido, ListaDetalhe } from '@/componentes/ListaDetalhe';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { limites } from '@/lib/guarnicoes';
import { mesAtual } from '@/lib/meses';
import { mesPorExtenso } from 'contratos';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/guarnicoes')({
  component: Guarnicoes,
});

function Guarnicoes() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { id } = useParams({ strict: false });
  const [nova, setNova] = useState(false);

  return (
    <ListaDetalhe
      titulo="Guarnições"
      temDetalhe={Boolean(id)}
      acoes={
        <>
          <ImportarPlanilha cadastro="guarnicoes" rotulo="as guarnições" aoConcluir={() => atualizarGuarnicoes(queryClient)} />
          <Button onClick={() => setNova(true)}>
            <Plus aria-hidden />
            Nova guarnição
          </Button>
          {nova && <NovaGuarnicaoDialogo unidadeId={eu.unidade.id} aoFechar={() => setNova(false)} />}
        </>
      }
      lista={<ListaDeGuarnicoes unidadeId={eu.unidade.id} escolhida={id} />}
      detalhe={<Outlet />}
    />
  );
}

function ListaDeGuarnicoes({ unidadeId, escolhida }: { unidadeId: string; escolhida?: string }) {
  const guarnicoes = useQuery(consultaGuarnicoes(unidadeId, mesAtual()));
  const [desativadas, setDesativadas] = useState(false);
  const visiveis = guarnicoes.data?.filter((g) => g.ativa || desativadas) ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {guarnicoes.isPending && <p className="p-4 text-apagado">Carregando…</p>}
      {guarnicoes.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(guarnicoes.error)}</p>}
      {guarnicoes.data && (
        <>
          <p className="shrink-0 border-b border-linha px-4 pt-3 pb-2 text-xs text-apagado">{visiveis.length} {visiveis.length === 1 ? 'guarnição' : 'guarnições'}</p>
          <ul data-lista-rolavel className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {visiveis.map((g) => <ItemGuarnicao key={g.id} g={g} escolhida={g.id === escolhida} />)}
            {guarnicoes.data.length === 0 && <li className="p-3 text-apagado">Nenhuma guarnição. Use "Nova guarnição" ou "Importar da planilha".</li>}
            {guarnicoes.data.length > 0 && visiveis.length === 0 && <li className="p-3 text-apagado">Todas as guarnições estão desativadas. Marque "Mostrar desativadas" para vê-las.</li>}
          </ul>
          <label className="flex shrink-0 items-center gap-2 border-t border-linha px-4 py-2.5 text-xs text-apagado">
            <input type="checkbox" checked={desativadas} onChange={(e) => setDesativadas(e.target.checked)} className="size-4 accent-vinho" />
            Mostrar desativadas
          </label>
        </>
      )}
    </div>
  );
}

function ItemGuarnicao({ g, escolhida }: { g: LinhaGuarnicao; escolhida: boolean }) {
  return (
    <li>
      <Link
        to="/guarnicoes/$id"
        params={{ id: g.id }}
        className={cn('grid gap-0.5 rounded-lg px-3 py-2 hover:bg-accent', escolhida && classeItemEscolhido, !g.ativa && 'opacity-70')}
        aria-current={escolhida ? 'page' : undefined}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden title={g.prioridade ? `Ativada em ${g.prioridade}º lugar` : 'Sem prioridade: vai por último na ativação'} className="grid size-6 shrink-0 place-items-center rounded-full bg-fundo font-cond text-[13px] font-semibold">
            {g.prioridade ?? '–'}
          </span>
          <span className="font-cond text-base font-semibold">{g.nome}</span>
          {!g.ativa && <span className="ml-auto rounded border border-linha px-1.5 text-xs">desativada</span>}
        </span>
        <span className="flex flex-wrap gap-x-3 text-xs text-apagado">
          {g.viatura && <span>{g.viatura}</span>}
          <span>{limites(g)}</span>
          {g.aPartirDe && <span className="font-medium text-tinta">a partir de {mesPorExtenso(g.aPartirDe)}</span>}
        </span>
      </Link>
    </li>
  );
}

function NovaGuarnicaoDialogo({ unidadeId, aoFechar }: { unidadeId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro(null);
    setSalvando(true);
    try {
      const ficha = await criarGuarnicao(unidadeId, {
        nome: String(f.get('nome')).trim(),
        vigencia: String(f.get('desde')),
        versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [] },
      });
      atualizarGuarnicoes(queryClient);
      aoFechar();
      await navigate({ to: '/guarnicoes/$id', params: { id: ficha.id } });
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova guarnição</DialogTitle>
          <DialogDescription>Depois de criar, monte a composição na ficha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={criar} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ng-nome">Nome da guarnição</Label>
            <Input id="ng-nome" name="nome" required />
          </div>
          <div className="grid gap-1.5 sm:max-w-56">
            <Label htmlFor="ng-desde">Vale desde</Label>
            <Input id="ng-desde" name="desde" type="month" defaultValue={mesAtual()} min={mesAtual()} required />
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando}>Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
