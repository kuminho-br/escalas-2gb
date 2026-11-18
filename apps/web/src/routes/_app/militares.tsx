import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import type { LinhaMilitar } from 'contratos';
import { TriangleAlert, UserPlus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarMilitares, consultaEquipes, consultaMilitares, consultaPostos, criarMilitar } from '@/api/militares';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { ListaDetalhe } from '@/componentes/ListaDetalhe';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { normalizarBusca } from '@/lib/texto';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/militares')({
  component: Militares,
});

export const NOME_JORNADA = { pronto: 'Pronto', adm: 'Adm' } as const;

function Militares() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { id } = useParams({ strict: false });
  const [novo, setNovo] = useState(false);

  return (
    <ListaDetalhe
      titulo="Militares"
      temDetalhe={Boolean(id)}
      acoes={
        <>
          <ImportarPlanilha cadastro="militares" rotulo="os militares" aoConcluir={() => atualizarMilitares(queryClient)} />
          <Button onClick={() => setNovo(true)}>
            <UserPlus aria-hidden />
            Novo militar
          </Button>
          {novo && <NovoMilitarDialogo unidadeId={eu.unidade.id} aoFechar={() => setNovo(false)} />}
        </>
      }
      lista={<ListaDeMilitares unidadeId={eu.unidade.id} escolhido={id} />}
      detalhe={<Outlet />}
    />
  );
}

