import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { DiasDoc, MilitaresDoc, type Escala } from 'contratos';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarEscalas, consultaEscala, editarEscala, mudarSituacaoEscala } from '@/api/escalas';
import { Matriz } from '@/componentes/escalas/Matriz';
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
  const assinatura = (x: Escala) => x.vinculos.map((v) => `${v.vigencia}:${v.itens.map((i) => `${i.guarnicaoId}/${i.inicio}${i.fim}`).join('+')}`).join(',');
  return (
    <article className="grid gap-4">
      <header className="flex items-baseline gap-3">
        <Link to="/escalas" className="lg:hidden" aria-label="Voltar para a lista">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h2 className="font-cond text-2xl font-semibold">{e.nome}</h2>
        {!e.ativa && <span className="rounded border border-linha px-1.5 text-xs">desativada</span>}
      </header>
      <Situacao e={e} />
      {/* os dados entram na key: outra gravação (ex.: importação) recarrega o formulário */}
      <Identificacao key={`i-${e.id}-${e.nome}-${e.titulo}-${e.militaresDoc}-${e.diasDoc}`} e={e} />
      <ServicosDaEscala key={`s-${e.id}-${e.servicos.map((s) => s.id).join(',')}`} escala={e} unidadeId={eu.unidade.id} />
      {/* a assinatura das versões entra na key: salvar recarrega a matriz com o que foi gravado */}
      <Matriz key={`m-${e.id}-${e.faixas.map((f) => `${f.inicio}${f.fim}`).join('')}-${assinatura(e)}`} escala={e} unidadeId={eu.unidade.id} />
    </article>
  );
}

function Situacao({ e }: { e: Escala }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  async function mudar() {
    setErro(null);
    try {
      await mudarSituacaoEscala(e.id, !e.ativa);
      atualizarEscalas(queryClient);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-linha bg-superficie px-4 py-3 text-sm">
      <span className="text-apagado">{e.ativa ? 'Desativada, a escala some da lista.' : 'Desativada.'}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => void mudar()}>
        {e.ativa ? 'Desativar' : 'Reativar'}
      </Button>
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
    </div>
  );
}

function Identificacao({ e }: { e: Escala }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(e.nome);
  const [titulo, setTitulo] = useState(e.titulo);
  const [militaresDoc, setMilitares] = useState(e.militaresDoc);
  const [diasDoc, setDias] = useState(e.diasDoc);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setAviso(null);
    try {
      await editarEscala(e.id, { nome: nome.trim(), titulo: titulo.trim(), militaresDoc, diasDoc });
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
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline">Salvar</Button>
          {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>{aviso.texto}</p>}
        </div>
      </form>
    </Secao>
  );
}
