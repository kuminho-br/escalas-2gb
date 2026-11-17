import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import type { LinhaGuarnicao } from 'contratos';
import { Plus, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaCatalogo } from '@/api/configuracoes';
import { atualizarGuarnicoes, consultaGuarnicoes, criarGuarnicao } from '@/api/guarnicoes';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { ListaDetalhe } from '@/componentes/ListaDetalhe';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
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
  return (
    <div>
      {guarnicoes.isPending && <p className="p-4 text-apagado">Carregando…</p>}
      {guarnicoes.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(guarnicoes.error)}</p>}
      {guarnicoes.data && (
        <>
          <p className="px-4 pt-3 text-xs text-apagado">Em ordem de ativação · {guarnicoes.data.length} guarnições</p>
          <ul className="max-h-[calc(100dvh-14rem)] overflow-y-auto p-2">
            {guarnicoes.data.map((g) => <ItemGuarnicao key={g.id} g={g} escolhida={g.id === escolhida} />)}
            {guarnicoes.data.length === 0 && <li className="p-3 text-apagado">Nenhuma guarnição. Use "Nova guarnição" ou "Importar da planilha".</li>}
          </ul>
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
        className={cn('grid gap-0.5 rounded-lg px-3 py-2 hover:bg-accent', escolhida && 'bg-accent ring-1 ring-linha', !g.ativa && 'opacity-70')}
      >
        <span className="flex items-center gap-2">
          <span className="font-cond text-base font-semibold">{g.nome}</span>
          {g.pendencias.length > 0 && <TriangleAlert className="size-4 text-alerta" role="img" aria-label={`Cadastro incompleto: ${g.pendencias.join('; ')}`} />}
          {!g.ativa && <span className="ml-auto rounded border border-linha px-1.5 text-xs">inativa</span>}
        </span>
        <span className="flex flex-wrap gap-x-3 text-xs text-apagado">
          {g.atividade && <span>{g.atividade}</span>}
          {g.viatura && <span>{g.viatura}</span>}
          <span>{g.vagasObrigatorias} vagas obrigatórias</span>
          {g.aPartirDe && <span className="font-medium text-tinta">a partir de {mesPorExtenso(g.aPartirDe)}</span>}
        </span>
      </Link>
    </li>
  );
}

function NovaGuarnicaoDialogo({ unidadeId, aoFechar }: { unidadeId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const atividades = useQuery(consultaCatalogo('atividades'));
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
        atividadeId: String(f.get('atividade')) || null,
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ng-atividade">Atividade</Label>
              <Selecao id="ng-atividade" name="atividade" defaultValue="">
                <option value="">Escolher depois</option>
                {atividades.data?.filter((a) => a.ativo).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </Selecao>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ng-desde">Vale desde</Label>
              <Input id="ng-desde" name="desde" type="month" defaultValue={mesAtual()} min={mesAtual()} required />
            </div>
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
