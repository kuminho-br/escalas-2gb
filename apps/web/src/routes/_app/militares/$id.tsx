import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { mensagemDe } from '@/api/cliente';
import { consultaFicha } from '@/api/militares';
import { Afastamentos } from '@/componentes/militares/Afastamentos';
import { Identificacao } from '@/componentes/militares/Identificacao';
import { Lotacoes } from '@/componentes/militares/Lotacoes';
import { Motorista } from '@/componentes/militares/Motorista';

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
    <article className="grid gap-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link to="/militares" className="lg:hidden" aria-label="Voltar para a lista">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h2 className="font-cond text-2xl font-semibold">
          <span className="text-apagado">{ficha.posto}</span> {ficha.nomeGuerra}
        </h2>
        <span className="font-cond text-apagado">{ficha.matricula}</span>
        {ficha.pendencias.length > 0 && (
          <p className="w-full text-sm text-alerta">Cadastro incompleto: {ficha.pendencias.join('; ')}.</p>
        )}
      </header>
      {/* key: ao trocar de militar, os formulários começam do zero */}
      <Identificacao key={`i-${ficha.id}`} ficha={ficha} />
      <Motorista key={`m-${ficha.id}`} ficha={ficha} />
      <Afastamentos key={`a-${ficha.id}`} ficha={ficha} />
      <Lotacoes key={`l-${ficha.id}`} ficha={ficha} unidadeId={eu.unidade.id} />
    </article>
  );
}
