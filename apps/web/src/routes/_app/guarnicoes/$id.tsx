import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { FichaGuarnicao } from 'contratos';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaCatalogo } from '@/api/configuracoes';
import { atualizarGuarnicoes, consultaGuarnicao, editarGuarnicao } from '@/api/guarnicoes';
import { Versoes } from '@/componentes/guarnicoes/Versoes';
import { Secao } from '@/componentes/militares/Secao';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';

export const Route = createFileRoute('/_app/guarnicoes/$id')({
  component: Ficha,
});

function Ficha() {
  const { id } = Route.useParams();
  const { eu } = Route.useRouteContext();
  const { data: ficha, error, isPending } = useQuery(consultaGuarnicao(id));

  if (isPending) return <p className="p-4 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;

  return (
    <article className="grid gap-4">
      <header className="flex items-baseline gap-3">
        <Link to="/guarnicoes" className="lg:hidden" aria-label="Voltar para a lista">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h2 className="font-cond text-2xl font-semibold">{ficha.nome}</h2>
        {!ficha.atividade && <p className="text-sm text-alerta">Cadastro incompleto: Sem atividade.</p>}
      </header>
      {/* key: ao trocar de guarnição, os formulários começam do zero */}
      <Identificacao key={`i-${ficha.id}`} ficha={ficha} />
      <Versoes key={`v-${ficha.id}`} ficha={ficha} unidadeId={eu.unidade.id} />
      <UsadaEm ficha={ficha} />
    </article>
  );
}

function Identificacao({ ficha }: { ficha: FichaGuarnicao }) {
  const queryClient = useQueryClient();
  const atividades = useQuery(consultaCatalogo('atividades'));
  const [nome, setNome] = useState(ficha.nome);
  const [atividade, setAtividade] = useState(ficha.atividadeId ?? '');
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  // só as ativas, mais a que a guarnição já tem (mesmo desativada)
  const opcoes = atividades.data?.filter((a) => a.ativo || a.id === ficha.atividadeId) ?? [];

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    try {
      await editarGuarnicao(ficha.id, { nome: nome.trim(), atividadeId: atividade || null });
      atualizarGuarnicoes(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Identificação">
      <form onSubmit={salvar} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="gn-nome">Nome</Label>
            <Input id="gn-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gn-atividade">Atividade</Label>
            <Selecao id="gn-atividade" value={atividade} onChange={(e) => setAtividade(e.target.value)}>
              <option value="">Sem atividade</option>
              {opcoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
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

function UsadaEm({ ficha }: { ficha: FichaGuarnicao }) {
  return (
    <Secao titulo="Onde é usada">
      {ficha.usadaEm.length === 0 ? (
        <p className="text-sm text-apagado">Ainda não está em nenhuma escala.</p>
      ) : (
        <ul className="grid gap-1.5 text-sm">
          {ficha.usadaEm.map((u) => (
            <li key={u.escalaId} className="flex gap-3">
              <span className="font-medium">{u.escala}</span>
              <span className="text-apagado">{u.turnos.includes('todos') ? 'todos os turnos' : `turnos ${u.turnos.join(', ')}`}</span>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
