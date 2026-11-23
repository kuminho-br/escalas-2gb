import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Posto } from 'contratos';
import { useState, type FormEvent } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { consultaPostos, editarPosto } from '@/api/militares';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Campo } from '@/componentes/Campo';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';

/**
 * Os postos e graduações (entrega 6.13): o administrador corrige a sigla e o nome, uma linha por vez. A ordem não muda (a antiguidade nas escalas
 * vem dela), e não se cria nem se apaga posto aqui.
 */
export function Postos({ podeEditar = true }: { podeEditar?: boolean }) {
  const { data, error, isPending } = useQuery(consultaPostos);
  const [editando, setEditando] = useState<string | null>(null);
  if (isPending) return <p className="py-6 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p>;
  return (
    <div className="max-w-xl rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        Lista do sistema todo, do posto mais moderno para o mais antigo. Corrigir a sigla não muda a ordem de antiguidade, e a importação do Pecúlio passa a aceitar a sigla nova.{podeEditar ? '' : ' Só o administrador altera.'}
      </p>
      <ul aria-label="Postos e graduações" className="divide-y divide-linha">
        {data.map((p) =>
          editando === p.id ? (
            <EdicaoDoPosto key={p.id} posto={p} aoFechar={() => setEditando(null)} />
          ) : (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <span data-sigla className="w-24 shrink-0 font-cond font-semibold">{p.sigla}</span>
              <span className="text-apagado">{p.nome}</span>
              {podeEditar && editando === null && (
                <Button size="sm" variant="ghost" className="ml-auto" aria-label={`Corrigir ${p.sigla}`} onClick={() => setEditando(p.id)}>
                  Corrigir
                </Button>
              )}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function EdicaoDoPosto({ posto, aoFechar }: { posto: Posto; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const [sigla, setSigla] = useState(posto.sigla);
  const [nome, setNome] = useState(posto.nome);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const salvar = travar(async () => {
    setCampos({});
    setErro(null);
    try {
      await editarPosto(posto.id, { sigla, nome });
      await queryClient.invalidateQueries({ queryKey: ['postos'] });
      aoFechar();
    } catch (e) {
      const doCampo = camposDe(e);
      setCampos(doCampo);
      if (!Object.keys(doCampo).length) setErro(mensagemDe(e));
    }
  });
  return (
    <li className="px-4 py-3">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void salvar(); }} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <Campo id={`posto-sigla-${posto.id}`} rotulo="Sigla" erro={campos.sigla}>
          <Input id={`posto-sigla-${posto.id}`} value={sigla} onChange={(e) => setSigla(e.target.value)} autoFocus />
        </Campo>
        <Campo id={`posto-nome-${posto.id}`} rotulo="Nome" erro={campos.nome}>
          <Input id={`posto-nome-${posto.id}`} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <span className="flex gap-1">
          <Button type="submit" size="sm" disabled={salvando}>Salvar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={aoFechar}>Cancelar</Button>
        </span>
      </form>
      {erro && <p role="alert" className="mt-2 text-sm text-alerta">{erro}</p>}
    </li>
  );
}
