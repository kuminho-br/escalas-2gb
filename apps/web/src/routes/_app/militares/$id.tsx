import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { FichaMilitar } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaFicha } from '@/api/militares';
import { ehAdministrador } from '@/api/eu';
import { AcessoAoSistema } from '@/componentes/militares/AcessoAoSistema';
import { ApagarMilitar } from '@/componentes/militares/ApagarMilitar';
import { Afastamentos } from '@/componentes/militares/Afastamentos';
import { Comportamento } from '@/componentes/militares/Comportamento';
import { Contato } from '@/componentes/militares/Contato';
import { DadosPessoais } from '@/componentes/militares/DadosPessoais';
import { Identificacao } from '@/componentes/militares/Identificacao';
import { ProvedorDePendencias } from '@/componentes/AlteracoesPendentes';
import { FichaPainel } from '@/componentes/ListaDetalhe';
import { Motorista } from '@/componentes/militares/Motorista';
import { Rastreio } from '@/componentes/militares/Rastreio';
import { resumoDaLotacao } from '@/lib/militares';
import { Espera } from '@/componentes/resposta/Espera';

export const Route = createFileRoute('/_app/militares/$id')({
  // `de=peculio`: a ficha foi aberta pelo Pecúlio, que continua sendo o módulo e o destino do "Voltar"
  validateSearch: (s: Record<string, unknown>): { de?: 'peculio' } => ({ de: s.de === 'peculio' ? 'peculio' : undefined }),
  component: Ficha,
});

function Ficha() {
  const { id } = Route.useParams();
  const { de } = Route.useSearch();
  const { eu } = Route.useRouteContext();
  const { data: ficha, error, isPending } = useQuery(consultaFicha(id));
  const doPeculio = de === 'peculio';

  if (isPending) return <Espera className="p-4" />;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;

  return (
    <ProvedorDePendencias>
    <FichaPainel
      titulo={<><span className="text-apagado">{ficha.posto}</span> {ficha.nomeGuerra}</>}
      complemento={<span className="font-cond text-apagado">{ficha.matricula}</span>}
      voltarPara={de === 'peculio' ? '/peculio' : '/militares'}
      resumo={resumoDaLotacao(ficha.rastreio)}
      aviso={ficha.pendencias.length > 0 && <AvisoDeCadastro ficha={ficha} />}
    >
      {/* key: ao trocar de militar, os formulários começam do zero; os dados entram nela para uma gravação de fora (ex.: importação) recarregar o bloco */}
      <Identificacao key={`i-${ficha.id}`} ficha={ficha} />
      <Contato key={`c-${ficha.id}`} ficha={ficha} />
      {/* a ficha da escala (aberta pelo módulo de escalas) só traz o que serve à escala; Dados pessoais e Comportamento são da ficha completa, aberta pelo Pecúlio */}
      {doPeculio && ficha.veDadosRestritos && <DadosPessoais key={`d-${ficha.id}`} ficha={ficha} />}
      {doPeculio && <Comportamento key={`p-${ficha.id}`} ficha={ficha} />}
      <Motorista key={`m-${ficha.id}`} ficha={ficha} />
      <Afastamentos key={`a-${ficha.id}`} ficha={ficha} />
      <Rastreio key={`r-${ficha.id}`} ficha={ficha} unidadeId={eu.unidade.id} />
      <AcessoAoSistema key={`s-${ficha.id}`} ficha={ficha} />
      {/* só o administrador do sistema apaga um militar, e no fim da ficha */}
      {ehAdministrador(eu) && <ApagarMilitar key={`x-${ficha.id}`} ficha={ficha} />}
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
