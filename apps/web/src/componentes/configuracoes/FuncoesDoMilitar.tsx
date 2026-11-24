import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FuncaoDoMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { editarFuncaoDoMilitar, incluirFuncaoDoMilitar } from '@/api/configuracoes';
import { consultaFuncoesDoMilitar } from '@/api/militares';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Espera } from '@/componentes/resposta/Espera';

/** O catálogo "Funções do militar" (o que ele faz na seção): só o administrador altera. Desativar tira a função da lista de escolha, mas ela fica nas fichas que já a têm. */
export function FuncoesDoMilitar({ podeEditar }: { podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery(consultaFuncoesDoMilitar);
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    try {
      await acao();
      await queryClient.invalidateQueries({ queryKey: ['funcoes-do-militar'] });
      return true;
    } catch (e) {
      setErro(mensagemDe(e));
      return false;
    }
  }
  async function incluir(e: FormEvent) {
    e.preventDefault();
    if (await executar(() => incluirFuncaoDoMilitar({ nome: nova }))) setNova('');
  }

  if (isPending) return <Espera className="py-6" />;
  if (error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p>;
  return (
    <div className="max-w-xl rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        Lista do sistema todo. {podeEditar ? 'A função aparece na ficha do militar. Desativar tira da lista de escolha, mas mantém nas fichas que já a têm.' : 'Só o administrador altera.'}
      </p>
      {data.length === 0 ? (
        <p className="px-4 py-3 text-sm text-apagado">Ainda não há funções cadastradas.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {data.map((f) => <Item key={f.id} funcao={f} podeEditar={podeEditar} aoSalvar={(d) => executar(() => editarFuncaoDoMilitar(f.id, d))} />)}
        </ul>
      )}
      {podeEditar && (
        <form onSubmit={incluir} className="grid gap-3 border-t border-linha px-4 py-3">
          <div className="grid gap-1.5">
            <Label htmlFor="nova-funcao">Nova função do militar</Label>
            <Input id="nova-funcao" value={nova} maxLength={80} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div><Button type="submit" disabled={!nova.trim()}>Incluir</Button></div>
        </form>
      )}
      {erro && <p role="alert" className="px-4 pb-3 text-sm text-alerta">{erro}</p>}
    </div>
  );
}

function Item({ funcao, podeEditar, aoSalvar }: { funcao: FuncaoDoMilitar; podeEditar: boolean; aoSalvar: (d: { nome?: string; ativo?: boolean }) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(funcao.nome);
  async function renomear(e: FormEvent) {
    e.preventDefault();
    if (await aoSalvar({ nome })) setEditando(false);
  }
  if (editando) {
    return (
      <li className="px-4 py-2">
        <form onSubmit={renomear} className="flex items-center gap-2">
          <Input aria-label={`Novo nome de ${funcao.nome}`} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} autoFocus />
          <Button type="submit" size="sm">Salvar</Button>
          <Button type="button" size="sm" variant="discreto" onClick={() => setEditando(false)}>Cancelar</Button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <span className={funcao.ativo ? '' : 'text-apagado'}>{funcao.nome}</span>
      {!funcao.ativo && <span className="rounded bg-muted px-1.5 text-xs text-apagado">desativada</span>}
      {podeEditar && (
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="discreto" onClick={() => setEditando(true)}>Renomear</Button>
          <Button size="sm" variant="discreto" onClick={() => void aoSalvar({ ativo: !funcao.ativo })}>{funcao.ativo ? 'Desativar' : 'Reativar'}</Button>
        </span>
      )}
    </li>
  );
}
