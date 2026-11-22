import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mes, somarMeses } from 'contratos';
import { useState } from 'react';
import { ehGestorOuAdministrador } from '@/api/eu';
import { mensagemDe } from '@/api/cliente';
import { consultaEscalaDosOficiais, consultaSaldoDosOficiais, escolherServico } from '@/api/oficiais';
import { consultaServicos } from '@/api/servicos';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { EscalaDoMes } from '@/componentes/oficiais/EscalaDoMes';
import { PainelDeSaldo } from '@/componentes/oficiais/PainelDeSaldo';
import { RegrasDosOficiais } from '@/componentes/oficiais/RegrasDosOficiais';
import { Selecao } from '@/componentes/Selecao';
import { Label } from '@/componentes/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { mesAtual } from '@/lib/meses';

type Aba = 'escala' | 'saldo' | 'regras';
const ABAS: Aba[] = ['escala', 'saldo', 'regras'];

export const Route = createFileRoute('/_app/oficiais')({
  // o auxiliar não usa esta tela: volta ao início com o aviso, como nos outros módulos (a API confere o papel de qualquer jeito)
  beforeLoad: ({ context }) => {
    if (!ehGestorOuAdministrador(context.eu)) throw redirect({ to: '/', search: { aviso: 'outro-papel' } });
  },
  validateSearch: (s: Record<string, unknown>): { mes?: string; aba?: Aba } => ({
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
    aba: ABAS.find((a) => a === s.aba),
  }),
  component: Oficiais,
});

function Oficiais() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const mes = busca.mes ?? somarMeses(mesAtual(), 1);
  const aba = busca.aba ?? 'escala';
  const unidadeId = eu.unidade.id;
  const escala = useQuery(consultaEscalaDosOficiais(unidadeId, mes));
  const saldo = useQuery(consultaSaldoDosOficiais(unidadeId));
  const servicos = useQuery(consultaServicos(unidadeId));
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);
  const irPara = (a: Aba) => void navigate({ search: (s) => ({ ...s, aba: a }) });
  const e = escala.data;

  // os serviços ordinários ativos da unidade com turno; o do mês aparece mesmo que tenha saído da lista
  const opcoes = (servicos.data ?? []).filter((s) => s.tipo === 'ordinario' && s.ativo && s.turnos.length > 0).map((s) => ({ id: s.id, nome: s.nome }));
  if (e?.servico && !opcoes.some((o) => o.id === e.servico!.id)) opcoes.push(e.servico);
  const escolher = travar(async (servicoId: string) => {
    setErro(null);
    try {
      await escolherServico(queryClient, unidadeId, mes, servicoId);
    } catch (x) {
      setErro(mensagemDe(x));
    }
  });

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Escala dos oficiais</h1>
        <p className="text-sm text-apagado">Oficiais QOC e QOA.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="oficiais-mes">Mês</Label>
          <CampoDeMes id="oficiais-mes" valor={mes} aoMudar={(m) => void navigate({ search: (s) => ({ ...s, mes: m }) })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="oficiais-servico">Serviço</Label>
          <Selecao
            id="oficiais-servico"
            className="w-64"
            value={e?.servico?.id ?? ''}
            disabled={!e || e.etapa !== 'sem-cotas' || salvando}
            onChange={(ev) => ev.target.value && void escolher(ev.target.value)}
          >
            {!e?.servico && <option value="">Escolha o serviço</option>}
            {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </Selecao>
        </div>
      </div>
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
        <TabsList>
          <TabsTrigger value="escala">Escala do mês</TabsTrigger>
          <TabsTrigger value="saldo">Painel de saldo</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>
        <TabsContent value="escala">
          {escala.isPending && <p className="text-apagado">Carregando…</p>}
          {escala.error && <p role="alert" className="text-alerta">{mensagemDe(escala.error)}</p>}
          {e && <EscalaDoMes key={`${unidadeId}|${mes}`} unidadeId={unidadeId} escala={e} aoVer={irPara} />}
        </TabsContent>
        <TabsContent value="saldo">
          {saldo.isPending && <p className="text-apagado">Carregando…</p>}
          {saldo.error && <p role="alert" className="text-alerta">{mensagemDe(saldo.error)}</p>}
          {saldo.data && <PainelDeSaldo key={unidadeId} unidadeId={unidadeId} lista={saldo.data} />}
        </TabsContent>
        <TabsContent value="regras">
          <RegrasDosOficiais />
        </TabsContent>
      </Tabs>
    </section>
  );
}
