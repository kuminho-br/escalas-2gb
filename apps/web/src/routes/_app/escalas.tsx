import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import type { LinhaEscala } from 'contratos';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarEscalas, consultaEscalas, criarEscala } from '@/api/escalas';
import { atualizarGuarnicoes } from '@/api/guarnicoes';
import { atualizarServicos } from '@/api/servicos';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { classeItemEscolhido, ListaDetalhe } from '@/componentes/ListaDetalhe';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/escalas')({
  component: Escalas,
});

function Escalas() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { id } = useParams({ strict: false });
  const [nova, setNova] = useState(false);
  return (
    <ListaDetalhe
      titulo="Escalas"
      temDetalhe={Boolean(id)}
      acoes={
        <>
          <ImportarPlanilha
            cadastro="servicos-escalas"
            rotulo="os serviços, turnos e escalas"
            aoConcluir={() => {
              atualizarServicos(queryClient);
              atualizarEscalas(queryClient);
              atualizarGuarnicoes(queryClient);
            }}
          />
          <Button onClick={() => setNova(true)}>
            <Plus aria-hidden />
            Nova escala
          </Button>
          {nova && <NovaEscalaDialogo unidadeId={eu.unidade.id} aoFechar={() => setNova(false)} />}
        </>
      }
      lista={<ListaDeEscalas unidadeId={eu.unidade.id} escolhida={id} />}
      detalhe={<Outlet />}
    />
  );
}

function ListaDeEscalas({ unidadeId, escolhida }: { unidadeId: string; escolhida?: string }) {
  const escalas = useQuery(consultaEscalas(unidadeId));
  const [desativadas, setDesativadas] = useState(false);
  const visiveis = escalas.data?.filter((e) => e.ativa || desativadas) ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {escalas.isPending && <p className="p-4 text-apagado">Carregando…</p>}
      {escalas.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(escalas.error)}</p>}
      {escalas.data && (
        <>
          <p className="shrink-0 border-b border-linha px-4 pt-3 pb-2 text-xs text-apagado">{visiveis.length} escalas</p>
          <ul data-lista-rolavel className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {visiveis.map((e) => <ItemEscala key={e.id} e={e} escolhida={e.id === escolhida} />)}
            {escalas.data.length === 0 && <li className="p-3 text-apagado">Nenhuma escala. Use "Nova escala" ou "Importar da planilha".</li>}
            {escalas.data.length > 0 && visiveis.length === 0 && <li className="p-3 text-apagado">Todas as escalas estão desativadas. Marque "Mostrar desativadas" para vê-las.</li>}
          </ul>
          <label className="flex shrink-0 items-center gap-2 border-t border-linha px-4 py-2.5 text-xs text-apagado">
            <input type="checkbox" checked={desativadas} onChange={(ev) => setDesativadas(ev.target.checked)} className="size-4 accent-vinho" />
            Mostrar desativadas
          </label>
        </>
      )}
    </div>
  );
}

function ItemEscala({ e, escolhida }: { e: LinhaEscala; escolhida: boolean }) {
  return (
    <li>
      <Link
        to="/escalas/$id"
        params={{ id: e.id }}
        className={cn('grid gap-0.5 rounded-lg px-3 py-2 hover:bg-accent', escolhida && classeItemEscolhido, !e.ativa && 'opacity-70')}
        aria-current={escolhida ? 'page' : undefined}
      >
        <span className="flex items-center gap-2">
          <span className="font-cond text-base font-semibold">{e.nome}</span>
          {!e.ativa && <span className="ml-auto rounded border border-linha px-1.5 text-xs">desativada</span>}
        </span>
        <span className="text-xs text-apagado">{e.servicos.length ? e.servicos.join(', ') : 'sem serviços'}</span>
      </Link>
    </li>
  );
}

function NovaEscalaDialogo({ unidadeId, aoFechar }: { unidadeId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function criar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setErro(null);
    setSalvando(true);
    try {
      const e = await criarEscala(unidadeId, String(f.get('nome')).trim());
      atualizarEscalas(queryClient);
      aoFechar();
      await navigate({ to: '/escalas/$id', params: { id: e.id } });
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
          <DialogTitle>Nova escala</DialogTitle>
          <DialogDescription>Depois de criar, reúna os serviços e ligue as guarnições na ficha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={criar} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ne-nome">Nome da escala</Label>
            <Input id="ne-nome" name="nome" required />
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
