import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { TipoServico, type Servico } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaEscalas } from '@/api/escalas';
import { atualizarServicos, consultaServico, editarServico, mudarSituacaoServico } from '@/api/servicos';
import { AcoesDoBloco, ProvedorDePendencias, usePendencia, useTrava, useSincronizar } from '@/componentes/AlteracoesPendentes';
import { FichaPainel } from '@/componentes/ListaDetalhe';
import { Secao } from '@/componentes/militares/Secao';
import { Turnos } from '@/componentes/servicos/Turnos';
import { Selecao } from '@/componentes/Selecao';
import { SeletorDeCor } from '@/componentes/SeletorDeCor';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { NOME_TIPO, resumoDoServico } from '@/lib/servicos';
import { useConfirmar } from '@/componentes/resposta/useConfirmar';
import { Espera } from '@/componentes/resposta/Espera';

export const Route = createFileRoute('/_app/servicos/$id')({
  component: Ficha,
});

function Ficha() {
  const { id } = Route.useParams();
  const { eu } = Route.useRouteContext();
  const { data: s, error, isPending } = useQuery(consultaServico(id));
  if (isPending) return <Espera className="p-4" />;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;
  return (
    <ProvedorDePendencias>
      <FichaPainel titulo={s.nome} voltarPara="/servicos" etiqueta={s.ativo ? undefined : 'desativado'} resumo={resumoDoServico(s)} acoes={s.fixo ? undefined : <Situacao key={`s-${s.id}`} s={s} />}>
        {/* só o id entra na key: outra gravação (ex.: importação) recarrega os campos sem perder a edição pendente */}
        <Identificacao key={`i-${s.id}`} s={s} />
        {/* só o serviço entra na key: cada linha de turno recomeça sozinha quando os dados dela mudam, e a edição pendente de outra linha continua */}
        <Turnos key={`t-${s.id}`} servico={s} />
        <UsadoEm s={s} unidadeId={eu.unidade.id} />
      </FichaPainel>
    </ProvedorDePendencias>
  );
}

/** Desativar pergunta antes (o serviço some da lista); reativar não. */
function Situacao({ s }: { s: Servico }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = useConfirmar();
  async function mudar() {
    if (s.ativo && !(await confirmar({ titulo: 'Desativar o serviço?', texto: `${s.nome} some da lista e continua nas escalas que já o reúnem.`, verbo: 'Desativar' }))) return;
    setErro(null);
    try {
      await mudarSituacaoServico(s.id, !s.ativo);
      atualizarServicos(queryClient);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }
  return (
    <>
      <Button type="button" variant="secundario" size="sm" onClick={() => void mudar()}>
        {s.ativo ? 'Desativar' : 'Reativar'}
      </Button>
      {erro && <p role="alert" className="w-full text-right text-sm text-alerta">{erro}</p>}
    </>
  );
}

function Identificacao({ s }: { s: Servico }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(s.nome);
  const [tipo, setTipo] = useState<TipoServico>(s.tipo);
  const [operacao, setOperacao] = useState(s.operacao ?? '');
  const [rotulo, setRotulo] = useState(s.rotuloImpressao ?? '');
  const [cor, setCor] = useState(s.cor);
  const [tira, setTira] = useState(s.tiraDoExpediente);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const dados = () => ({ nome: nome.trim(), tipo, operacao: tipo === 'diaria' ? operacao.trim() || null : null, rotuloImpressao: rotulo.trim() || null, cor, tiraDoExpediente: tira });
  const assinatura = (d: ReturnType<typeof dados>) => JSON.stringify([d.nome, d.tipo, d.operacao, d.rotuloImpressao, d.cor, d.tiraDoExpediente]);
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(() => assinatura({ nome: s.nome, tipo: s.tipo, operacao: s.operacao, rotuloImpressao: s.rotuloImpressao, cor: s.cor, tiraDoExpediente: s.tiraDoExpediente }));
  const sujo = assinatura(dados()) !== salvo;
  usePendencia('identificacao', sujo);
  const doServidor = assinatura({ nome: s.nome, tipo: s.tipo, operacao: s.operacao, rotuloImpressao: s.rotuloImpressao, cor: s.cor, tiraDoExpediente: s.tiraDoExpediente });
  useSincronizar(doServidor, sujo, () => {
    setNome(s.nome);
    setTipo(s.tipo);
    setOperacao(s.operacao ?? '');
    setRotulo(s.rotuloImpressao ?? '');
    setCor(s.cor);
    setTira(s.tiraDoExpediente);
    setSalvo(doServidor);
  });

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    try {
      await editarServico(s.id, dados());
      setSalvo(assinatura(dados()));
      atualizarServicos(queryClient);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Identificação">
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        {s.fixo && <p className="text-sm text-apagado">Serviço fixo do sistema: o nome e o tipo não mudam.</p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="sv-nome">Nome</Label>
            <Input id="sv-nome" value={nome} onChange={(e) => setNome(e.target.value)} required disabled={s.fixo} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sv-tipo">Tipo</Label>
            <Selecao id="sv-tipo" value={tipo} onChange={(e) => setTipo(TipoServico.parse(e.target.value))} disabled={s.fixo}>
              {TipoServico.options.map((t) => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}
            </Selecao>
          </div>
        </div>
        <div className={tipo === 'diaria' ? 'grid gap-3 sm:grid-cols-[1fr_1fr_auto]' : 'grid gap-3 sm:grid-cols-[1fr_auto]'}>
          {tipo === 'diaria' && (
            <div className="grid gap-1.5">
              <Label htmlFor="sv-operacao">Operação</Label>
              <Input id="sv-operacao" value={operacao} onChange={(e) => setOperacao(e.target.value)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="sv-rotulo">Nome na impressão</Label>
            <Input id="sv-rotulo" value={rotulo} placeholder={nome} onChange={(e) => setRotulo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sv-cor">Cor</Label>
            <SeletorDeCor id="sv-cor" valor={cor} aoMudar={setCor} />
          </div>
        </div>
        <div className="grid gap-1">
          <label htmlFor="sv-tira" className="flex items-center gap-2 text-sm font-medium">
            <Checkbox id="sv-tira" checked={tira} onChange={(e) => setTira(e.target.checked)} aria-describedby="sv-tira-ajuda" />
            Pode tirar o militar do ADM do expediente
          </label>
          <p id="sv-tira-ajuda" className="text-apoio text-apagado">Ligada: lançar este serviço no horário do expediente tira o militar do expediente do dia, depois de confirmar. Desligada: é choque.</p>
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} aviso={aviso} />
      </form>
    </Secao>
  );
}

/** As escalas da unidade que reúnem este serviço (a ligação é pelo nome, que é único na unidade). */
function UsadoEm({ s, unidadeId }: { s: Servico; unidadeId: string }) {
  const escalas = useQuery(consultaEscalas(unidadeId));
  if (!escalas.data) return null;
  const reunem = escalas.data.filter((e) => e.servicos.includes(s.nome));
  return (
    <Secao titulo="Onde é usado">
      {reunem.length === 0 ? (
        <p className="text-sm text-apagado">Ainda não está em nenhuma escala.</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {reunem.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <Link to="/escalas/$id" params={{ id: e.id }} className="font-medium text-vinho hover:underline">{e.nome}</Link>
              {!e.ativa && <span className="rounded border border-linha px-1.5 text-xs">desativada</span>}
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
