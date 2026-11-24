import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SituacaoDoMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { editarSituacaoDoMilitar, incluirSituacaoDoMilitar } from '@/api/configuracoes';
import { consultaSituacoesDoMilitar } from '@/api/militares';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Espera } from '@/componentes/resposta/Espera';

/** O catálogo "Situações do militar" (Ativa, Reserva…): só o administrador altera. "Pode ser escalado" diz se quem está na situação entra nas escalas. */
export function SituacoesDoMilitar({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery(consultaSituacoesDoMilitar);
  const [novo, setNovo] = useState('');
  const [novoEscalavel, setNovoEscalavel] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    try {
      await acao();
      await queryClient.invalidateQueries({ queryKey: ['situacoes-do-militar'] });
      return true;
    } catch (e) {
      setErro(mensagemDe(e));
      return false;
    }
  }
  async function incluir(e: FormEvent) {
    e.preventDefault();
    if (await executar(() => incluirSituacaoDoMilitar({ nome: novo, escalavel: novoEscalavel }))) {
      setNovo('');
      setNovoEscalavel(true);
    }
  }

  if (isPending) return <Espera className="py-6" />;
  if (error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p>;
  return (
    <div className="max-w-xl rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        Lista do sistema todo. {podeEditar ? 'Quem está numa situação que não pode ser escalada sai das escalas. Desativar tira da lista de escolha, mas mantém nos registros antigos.' : 'Só o administrador altera.'}
      </p>
      <ul className="divide-y divide-linha">
        {data.map((s) => <Item key={s.id} situacao={s} podeEditar={podeEditar} aoSalvar={(d) => executar(() => editarSituacaoDoMilitar(s.id, d))} />)}
      </ul>
      {podeEditar && (
        <form onSubmit={incluir} className="grid gap-3 border-t border-linha px-4 py-3">
          <div className="grid gap-1.5">
            <Label htmlFor="nova-situacao">Nova situação do militar</Label>
            <Input id="nova-situacao" value={novo} onChange={(e) => setNovo(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={novoEscalavel} onChange={(e) => setNovoEscalavel(e.target.checked)} />
            Pode ser escalado
          </label>
          <div><Button type="submit" disabled={!novo.trim()}>Incluir</Button></div>
        </form>
      )}
      {erro && <p role="alert" className="px-4 pb-3 text-sm text-alerta">{erro}</p>}
    </div>
  );
}

function Item({ situacao, podeEditar, aoSalvar }: { situacao: SituacaoDoMilitar; podeEditar: boolean; aoSalvar: (d: { nome?: string; escalavel?: boolean; ativo?: boolean }) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(situacao.nome);
  async function renomear(e: FormEvent) {
    e.preventDefault();
    if (await aoSalvar({ nome })) setEditando(false);
  }
  if (editando) {
    return (
      <li className="px-4 py-2">
        <form onSubmit={renomear} className="flex items-center gap-2">
          <Input aria-label={`Novo nome de ${situacao.nome}`} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          <Button type="submit" size="sm">Salvar</Button>
          <Button type="button" size="sm" variant="discreto" onClick={() => setEditando(false)}>Cancelar</Button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <span className={situacao.ativo ? '' : 'text-apagado'}>{situacao.nome}</span>
      {!situacao.ativo && <span className="rounded bg-muted px-1.5 text-xs text-apagado">desativada</span>}
      <label className="ml-auto flex items-center gap-2 text-sm">
        <Checkbox
          aria-label={`${situacao.nome}: pode ser escalado`}
          checked={situacao.escalavel}
          disabled={!podeEditar}
          onChange={(e) => void aoSalvar({ escalavel: e.target.checked })}
        />
        Pode ser escalado
      </label>
      {podeEditar && (
        <span className="flex gap-1">
          <Button size="sm" variant="discreto" onClick={() => setEditando(true)}>Renomear</Button>
          <Button size="sm" variant="discreto" onClick={() => void aoSalvar({ ativo: !situacao.ativo })}>{situacao.ativo ? 'Desativar' : 'Reativar'}</Button>
        </span>
      )}
    </li>
  );
}
