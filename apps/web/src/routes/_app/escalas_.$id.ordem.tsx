import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes } from 'contratos';
import { mensagemDe } from '@/api/cliente';
import { consultaEscala } from '@/api/escalas';
import { consultaOrdemDeEscalacao } from '@/api/ordem-de-escalacao';
import { ProvedorDePendencias } from '@/componentes/AlteracoesPendentes';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { OrdemDeEscalacao } from '@/componentes/escalas/OrdemDeEscalacao';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { Moldura } from '@/componentes/Moldura';

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
  const ordem = useQuery(consultaOrdemDeEscalacao(id, mes));

  return (
    <ProvedorDePendencias>
      <Moldura
        titulo={`Ordem de escalação${escala.data ? ` — ${escala.data.nome}` : ''}`}
        antes={<Link to="/escalas/$id" params={{ id }} className="text-sm font-medium text-vinho underline underline-offset-2">Voltar para a escala</Link>}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="oe-mes">Vale a partir de</Label>
          <CampoDeMes id="oe-mes" valor={mes} aoMudar={(m) => void navigate({ search: { mes: m } })} />
        </div>
        {(escala.isPending || ordem.isPending) && <p className="text-apagado">Carregando…</p>}
        {escala.error && <p role="alert" className="text-alerta">{mensagemDe(escala.error)}</p>}
        {ordem.error && <p role="alert" className="text-alerta">{mensagemDe(ordem.error)}</p>}
        {ordem.data && <OrdemDeEscalacao key={`${id}|${mes}`} escalaId={id} mes={mes} dados={ordem.data} />}
      </Moldura>
    </ProvedorDePendencias>
  );
}
