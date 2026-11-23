import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { mesPorExtenso, somarMeses, textoFaixa, type FichaGuarnicao } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarGuarnicoes, consultaGuarnicao, editarGuarnicao, mudarSituacao } from '@/api/guarnicoes';
import { AcoesDoBloco, podeDescartar, ProvedorDePendencias, usePendencia, useTrava, useSincronizar } from '@/componentes/AlteracoesPendentes';
import { Versoes } from '@/componentes/guarnicoes/Versoes';
import { AcoesDosModelos, ListaDeModelos } from '@/componentes/guarnicoes/ListaDeModelos';
import { FichaPainel, ListaDetalhe } from '@/componentes/ListaDetalhe';
import { Secao } from '@/componentes/militares/Secao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { resumoDaGuarnicao, versaoVigente } from '@/lib/guarnicoes';
import { mesAtual } from '@/lib/meses';

export const Route = createFileRoute('/_app/configuracoes_/modelos-de-guarnicao/$id')({
  component: Pagina,
});

function Pagina() {
  const { id } = Route.useParams();
  const { eu } = Route.useRouteContext();
  return (
    <ListaDetalhe
      titulo="Modelos de guarnição"
      temDetalhe
      acoes={
        <>
          <Link to="/configuracoes-da-escala" search={{ aba: 'modelos' }} className="self-center text-sm font-medium text-vinho hover:underline">
            Voltar para Configurações da escala
          </Link>
          <AcoesDosModelos unidadeId={eu.unidade.id} />
        </>
      }
      lista={<ListaDeModelos unidadeId={eu.unidade.id} escolhida={id} />}
      detalhe={<Ficha />}
    />
  );
}

function Ficha() {
  const { id } = Route.useParams();
  const { eu } = Route.useRouteContext();
  const { data: ficha, error, isPending } = useQuery(consultaGuarnicao(id));

  if (isPending) return <p className="p-4 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;

  return (
    <ProvedorDePendencias>
      <Corpo key={ficha.id} ficha={ficha} unidadeId={eu.unidade.id} />
    </ProvedorDePendencias>
  );
}

/** A versão escolhida fica aqui, acima das `key` dos blocos: gravar num mês novo recomeça os blocos e a escolha continua. */
function Corpo({ ficha, unidadeId }: { ficha: FichaGuarnicao; unidadeId: string }) {
  const [escolhida, setEscolhida] = useState<string | undefined>();
  return (
    <FichaPainel
      titulo={ficha.nome}
      voltarPara="/configuracoes"
      voltarBusca={{ aba: 'modelos' }}
      resumo={resumoDaGuarnicao(versaoVigente(ficha.versoes, mesAtual()))}
      acoes={<Situacao key={`s-${ficha.id}`} ficha={ficha} />}
    >
      {/* key: ao trocar de guarnição, os formulários começam do zero */}
      <Identificacao key={`i-${ficha.id}`} ficha={ficha} />
      {/* as versões entram na key: desativar, reativar ou salvar recarrega o editor com o que foi gravado */}
      <Versoes key={`v-${ficha.id}-${ficha.versoes.map((v) => `${v.vigencia}:${v.ativa}`).join(',')}`} ficha={ficha} unidadeId={unidadeId} escolhida={escolhida} aoEscolher={setEscolhida} />
      <UsadaEm ficha={ficha} />
    </FichaPainel>
  );
}

function Identificacao({ ficha }: { ficha: FichaGuarnicao }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(ficha.nome);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(ficha.nome);
  const sujo = nome.trim() !== salvo;
  usePendencia('identificacao', sujo);
  useSincronizar(ficha.nome, sujo, () => {
    setNome(ficha.nome);
    setSalvo(ficha.nome);
  });

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    try {
      await editarGuarnicao(ficha.id, { nome: nome.trim() });
      setSalvo(nome.trim());
      atualizarGuarnicoes(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Identificação">
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor="gn-nome">Nome</Label>
          <Input id="gn-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} aviso={aviso} />
      </form>
    </Secao>
  );
}

/** Desativar agora, a partir de um mês, ou reativar. */
function Situacao({ ficha }: { ficha: FichaGuarnicao }) {
  const queryClient = useQueryClient();
  const mes = mesAtual();
  // a lista olha a versão em vigor no mês; se só ela estiver inativa e uma futura voltar a ativa, `desativadaAPartirDe` vem nulo
  // e a ficha precisa dizer a mesma coisa que a lista: desativada, com o mês em que a versão inativa passou a valer
  const emVigor = ficha.versoes.find((v) => v.vigencia <= mes);
  const desde = ficha.desativadaAPartirDe ?? (emVigor && !emVigor.ativa ? emVigor.vigencia : null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [aPartirDe, setAPartirDe] = useState(somarMeses(mes, 1));
  const [erro, setErro] = useState<string | null>(null);

  async function mudar(ativa: boolean, mesEscolhido: string) {
    // desativar ou reativar recomeça o editor de versões: com composição pendente, pergunta antes
    if (!podeDescartar('versao')) return;
    setErro(null);
    try {
      await mudarSituacao(ficha.id, { ativa, aPartirDe: mesEscolhido });
      atualizarGuarnicoes(queryClient, ficha.id);
      setEscolhendo(false);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  // só o "Desativar agora" pergunta: vale já neste mês e muda o que as escalas usam; os outros caminhos são marcados ou desfazem
  function desativarAgora() {
    if (!window.confirm(`Desativar o modelo ${ficha.nome} agora? As escalas deixam de usá-lo a partir de ${mesPorExtenso(mes)}.`)) return;
    void mudar(false, mes);
  }

  return (
    <div className="grid justify-items-end gap-2 text-sm">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {desde && desde <= mes && (
          <>
            <p className="font-medium text-alerta">Desativada desde {mesPorExtenso(desde)}.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void mudar(true, mes)}>Reativar agora</Button>
          </>
        )}
        {desde && desde > mes && (
          <>
            <p className="font-medium">Será desativada em {mesPorExtenso(desde)}.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void mudar(true, desde)}>Cancelar desativação</Button>
          </>
        )}
        {!desde && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => desativarAgora()}>Desativar agora</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEscolhendo(!escolhendo)}>Desativar a partir de…</Button>
          </>
        )}
      </div>
      {escolhendo && !desde && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="gs-mes">Desativar a partir de</Label>
            <Input id="gs-mes" type="month" value={aPartirDe} min={mes} onChange={(e) => setAPartirDe(e.target.value)} className="w-44" />
          </div>
          <Button type="button" size="sm" disabled={!aPartirDe} onClick={() => void mudar(false, aPartirDe)}>
            Desativar a partir de {aPartirDe ? mesPorExtenso(aPartirDe) : '…'}
          </Button>
        </div>
      )}
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
    </div>
  );
}

function UsadaEm({ ficha }: { ficha: FichaGuarnicao }) {
  return (
    <Secao titulo="Onde é usada">
      {ficha.usadaEm.length === 0 ? (
        <p className="text-sm text-apagado">Ainda não está em nenhuma escala.</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {ficha.usadaEm.map((u) => (
            <li key={u.escalaId} className="flex gap-3">
              <Link to="/escalas/$id" params={{ id: u.escalaId }} className="font-medium text-vinho hover:underline">{u.escala}</Link>
              <span className="text-apagado">{u.faixas.map((f) => textoFaixa(f.inicio, f.fim)).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
