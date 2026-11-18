import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { mensagemDe } from '@/api/cliente';
import { consultaFicha } from '@/api/militares';
import { Afastamentos } from '@/componentes/militares/Afastamentos';
import { Identificacao } from '@/componentes/militares/Identificacao';
import { FichaPainel } from '@/componentes/ListaDetalhe';
import { Lotacoes } from '@/componentes/militares/Lotacoes';
import { Motorista } from '@/componentes/militares/Motorista';
import { resumoDaLotacao } from '@/lib/militares';

export const Route = createFileRoute('/_app/militares/$id')({
  component: Ficha,
});

function Ficha() {
  const { id } = Route.useParams();
  const { eu } = Route.useRouteContext();
  const { data: ficha, error, isPending } = useQuery(consultaFicha(id));

  if (isPending) return <p className="p-4 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;

  return (
    <FichaPainel
      titulo={<><span className="text-apagado">{ficha.posto}</span> {ficha.nomeGuerra}</>}
      complemento={<span className="font-cond text-apagado">{ficha.matricula}</span>}
      voltarPara="/militares"
      resumo={resumoDaLotacao(ficha.lotacoes)}
      aviso={ficha.pendencias.length > 0 && <p className="mt-1 text-sm text-alerta">Cadastro incompleto: {ficha.pendencias.join('; ')}.</p>}
    >
      {/* key: ao trocar de militar, os formulários começam do zero */}
      <Identificacao key={`i-${ficha.id}`} ficha={ficha} />
      <Motorista key={`m-${ficha.id}`} ficha={ficha} />
      <Afastamentos key={`a-${ficha.id}`} ficha={ficha} />
      <Lotacoes key={`l-${ficha.id}`} ficha={ficha} unidadeId={eu.unidade.id} />
    </FichaPainel>
  );
}
