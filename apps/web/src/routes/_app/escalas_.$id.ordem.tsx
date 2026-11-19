import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes } from 'contratos';
import { mensagemDe } from '@/api/cliente';
import { consultaEscala } from '@/api/escalas';
import { consultaOrdemDeEscala } from '@/api/ordem-de-escala';
import { ProvedorDePendencias } from '@/componentes/AlteracoesPendentes';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { OrdemDeEscala } from '@/componentes/escalas/OrdemDeEscala';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';

export const Route = createFileRoute('/_app/escalas_/$id/ordem')({
  validateSearch: (s: Record<string, unknown>): { mes?: string } => ({ mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined }),
  component: Ordem,
});

function Ordem() {
  const { id } = Route.useParams();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  // a ordem vale a partir do mês escolhido; abre no mês atual
  const mes = busca.mes ?? mesAtual();
  const escala = useQuery(consultaEscala(id));
  const ordem = useQuery(consultaOrdemDeEscala(id, mes));

  return (
    <ProvedorDePendencias>
      <section className="grid gap-4">
        <div>
          <Link to="/escalas/$id" params={{ id }} className="text-sm font-medium text-vinho underline underline-offset-2">Voltar para a escala</Link>
          <h1 className="font-cond text-[28px] leading-tight font-semibold">Ordem de escala{escala.data ? ` — ${escala.data.nome}` : ''}</h1>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="oe-mes">Vale a partir de</Label>
          <CampoDeMes id="oe-mes" valor={mes} aoMudar={(m) => void navigate({ search: { mes: m } })} />
        </div>
        {(escala.isPending || ordem.isPending) && <p className="text-apagado">Carregando…</p>}
        {escala.error && <p role="alert" className="text-alerta">{mensagemDe(escala.error)}</p>}
        {ordem.error && <p role="alert" className="text-alerta">{mensagemDe(ordem.error)}</p>}
        {ordem.data && <OrdemDeEscala key={`${id}|${mes}`} escalaId={id} mes={mes} dados={ordem.data} />}
      </section>
    </ProvedorDePendencias>
  );
}
