import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Escala } from 'contratos';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarEscalas, salvarServicosDaEscala } from '@/api/escalas';
import { consultaServicos } from '@/api/servicos';
import { Secao } from '@/componentes/militares/Secao';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';

type Item = { id: string; nome: string; cor: string };

/** Serviços reunidos na ordem de preenchimento (o primeiro é o que uma alocação nova recebe). */
export function ServicosDaEscala({ escala, unidadeId }: { escala: Escala; unidadeId: string }) {
  const queryClient = useQueryClient();
  const servicos = useQuery(consultaServicos(unidadeId));
  const [itens, setItens] = useState<Item[]>(escala.servicos);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const fora = (servicos.data ?? []).filter((s) => s.ativo && !itens.some((i) => i.id === s.id));

  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= itens.length) return;
    const n = [...itens];
    [n[i], n[j]] = [n[j]!, n[i]!];
    setItens(n);
  }
  async function salvar() {
    setAviso(null);
    try {
      await salvarServicosDaEscala(escala.id, itens.map((i) => i.id));
      atualizarEscalas(queryClient);
      setAviso({ erro: false, texto: 'Serviços salvos.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Serviços">
      <p className="-mt-1 mb-3 text-xs text-apagado">Na ordem de preenchimento: o primeiro é o que um militar novo na escala recebe.</p>
      <ol className="grid gap-1.5">
        {itens.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg border border-linha px-3 py-1.5 text-sm">
            <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: s.cor }} />
            <span className="font-medium">{s.nome}</span>
            <span className="ml-auto flex gap-1">
              <Button type="button" size="icon" variant="ghost" aria-label={`Subir ${s.nome}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                <ArrowUp aria-hidden />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`Descer ${s.nome}`} disabled={i === itens.length - 1} onClick={() => mover(i, 1)}>
                <ArrowDown aria-hidden />
              </Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Remover ${s.nome}`} onClick={() => setItens(itens.filter((x) => x.id !== s.id))}>
                Remover
              </Button>
            </span>
          </li>
        ))}
      </ol>
      {itens.length === 0 && <p className="text-sm text-apagado">Nenhum serviço ainda.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {fora.length > 0 && (
          <Selecao
            aria-label="Incluir serviço"
            value=""
            className="w-56"
            onChange={(ev) => {
              const s = fora.find((x) => x.id === ev.target.value);
              if (s) setItens([...itens, { id: s.id, nome: s.nome, cor: s.cor }]);
            }}
          >
            <option value="">Incluir serviço…</option>
            {fora.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Selecao>
        )}
        <Button type="button" onClick={() => void salvar()}>Salvar serviços</Button>
        {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>{aviso.texto}</p>}
      </div>
    </Secao>
  );
}
