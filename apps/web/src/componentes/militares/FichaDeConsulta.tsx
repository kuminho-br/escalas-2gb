import { useQuery } from '@tanstack/react-query';
import { Link, type LinkProps } from '@tanstack/react-router';
import type { FichaDeConsulta as FichaDeConsultaDados } from 'contratos';
import type { ReactNode } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaDaFicha } from '@/api/consulta';
import { FichaPainel } from '@/componentes/ListaDetalhe';
import { dataBr, Secao } from '@/componentes/militares/Secao';
import { Button } from '@/componentes/ui/button';
import { Espera } from '@/componentes/resposta/Espera';

const periodo = (inicio: string, fim: string | null) => (fim ? `de ${dataBr(inicio)} a ${dataBr(fim)}` : `desde ${dataBr(inicio)}`);
const JORNADA = { pronto: 'Pronto', adm: 'Administrativo' } as const;

/** Um dado da ficha: o rótulo e o valor; sem valor, um traço. */
function Dado({ rotulo, children }: { rotulo: string; children?: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-apagado">{rotulo}</dt>
      <dd className="text-sm">{children || '—'}</dd>
    </div>
  );
}
const Dados = ({ children }: { children: ReactNode }) => <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
const simNao = (v: boolean) => (v ? 'Sim' : 'Não');

/**
 * A ficha de consulta (entrega 6.11; dentro do Pecúlio Geral desde a 6.50): só para leitura, com os blocos que a pessoa vê. Um bloco que não veio da API não aparece, e a tela não diz
 * que falta acesso. Quem tem nível de acesso na lotação do militar (ou acima) ganha o atalho para a ficha completa.
 */
export function FichaDeConsulta({ id, voltarPara, voltarBusca }: { id: string; voltarPara: LinkProps['to']; voltarBusca?: LinkProps['search'] }) {
  const { data: f, error, isPending } = useQuery(consultaDaFicha(id));
  if (isPending) return <Espera className="p-4" />;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;
  return (
    <FichaPainel
      titulo={<><span className="text-apagado">{f.postoGrad}</span> {f.nomeGuerra}</>}
      complemento={<span className="font-cond text-apagado">{f.matricula}</span>}
      voltarPara={voltarPara}
      voltarBusca={voltarBusca}
      resumo={f.lotacao ? `Lotado em ${f.lotacao}${f.quadro ? `, ${f.quadro}` : ''}` : 'Sem lotação hoje'}
      acoes={
        <>
          <Button asChild variant="discreto" size="sm"><Link to={voltarPara} search={voltarBusca}>Voltar</Link></Button>
          {f.podeAbrirFichaCompleta && (
            <Button asChild variant="secundario" size="sm"><Link to="/peculio/militar/$id" params={{ id: f.id }}>Abrir a ficha completa</Link></Button>
          )}
        </>
      }
    >
      <Blocos f={f} />
    </FichaPainel>
  );
}

function Blocos({ f }: { f: FichaDeConsultaDados }) {
  return (
    <>
      <Secao titulo="Identificação">
        <Dados>
          <Dado rotulo="Posto ou graduação">{f.postoGrad}</Dado>
          <Dado rotulo="Nome de guerra">{f.nomeGuerra}</Dado>
          <Dado rotulo="Nome completo">{f.nomeCompleto}</Dado>
          <Dado rotulo="Matrícula">{f.matricula}</Dado>
          <Dado rotulo="Lotação">{f.lotacao}</Dado>
          <Dado rotulo="Quadro">{f.quadro}</Dado>
        </Dados>
      </Secao>
      {f.contato && (
        <Secao titulo="Contato">
          <Dados>
            <Dado rotulo="Telefone">{f.contato.telefone}</Dado>
            <Dado rotulo="E-mail institucional">{f.contato.email}</Dado>
            <Dado rotulo="E-mail pessoal">{f.contato.emailPessoal}</Dado>
          </Dados>
        </Secao>
      )}
      {f.situacao && (
        <Secao titulo="Situação">
          <Dados>
            <Dado rotulo="Equipe">{f.situacao.equipe}</Dado>
            <Dado rotulo="Jornada">{JORNADA[f.situacao.jornada]}</Dado>
            <Dado rotulo="Situação do militar">{f.situacao.situacaoDoMilitar}</Dado>
            <Dado rotulo="Função">{f.situacao.funcao}</Dado>
          </Dados>
          <h4 className="mt-4 mb-1.5 text-sm font-medium">Histórico de lotação</h4>
          <ul aria-label="Histórico de lotação" className="grid gap-1 text-sm">
            {f.situacao.historico.map((p) => (
              <li key={`${p.desde}-${p.lotacao}`} className="flex flex-wrap gap-x-3">
                <span className="font-medium">{p.lotacao}</span>
                <span className="text-apagado">{periodo(p.desde, p.ate)}</span>
                <span className="text-apagado">{[p.equipe, JORNADA[p.jornada], p.quadro, p.situacaoDoMilitar].filter(Boolean).join(', ')}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {f.afastamentos && (
        <Secao titulo="Afastamentos">
          {f.afastamentos.length === 0 ? (
            <p className="text-sm text-apagado">Nenhum afastamento.</p>
          ) : (
            <ul aria-label="Afastamentos" className="grid gap-1.5 text-sm">
              {f.afastamentos.map((a) => (
                <li key={`${a.inicio}-${a.tipo}`} className="flex flex-wrap gap-x-3">
                  <span className="font-medium">{a.tipo}</span>
                  <span className="text-apagado">{periodo(a.inicio, a.fim)}</span>
                  {a.motivo && <span>{a.motivo}</span>}
                  {a.boletim && <span className="text-apagado">{a.boletim}</span>}
                </li>
              ))}
            </ul>
          )}
        </Secao>
      )}
      {f.dadosDaEscala && (
        <Secao titulo="Dados da escala">
          <Dados>
            <Dado rotulo="Motorista">{simNao(f.dadosDaEscala.motorista)}</Dado>
            <Dado rotulo="CNH">{f.dadosDaEscala.cnh.join(', ')}</Dado>
            <Dado rotulo="Voluntário JES">{simNao(f.dadosDaEscala.voluntarioJes)}</Dado>
          </Dados>
        </Secao>
      )}
      {f.comportamento && (
        <Secao titulo="Comportamento">
          <Dados>
            <Dado rotulo="Comportamento">{f.comportamento.comportamento}</Dado>
            <Dado rotulo="Boletim">{f.comportamento.boletim}</Dado>
          </Dados>
        </Secao>
      )}
    </>
  );
}
