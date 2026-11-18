import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { FichaMilitar } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaFicha } from '@/api/militares';
import { Afastamentos } from '@/componentes/militares/Afastamentos';
import { Identificacao } from '@/componentes/militares/Identificacao';
import { ProvedorDePendencias } from '@/componentes/AlteracoesPendentes';
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
    <ProvedorDePendencias>
    <FichaPainel
      titulo={<><span className="text-apagado">{ficha.posto}</span> {ficha.nomeGuerra}</>}
      complemento={<span className="font-cond text-apagado">{ficha.matricula}</span>}
      voltarPara="/militares"
      resumo={resumoDaLotacao(ficha.lotacoes)}
      aviso={ficha.pendencias.length > 0 && <AvisoDeCadastro ficha={ficha} />}
    >
      {/* key: ao trocar de militar, os formulários começam do zero; os dados entram nela para uma gravação de fora (ex.: importação) recarregar o bloco */}
      <Identificacao key={`i-${ficha.id}-${ficha.postoGradId}-${ficha.nomeGuerra}-${ficha.antiguidade}-${ficha.voluntarioJes}-${ficha.ativo}`} ficha={ficha} />
      <Motorista key={`m-${ficha.id}-${ficha.noQuadroDeMotoristas}-${ficha.cnh.join('')}`} ficha={ficha} />
      <Afastamentos key={`a-${ficha.id}`} ficha={ficha} />
      <Lotacoes key={`l-${ficha.id}`} ficha={ficha} unidadeId={eu.unidade.id} />
    </FichaPainel>
    </ProvedorDePendencias>
  );
}

/** Cadastro incompleto, em âmbar (vermelho fica para erro); com muitos repetidos, "Ver quais" mostra os nomes. */
function AvisoDeCadastro({ ficha }: { ficha: FichaMilitar }) {
  const [aberto, setAberto] = useState(false);
  const muitos = ficha.antiguidadeRepetidaCom.length > 3;
  return (
    <div className="mt-2 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">
      <p>
        Cadastro incompleto: {ficha.pendencias.join('; ')}.
        {muitos && (
          <>
            {' '}
            <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="font-medium underline underline-offset-2">
              Ver quais
            </button>
          </>
        )}
      </p>
      {muitos && aberto && <p className="mt-1">{ficha.antiguidadeRepetidaCom.join(', ')}.</p>}
    </div>
  );
}
