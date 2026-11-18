import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { DiasDoc, MilitaresDoc, type Escala } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarEscalas, consultaEscala, editarEscala, mudarSituacaoEscala } from '@/api/escalas';
import { AcoesDoBloco, ProvedorDePendencias, usePendencia } from '@/componentes/AlteracoesPendentes';
import { Matriz } from '@/componentes/escalas/Matriz';
import { FichaPainel } from '@/componentes/ListaDetalhe';
import { ServicosDaEscala } from '@/componentes/escalas/ServicosDaEscala';
import { Secao } from '@/componentes/militares/Secao';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';

export const Route = createFileRoute('/_app/escalas/$id')({
  component: Ficha,
});

function Ficha() {
  const { id } = Route.useParams();
  const { eu } = Route.useRouteContext();
  const { data: e, error, isPending } = useQuery(consultaEscala(id));
  if (isPending) return <p className="p-4 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;
  return (
    <ProvedorDePendencias>
      <FichaPainel titulo={e.nome} voltarPara="/escalas" etiqueta={e.ativa ? undefined : 'desativada'} resumo={`Título no documento: ${e.titulo}.`} acoes={<Situacao e={e} />}>
        {/* os dados entram na key: outra gravação (ex.: importação) recarrega o formulário */}
        <Identificacao key={`i-${e.id}-${e.nome}-${e.titulo}-${e.militaresDoc}-${e.diasDoc}`} e={e} />
        <ServicosDaEscala key={`s-${e.id}-${e.servicos.map((s) => s.id).join(',')}`} escala={e} unidadeId={eu.unidade.id} />
        {/* a matriz mantém as marcações pendentes quando os serviços mudam: só a ficha entra na key */}
        <Matriz key={`m-${e.id}`} escala={e} unidadeId={eu.unidade.id} />
      </FichaPainel>
    </ProvedorDePendencias>
  );
}

/** Desativar pergunta antes (a escala some da lista); reativar não. */
function Situacao({ e }: { e: Escala }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  async function mudar() {
    if (e.ativa && !window.confirm(`Desativar a escala ${e.nome}? Ela some da lista.`)) return;
    setErro(null);
    try {
      await mudarSituacaoEscala(e.id, !e.ativa);
      atualizarEscalas(queryClient);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => void mudar()}>
        {e.ativa ? 'Desativar' : 'Reativar'}
      </Button>
      {erro && <p role="alert" className="w-full text-right text-sm text-alerta">{erro}</p>}
    </>
  );
}

function Identificacao({ e }: { e: Escala }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(e.nome);
  const [titulo, setTitulo] = useState(e.titulo);
  const [militaresDoc, setMilitares] = useState(e.militaresDoc);
  const [diasDoc, setDias] = useState(e.diasDoc);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const assinatura = () => JSON.stringify([nome.trim(), titulo.trim(), militaresDoc, diasDoc]);
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(() => JSON.stringify([e.nome, e.titulo, e.militaresDoc, e.diasDoc]));
  const sujo = assinatura() !== salvo;
  usePendencia('identificacao', sujo);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setAviso(null);
    try {
      await editarEscala(e.id, { nome: nome.trim(), titulo: titulo.trim(), militaresDoc, diasDoc });
      setSalvo(assinatura());
      atualizarEscalas(queryClient);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Identificação e publicação">
      <form onSubmit={salvar} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="es-nome">Nome</Label>
            <Input id="es-nome" value={nome} onChange={(ev) => setNome(ev.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="es-titulo">Título no documento</Label>
            <Input id="es-titulo" value={titulo} onChange={(ev) => setTitulo(ev.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="es-militares">Militares no documento</Label>
            <Selecao id="es-militares" value={militaresDoc} onChange={(ev) => setMilitares(MilitaresDoc.parse(ev.target.value))}>
              <option value="todos">Todos os militares</option>
              <option value="escalados">Só os escalados</option>
            </Selecao>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="es-dias">Dias no documento</Label>
            <Selecao id="es-dias" value={diasDoc} onChange={(ev) => setDias(DiasDoc.parse(ev.target.value))}>
              <option value="todos">Todos os dias</option>
              <option value="com_escalados">Só os dias com escalados</option>
            </Selecao>
          </div>
        </div>
        <AcoesDoBloco sujo={sujo} aviso={aviso} />
      </form>
    </Secao>
  );
}
