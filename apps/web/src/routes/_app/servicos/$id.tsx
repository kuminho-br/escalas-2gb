import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CORES_SERVICO, TipoServico, type Servico } from 'contratos';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarServicos, consultaServico, editarServico, mudarSituacaoServico } from '@/api/servicos';
import { Secao } from '@/componentes/militares/Secao';
import { Turnos } from '@/componentes/servicos/Turnos';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { NOME_TIPO } from '@/lib/servicos';

export const Route = createFileRoute('/_app/servicos/$id')({
  component: Ficha,
});

function Ficha() {
  const { id } = Route.useParams();
  const { data: s, error, isPending } = useQuery(consultaServico(id));
  if (isPending) return <p className="p-4 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>;
  return (
    <article className="grid gap-4">
      <header className="flex items-baseline gap-3">
        <Link to="/servicos" className="lg:hidden" aria-label="Voltar para a lista">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h2 className="font-cond text-2xl font-semibold">{s.nome}</h2>
        {!s.ativo && <span className="rounded border border-linha px-1.5 text-xs">desativado</span>}
      </header>
      <Situacao s={s} />
      <Identificacao key={`i-${s.id}`} s={s} />
      <Turnos key={`t-${s.id}-${s.turnos.map((t) => `${t.id}:${t.letra}:${t.inicio}:${t.fim}`).join(',')}`} servico={s} />
    </article>
  );
}

function Situacao({ s }: { s: Servico }) {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  async function mudar() {
    setErro(null);
    try {
      await mudarSituacaoServico(s.id, !s.ativo);
      atualizarServicos(queryClient);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-linha bg-superficie px-4 py-3 text-sm">
      <span className="text-apagado">{s.ativo ? 'Desativado, o serviço some da lista e continua nas escalas que já o reúnem.' : 'Desativado.'}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => void mudar()}>
        {s.ativo ? 'Desativar' : 'Reativar'}
      </Button>
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
    </div>
  );
}

function Identificacao({ s }: { s: Servico }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(s.nome);
  const [tipo, setTipo] = useState<TipoServico>(s.tipo);
  const [operacao, setOperacao] = useState(s.operacao ?? '');
  const [rotulo, setRotulo] = useState(s.rotuloImpressao ?? '');
  const [cor, setCor] = useState(s.cor);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    try {
      await editarServico(s.id, {
        nome: nome.trim(),
        tipo,
        operacao: tipo === 'diaria' ? operacao.trim() || null : null,
        rotuloImpressao: rotulo.trim() || null,
        cor,
      });
      atualizarServicos(queryClient);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Identificação">
      <form onSubmit={salvar} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="sv-nome">Nome</Label>
            <Input id="sv-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sv-tipo">Tipo</Label>
            <Selecao id="sv-tipo" value={tipo} onChange={(e) => setTipo(TipoServico.parse(e.target.value))}>
              {TipoServico.options.map((t) => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}
            </Selecao>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sv-cor">Cor</Label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="sv-cor" type="color" value={cor} onChange={(e) => setCor(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded-md border border-linha bg-superficie" />
            {Object.entries(CORES_SERVICO).map(([n, c]) => (
              <button
                key={n}
                type="button"
                title={n}
                aria-label={`Cor de ${n}`}
                aria-pressed={cor.toUpperCase() === c.toUpperCase()}
                onClick={() => setCor(c)}
                className="size-6 rounded ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-tinta"
                style={{ backgroundColor: c }}
              />
            ))}
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
