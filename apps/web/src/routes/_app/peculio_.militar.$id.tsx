import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { consultaFicha } from '@/api/militares';
import { FichaCompleta } from '@/componentes/militares/FichaCompleta';
import { FichaDeConsulta } from '@/componentes/militares/FichaDeConsulta';
import { Espera } from '@/componentes/resposta/Espera';

type Origem = { de?: 'pesquisa'; texto?: string; unidade?: string };

export const Route = createFileRoute('/_app/peculio_/militar/$id')({
  // de onde a pessoa veio: o "Voltar" a leva de volta à lista da unidade, ou à pesquisa com o mesmo resultado
  validateSearch: (s: Record<string, unknown>): Origem => ({
    de: s.de === 'pesquisa' ? 'pesquisa' : undefined,
    texto: typeof s.texto === 'string' && s.texto ? s.texto : undefined,
    unidade: typeof s.unidade === 'string' && s.unidade ? s.unidade : undefined,
  }),
  component: FichaNoPeculio,
});

/**
 * A ficha de um militar dentro do Pecúlio Geral: completa (com Dados pessoais e Comportamento) para quem tem nível de acesso sobre ele, e de consulta para os outros,
 * na mesma rota. A API decide: quem não tem o nível recebe 403 na ficha completa, e a tela mostra a de consulta, que traz só o que a pessoa pode ver.
 */
function FichaNoPeculio() {
  const { id } = Route.useParams();
  const { de, texto, unidade } = Route.useSearch();
  const { eu } = Route.useRouteContext();
  const completa = useQuery({ ...consultaFicha(id), retry: false });
  const daPesquisa = de === 'pesquisa';
  const voltarPara = daPesquisa ? ('/peculio/pesquisar' as const) : ('/peculio' as const);
  const voltarBusca = daPesquisa ? { texto, unidade } : undefined;
  if (completa.isPending) return <Espera className="p-4" />;
  if (completa.error instanceof ErroApi && completa.error.status === 403) return <FichaDeConsulta id={id} voltarPara={voltarPara} voltarBusca={voltarBusca} />;
  if (completa.error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(completa.error)}</p>;
  return <FichaCompleta ficha={completa.data} eu={eu} completa voltarPara={voltarPara} voltarBusca={voltarBusca} />;
}
