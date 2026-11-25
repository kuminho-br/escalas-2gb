import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes, mesPorExtenso, type EscalaVisivel } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import { consultaEscalasVisiveis } from '@/api/visualizacao';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { Label } from '@/componentes/ui/label';
import { EtiquetaDoEstado } from '@/componentes/visualizacao/EtiquetaDoEstado';
import { abaixoDe } from '@/lib/arvore-de-unidades';
import { mesAtual } from '@/lib/meses';

export const Route = createFileRoute('/_app/escalas-da-corporacao')({
  validateSearch: (s: Record<string, unknown>): { mes?: string } => ({ mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined }),
  component: EscalasDaCorporacao,
});

/**
 * Escalas (7.5): as escalas do mês que a conta pode ver (a prévia, da unidade dela e das de baixo; a publicada, de toda a corporação), por unidade, cada uma com o estado.
 * Abre filtrada na unidade de lotação da pessoa e nas de baixo; a árvore troca a unidade e "Limpar" mostra todas.
 */
function EscalasDaCorporacao() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const mes = busca.mes ?? mesAtual();
  const escalas = useQuery(consultaEscalasVisiveis(mes));
  const unidades = useQuery(consultaUnidadesDaBusca);
  const [filtro, setFiltro] = useState(eu.lotacao?.id ?? '');
  const doFiltro = filtro ? abaixoDe(unidades.data ?? [], filtro) : null;
  const todas = escalas.data ?? [];
  const aMostrar = todas.filter((e) => !doFiltro || doFiltro.has(e.unidadeId));
  // um bloco por unidade (pelo id): duas unidades com a mesma sigla não se juntam, e o título diz de qual é ("1ª SB, em DivOp") quando a sigla se repete
  const porUnidade = new Map<string, EscalaVisivel[]>();
  for (const e of aMostrar) porUnidade.set(e.unidadeId, [...(porUnidade.get(e.unidadeId) ?? []), e]);
  const siglas = [...porUnidade.values()].map((l) => l[0]!.unidadeSigla);
  const tituloDe = (e: EscalaVisivel) => {
    if (siglas.filter((x) => x === e.unidadeSigla).length < 2) return e.unidadeSigla;
    const mae = unidades.data?.find((u) => u.id === unidades.data?.find((x) => x.id === e.unidadeId)?.maeId)?.sigla;
    return mae ? `${e.unidadeSigla}, em ${mae}` : e.unidadeSigla;
  };

  return (
    <Moldura titulo="Escalas">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ec-mes">Mês</Label>
          <CampoDeMes id="ec-mes" valor={mes} aoMudar={(m) => void navigate({ search: { mes: m } })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ec-unidade">Escalas da unidade</Label>
          <EscolherUnidade id="ec-unidade" rotulo="Escalas da unidade" unidades={unidades.data ?? []} valor={filtro} aoEscolher={setFiltro} permiteLimpar textoVazio="Todas as unidades" textoDoValor={eu.lotacao?.sigla} className="w-64" />
        </div>
      </div>
      {escalas.isPending && <Espera />}
      {escalas.error && <p role="alert" className="text-alerta">{mensagemDe(escalas.error)}</p>}
      {escalas.data && todas.length === 0 && <p className="max-w-xl text-apagado">{`Nenhuma escala de ${mesPorExtenso(mes)} está aberta para você.`}</p>}
      {escalas.data && todas.length > 0 && aMostrar.length === 0 && <p className="max-w-xl text-apagado">Nenhuma escala desta unidade está aberta para você neste mês. Limpe o filtro para ver as outras.</p>}
      <div className="grid max-w-3xl gap-4">
        {[...porUnidade].map(([unidadeId, lista]) => (
          <section key={unidadeId} aria-label={tituloDe(lista[0]!)} className="grid gap-1.5">
            <h2 className="font-cond text-lg font-semibold">{tituloDe(lista[0]!)}</h2>
            <ul className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
              {lista.map((e) => (
                <li key={e.escalaId}>
                  <Link to="/escalas-da-corporacao/$id" params={{ id: e.escalaId }} search={{ mes }} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-accent">
                    <span className="font-cond text-base font-semibold">{e.nome}</span>
                    <EtiquetaDoEstado estado={e.estado} emRetificacao={e.emRetificacao} />
                    {e.dosOficiais && <Etiqueta tipo="neutra">Oficiais</Etiqueta>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Moldura>
  );
}