function ListaDeMilitares({ unidadeId, escolhido }: { unidadeId: string; escolhido?: string }) {
  const mes = mesAtual();
  const militares = useQuery(consultaMilitares(unidadeId, mes));
  const equipes = useQuery(consultaEquipes(unidadeId));
  const [equipe, setEquipe] = useState('');
  const [jornada, setJornada] = useState('');
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const b = normalizarBusca(busca);
    return (militares.data ?? []).filter(
      (m) =>
        (!equipe || m.equipe === equipe) &&
        (!jornada || m.jornada === jornada) &&
        (!b || normalizarBusca(`${m.nomeGuerra} ${m.matricula}`).includes(b)),
    );
  }, [militares.data, equipe, jornada, busca]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 gap-2 border-b border-linha p-3">
        <div className="grid gap-1">
          <Label htmlFor="busca-militar" className="sr-only">Buscar por nome ou matrícula</Label>
          <Input id="busca-militar" placeholder="Buscar por nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="filtro-equipe" className="text-xs text-apagado">Equipe</Label>
            <Selecao id="filtro-equipe" value={equipe} onChange={(e) => setEquipe(e.target.value)}>
              <option value="">Todas</option>
              {equipes.data?.map((e) => <option key={e.id} value={e.nome}>{e.nome}</option>)}
            </Selecao>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filtro-jornada" className="text-xs text-apagado">Jornada</Label>
            <Selecao id="filtro-jornada" value={jornada} onChange={(e) => setJornada(e.target.value)}>
              <option value="">Todas</option>
              <option value="pronto">Pronto</option>
              <option value="adm">Adm</option>
            </Selecao>
          </div>
        </div>
      </div>
      {militares.isPending && <p className="p-4 text-apagado">Carregando…</p>}
      {militares.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(militares.error)}</p>}
      {militares.data && (
        <>
          <p className="shrink-0 px-4 pt-3 text-xs text-apagado">{filtrados.length} de {militares.data.length} militares</p>
          <ul data-lista-rolavel className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {filtrados.map((m) => <ItemMilitar key={m.id} m={m} escolhido={m.id === escolhido} />)}
            {militares.data.length === 0 && <li className="p-3 text-apagado">Nenhum militar lotado. Use "Novo militar" ou "Importar da planilha".</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function ItemMilitar({ m, escolhido }: { m: LinhaMilitar; escolhido: boolean }) {
  const disponivel = m.situacao === 'Disponível';
  return (
    <li>
      <Link
        to="/militares/$id"
        params={{ id: m.id }}
        className={cn('grid gap-0.5 rounded-lg px-3 py-2 hover:bg-accent', escolhido && 'bg-accent ring-1 ring-linha')}
      >
        <span className="flex items-center gap-2">
          <span className="font-cond text-[13px] text-apagado">{m.posto}</span>
          <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
          {m.pendencias.length > 0 && (
            <TriangleAlert
              className="size-4 text-alerta"
              role="img"
              aria-label={`Cadastro incompleto: ${m.pendencias.join('; ')}`}
            />
          )}
          {m.motorista && <span className="ml-auto rounded border border-linha px-1.5 font-cond text-xs">Motorista {m.motorista}</span>}
        </span>
        <span className="flex flex-wrap gap-x-3 text-xs text-apagado">
          <span>{m.matricula}</span>
          {m.jornada && <span>{NOME_JORNADA[m.jornada]}{m.equipe ? ` ${m.equipe}` : ''}</span>}
          <span className={disponivel ? '' : 'font-medium text-tinta'}>{m.situacao}</span>
        </span>
      </Link>
    </li>
  );
}

function NovoMilitarDialogo({ unidadeId, aoFechar }: { unidadeId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const postos = useQuery(consultaPostos);
  const equipes = useQuery(consultaEquipes(unidadeId));
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  async function cadastrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const antiguidade = String(f.get('antiguidade') ?? '').trim();
    setErro(null);
    setSalvando(true);
    try {
      const ficha = await criarMilitar(unidadeId, {
        matricula: String(f.get('matricula')).trim(),
        postoGradId: String(f.get('posto')),
        nomeGuerra: String(f.get('nomeGuerra')).trim().toUpperCase(),
        antiguidade: antiguidade ? Number(antiguidade) : null,
        motorista: false,
        cnh: [],
        voluntarioJes: false,
        lotacao: { equipeId: String(f.get('equipe')) || null, jornada: f.get('jornada') === 'adm' ? 'adm' : 'pronto', desde: String(f.get('desde')) },
      });
      atualizarMilitares(queryClient);
      aoFechar();
      await navigate({ to: '/militares/$id', params: { id: ficha.id } });
    } catch (err) {
      setErro(mensagemDe(err));
      setCampos((err as { campos?: Record<string, string> }).campos ?? {});
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo militar</DialogTitle>
          <DialogDescription>Motorista, CNH e afastamentos ficam na ficha, depois de cadastrar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={cadastrar} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo id="nm-matricula" rotulo="Matrícula" erro={campos.matricula}>
              <Input id="nm-matricula" name="matricula" placeholder="123456-7" required />
            </Campo>
            <Campo id="nm-posto" rotulo="Posto ou graduação">
              <Selecao id="nm-posto" name="posto" required>
                {postos.data?.map((p) => <option key={p.id} value={p.id}>{p.sigla}</option>)}
              </Selecao>
            </Campo>
          </div>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Campo id="nm-nome" rotulo="Nome de guerra" erro={campos.nomeGuerra}>
              <Input id="nm-nome" name="nomeGuerra" required />
            </Campo>
            <Campo id="nm-antig" rotulo="Antiguidade" erro={campos.antiguidade}>
              <Input id="nm-antig" name="antiguidade" type="number" min={1} />
            </Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo id="nm-equipe" rotulo="Equipe">
              <Selecao id="nm-equipe" name="equipe" defaultValue="">
                <option value="">Sem equipe</option>
                {equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Selecao>
            </Campo>
            <Campo id="nm-jornada" rotulo="Jornada">
              <Selecao id="nm-jornada" name="jornada" defaultValue="pronto">
                <option value="pronto">Pronto</option>
                <option value="adm">Adm</option>
              </Selecao>
            </Campo>
            <Campo id="nm-desde" rotulo="Lotado desde">
              <Input id="nm-desde" name="desde" type="month" defaultValue={mesAtual()} required />
            </Campo>
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando || !postos.data}>Cadastrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Campo({ id, rotulo, erro, children }: { id: string; rotulo: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {erro && <p className="text-xs text-alerta">{erro}</p>}
    </div>
  );
}
