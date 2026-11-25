import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { mensagemDe } from '@/api/cliente';
import { consultaFicha } from '@/api/militares';
import { FichaCompleta } from '@/componentes/militares/FichaCompleta';
import { Espera } from '@/componentes/resposta/Espera';

export const Route = createFileRoute('/_app/militares/$id')({
  // `de=peculio` era a ficha aberta pelo Pecúlio (favoritos, links): hoje ela abre dentro do Pecúlio Geral, em /peculio/militar/$id (6.50)
  validateSearch: (s: Record<string, unknown>): { de?: 'peculio' } => ({ de: s.de === 'peculio' ? 'peculio' : undefined }),
  beforeLoad: ({ params, search }) => {
    if (search.de === 'peculio') throw redirect({ to: '/peculio/militar/$id', params: { id: params.id }, search: {}, replace: true });
  },
  component: FichaDaEscala,
});

/** A ficha aberta pelo módulo de escalas: enxuta (só o que serve à escala). A completa abre no Pecúlio. */
function FichaDaEscala() {
  const { id } = Route.useParams();
  const { eu } = Route.useRouteContext();
  const { data: ficha, error, isPending } = useQuery(consultaFicha(id));
  if (isPending) return <Espera className="p-4" />;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;
  return <FichaCompleta ficha={ficha} eu={eu} completa={false} voltarPara="/militares" />;
}
