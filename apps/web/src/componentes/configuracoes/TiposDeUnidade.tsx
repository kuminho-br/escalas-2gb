import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TipoDeUnidadeComUso } from 'contratos';
import { useState, type FormEvent } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { alterarTipoDeUnidade, consultaTiposDeUnidade, criarTipoDeUnidade, excluirTipoDeUnidade } from '@/api/estrutura';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Campo } from '@/componentes/Campo';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';

/**
 * O cadastro "Tipos de unidade" (entrega 6.25, só o administrador): grupamento, divisão, seção, pelotão… O tipo é só um nome que aparece na árvore;
 * nenhuma regra do sistema depende dele. A ordem serve só para ordenar a lista. Só se exclui o tipo que nenhuma unidade usa, nem extinta.
 */
export function TiposDeUnidade() {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery(consultaTiposDeUnidade);
  const [nome, setNome] = useState('');
  const [ordem, setOrdem] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();

  /** Roda a ação, atualiza a lista e diz se deu certo; o erro aparece na tela. */
  async function executar(acao: () => Promise<unknown>): Promise<boolean> {
    setErro(null);
    setCampos({});
    try {
      await acao();
      await queryClient.invalidateQueries({ queryKey: ['tipos-de-unidade'] });
      // o nome do tipo aparece na árvore
      void queryClient.invalidateQueries({ queryKey: ['estrutura'] });
      return true;
    } catch (e) {
      const doCampo = camposDe(e);
      setCampos(doCampo);
      setErro(Object.keys(doCampo).length ? null : mensagemDe(e));
      return false;
    }
  }
  const incluir = travar(async () => {
    if (await executar(() => criarTipoDeUnidade({ nome, ...(ordem !== '' ? { ordem: Number(ordem) } : {}) }))) {
      setNome('');
      setOrdem('');
    }
  });

  if (isPending) return <p className="py-6 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p>;
  return (
    <div className="max-w-xl rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        O tipo é só o nome que aparece ao lado de cada unidade. Qualquer tipo fica abaixo de qualquer tipo, e a ordem só organiza a lista. Só se exclui o tipo que nenhuma unidade usa.
      </p>
      <ul className="divide-y divide-linha">
        {data.map((t) => <Item key={t.id} tipo={t} aoSalvar={(d) => executar(() => alterarTipoDeUnidade(t.id, d))} aoExcluir={() => executar(() => excluirTipoDeUnidade(t.id))} />)}
      </ul>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void incluir(); }} className="grid gap-3 border-t border-linha px-4 py-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
        <Campo id="novo-tipo-nome" rotulo="Novo tipo de unidade" erro={campos.nome}><Input id="novo-tipo-nome" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} /></Campo>
        <Campo id="novo-tipo-ordem" rotulo="Ordem (opcional)" erro={campos.ordem}><Input id="novo-tipo-ordem" type="number" min={0} max={1000} value={ordem} onChange={(e) => setOrdem(e.target.value)} /></Campo>
        <Button type="submit" disabled={!nome.trim() || salvando}>Incluir</Button>
      </form>
      {erro && <p role="alert" className="px-4 pb-3 text-sm text-alerta">{erro}</p>}
    </div>
  );
}

function Item({ tipo, aoSalvar, aoExcluir }: { tipo: TipoDeUnidadeComUso; aoSalvar: (d: { nome?: string; ordem?: number }) => Promise<boolean>; aoExcluir: () => Promise<boolean> }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(tipo.nome);
  const [ordem, setOrdem] = useState(String(tipo.ordem));
  const { salvando, travar } = useTrava();
  const salvar = travar(async () => {
    if (await aoSalvar({ ...(nome !== tipo.nome ? { nome } : {}), ...(Number(ordem) !== tipo.ordem ? { ordem: Number(ordem) } : {}) })) setEditando(false);
  });
  if (editando) {
    return (
      <li className="px-4 py-2">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void salvar(); }} className="flex flex-wrap items-center gap-2">
          <Input aria-label={`Novo nome de ${tipo.nome}`} className="min-w-40 flex-1" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} autoFocus />
          <Input aria-label={`Ordem de ${tipo.nome}`} className="w-24" type="number" min={0} max={1000} value={ordem} onChange={(e) => setOrdem(e.target.value)} />
          <Button type="submit" size="sm" disabled={salvando}>Salvar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setNome(tipo.nome); setOrdem(String(tipo.ordem)); setEditando(false); }}>Cancelar</Button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="font-medium">{tipo.nome}</span>
      <span className="text-[13px] text-apagado">{tipo.unidades === 0 ? 'Nenhuma unidade' : tipo.unidades === 1 ? '1 unidade' : `${tipo.unidades} unidades`} · ordem {tipo.ordem}</span>
      <span className="ml-auto flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>Renomear</Button>
        {/* o tipo em uso não se exclui: o botão fica desligado e diz por quê */}
        <Button size="sm" variant="ghost" disabled={tipo.unidades > 0} title={tipo.unidades > 0 ? 'Há unidades deste tipo.' : undefined} aria-label={`Excluir ${tipo.nome}`} onClick={() => void aoExcluir()}>Excluir</Button>
      </span>
    </li>
  );
}
