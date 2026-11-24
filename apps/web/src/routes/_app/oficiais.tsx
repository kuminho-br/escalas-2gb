import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Mes, somarMeses } from 'contratos';
import { ehGestorNaUnidade } from '@/api/eu';
import { mensagemDe } from '@/api/cliente';
import { consultaEscalaDosOficiais, consultaSaldoDosOficiais } from '@/api/oficiais';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { EscalaDoMes } from '@/componentes/oficiais/EscalaDoMes';
import { MemorialDeCalculo } from '@/componentes/oficiais/MemorialDeCalculo';
import { BotaoDasRegras } from '@/componentes/oficiais/RegrasDosOficiais';
import { PainelDeSaldo } from '@/componentes/oficiais/PainelDeSaldo';
import { Selecao } from '@/componentes/Selecao';
import { Label } from '@/componentes/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { mesAtual } from '@/lib/meses';
import { Moldura } from '@/componentes/Moldura';

// as regras abrem num botão da Escala do mês (6.28): um endereço antigo com `aba=regras` cai na Escala do mês
type Aba = 'escala' | 'saldo' | 'memorial';
const ABAS: Aba[] = ['escala', 'saldo', 'memorial'];

export const Route = createFileRoute('/_app/oficiais')({
  // quem não tem nível de gestão na unidade escolhida (ou acima dela) volta ao início com o aviso, como nos outros módulos (a API confere o papel de qualquer jeito)
  beforeLoad: ({ context }) => {
    if (!ehGestorNaUnidade(context.eu)) throw redirect({ to: '/', search: { aviso: 'outro-papel' } });
  },
  validateSearch: (s: Record<string, unknown>): { mes?: string; aba?: Aba; escala?: string } => ({
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
    aba: ABAS.find((a) => a === s.aba),
    escala: typeof s.escala === 'string' && s.escala ? s.escala : undefined,
  }),
  component: Oficiais,
});

function Oficiais() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const mes = busca.mes ?? somarMeses(mesAtual(), 1);
  const aba = busca.aba ?? 'escala';
  const unidadeId = eu.unidade.id;
  const escala = useQuery(consultaEscalaDosOficiais(unidadeId, mes, busca.escala));
  const e = escala.data;
  // a escala em que a tela trabalha: a escolhida, ou a que a API escolheu (a do último mês da unidade)
  const escalaId = busca.escala ?? e?.escala?.id;
  const saldo = useQuery(consultaSaldoDosOficiais(unidadeId, escalaId));
  const irPara = (a: Aba) => void navigate({ search: (s) => ({ ...s, aba: a }) });

  return (
    <Moldura titulo="Escala dos oficiais" subtitulo="Oficiais QOC e QOA.">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="oficiais-mes">Mês</Label>
          <CampoDeMes id="oficiais-mes" valor={mes} aoMudar={(m) => void navigate({ search: (s) => ({ ...s, mes: m }) })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="oficiais-escala">Escala</Label>
          <Selecao
            id="oficiais-escala"
            className="w-64"
            value={e?.escala?.id ?? ''}
            disabled={!e || e.escalas.length === 0}
            onChange={(ev) => void navigate({ search: (s) => ({ ...s, escala: ev.target.value || undefined }) })}
          >
            {!e?.escala && <option value="">Escolha a escala</option>}
            {(e?.escalas ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </Selecao>
        </div>
      </div>
      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
        <TabsList>
          <TabsTrigger value="escala">Escala do mês</TabsTrigger>
          <TabsTrigger value="saldo">Painel de saldo</TabsTrigger>
          <TabsTrigger value="memorial">Memorial de cálculo</TabsTrigger>
        </TabsList>
        <TabsContent value="escala">
          {escala.isPending && <p className="text-apagado">Carregando…</p>}
          {escala.error && <p role="alert" className="text-alerta">{mensagemDe(escala.error)}</p>}
          {e && !e.escala && (
            <div className="flex justify-end">
              <BotaoDasRegras />
            </div>
          )}
          {e && !e.escala && (
            <p className="text-apagado">
              A unidade ainda não tem uma escala com rodada de cotas. Cadastre uma em <Link to="/escalas" className="font-medium text-vinho underline underline-offset-2">Escalas</Link>, escolhendo o jeito de distribuir "rodada de cotas".
            </p>
          )}
          {e?.escala && <EscalaDoMes key={`${unidadeId}|${e.escala.id}|${mes}`} unidadeId={unidadeId} escala={e} aoVer={irPara} />}
        </TabsContent>
        <TabsContent value="memorial">
          {e?.escala && <MemorialDeCalculo unidadeId={unidadeId} mes={mes} escalaId={e.escala.id} />}
        </TabsContent>
        <TabsContent value="saldo">
          {saldo.isPending && <p className="text-apagado">Carregando…</p>}
          {saldo.error && <p role="alert" className="text-alerta">{mensagemDe(saldo.error)}</p>}
          {saldo.data && <PainelDeSaldo key={`${unidadeId}|${escalaId ?? ''}`} unidadeId={unidadeId} escalaId={escalaId} lista={saldo.data} />}
        </TabsContent>
      </Tabs>
    </Moldura>
  );
}
