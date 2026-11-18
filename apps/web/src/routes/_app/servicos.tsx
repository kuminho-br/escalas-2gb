import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { TipoServico, type Servico } from 'contratos';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarEscalas } from '@/api/escalas';
import { atualizarGuarnicoes } from '@/api/guarnicoes';
import { atualizarServicos, consultaServicos, criarServico } from '@/api/servicos';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { classeItemEscolhido, ListaDetalhe } from '@/componentes/ListaDetalhe';
import { QuadradoDaCor } from '@/componentes/QuadradoDaCor';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { corSugerida, NOME_TIPO } from '@/lib/servicos';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/servicos')({
  component: Servicos,
});

function Servicos() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { id } = useParams({ strict: false });
  const [novo, setNovo] = useState(false);
  return (
    <ListaDetalhe
      titulo="Serviços"
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
          <Button onClick={() => setNovo(true)}>
            <Plus aria-hidden />
            Novo serviço
          </Button>
          {novo && <NovoServicoDialogo unidadeId={eu.unidade.id} aoFechar={() => setNovo(false)} />}
        </>
      }
      lista={<ListaDeServicos unidadeId={eu.unidade.id} escolhido={id} />}
      detalhe={<Outlet />}
    />
  );
}

function ListaDeServicos({ unidadeId, escolhido }: { unidadeId: string; escolhido?: string }) {
  const servicos = useQuery(consultaServicos(unidadeId));
  const [desativados, setDesativados] = useState(false);
  const visiveis = servicos.data?.filter((s) => s.ativo || desativados) ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {servicos.isPending && <p className="p-4 text-apagado">Carregando…</p>}
      {servicos.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(servicos.error)}</p>}
      {servicos.data && (
        <>
          <div data-lista-rolavel className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {TipoServico.options.map((tipo) => {
              const doTipo = visiveis.filter((s) => s.tipo === tipo);
              if (!doTipo.length) return null;
              return (
                <section key={tipo}>
                  <h2 className="border-b border-linha px-4 pt-3 pb-2 text-xs text-apagado">{NOME_TIPO[tipo]}</h2>
                  <ul className="p-2">
                    {doTipo.map((s) => <ItemServico key={s.id} s={s} escolhido={s.id === escolhido} />)}
                  </ul>
                </section>
              );
            })}
            {servicos.data.length === 0 && <p className="p-4 text-apagado">Nenhum serviço. Use "Novo serviço" ou "Importar da planilha".</p>}
            {servicos.data.length > 0 && visiveis.length === 0 && <p className="p-4 text-apagado">Todos os serviços estão desativados. Marque "Mostrar desativados" para vê-los.</p>}
          </div>
          <label className="flex shrink-0 items-center gap-2 border-t border-linha px-4 py-2.5 text-xs text-apagado">
            <input type="checkbox" checked={desativados} onChange={(e) => setDesativados(e.target.checked)} className="size-4 accent-vinho" />
            Mostrar desativados
          </label>
        </>
      )}
    </div>
  );
}

function ItemServico({ s, escolhido }: { s: Servico; escolhido: boolean }) {
  return (
    <li>
      <Link
        to="/servicos/$id"
        params={{ id: s.id }}
        className={cn('flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent', escolhido && classeItemEscolhido, !s.ativo && 'opacity-70')}
        aria-current={escolhido ? 'page' : undefined}
      >
        <QuadradoDaCor cor={s.cor} />
        <span className="font-cond text-base font-semibold">{s.nome}</span>
        <span className="text-xs text-apagado">{s.turnos.map((t) => t.letra).join(' ')}</span>
        {!s.ativo && <span className="ml-auto rounded border border-linha px-1.5 text-xs">desativado</span>}
      </Link>
    </li>
  );
}

function NovoServicoDialogo({ unidadeId, aoFechar }: { unidadeId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get('nome')).trim();
    setErro(null);
    setSalvando(true);
    try {
      const s = await criarServico(unidadeId, { nome, tipo: TipoServico.parse(f.get('tipo')), operacao: null, rotuloImpressao: null, cor: corSugerida(nome) });
      atualizarServicos(queryClient);
      aoFechar();
      await navigate({ to: '/servicos/$id', params: { id: s.id } });
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
          <DialogTitle>Novo serviço</DialogTitle>
          <DialogDescription>Depois de criar, inclua os turnos na ficha.</DialogDescription>
        </DialogHeader>
        <form onSubmit={criar} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ns-nome">Nome do serviço</Label>
            <Input id="ns-nome" name="nome" required />
          </div>
          <div className="grid gap-1.5 sm:max-w-56">
            <Label htmlFor="ns-tipo">Tipo</Label>
            <Selecao id="ns-tipo" name="tipo" defaultValue="ordinario">
              {TipoServico.options.map((t) => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}
            </Selecao>
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
