import type { LinhaDaBusca } from 'contratos';
import { X } from 'lucide-react';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/componentes/ui/button';

type Contexto = {
  selecionados: LinhaDaBusca[];
  tem: (id: string) => boolean;
  alternar: (linha: LinhaDaBusca) => void;
  incluir: (linhas: LinhaDaBusca[]) => void;
  tirar: (id: string) => void;
  limpar: () => void;
};
const SelecaoContext = createContext<Contexto | null>(null);

/**
 * A seleção de militares de "Pesquisar militares" (6.51): quem a pessoa marcou fica selecionado mesmo quando ela muda os filtros ou carrega um arquivo, e é assim que o
 * conjunto fica não contíguo (busca, marca, busca de novo, marca mais). Vive só na tela: some ao sair, e não é gravada. É a entrada da atualização em lote (6.52).
 */
export function SelecaoDeMilitares({ children }: { children: ReactNode }) {
  const [selecionados, setSelecionados] = useState<LinhaDaBusca[]>([]);
  const valor = useMemo<Contexto>(
    () => ({
      selecionados,
      tem: (id) => selecionados.some((s) => s.id === id),
      alternar: (linha) => setSelecionados((atual) => (atual.some((s) => s.id === linha.id) ? atual.filter((s) => s.id !== linha.id) : [...atual, linha])),
      incluir: (linhas) => setSelecionados((atual) => [...atual, ...linhas.filter((l) => !atual.some((s) => s.id === l.id))]),
      tirar: (id) => setSelecionados((atual) => atual.filter((s) => s.id !== id)),
      limpar: () => setSelecionados([]),
    }),
    [selecionados],
  );
  return <SelecaoContext.Provider value={valor}>{children}</SelecaoContext.Provider>;
}

export function useSelecao(): Contexto {
  const c = useContext(SelecaoContext);
  if (!c) throw new Error('useSelecao fora de SelecaoDeMilitares');
  return c;
}

/** O painel "Selecionados ({n})": quem está dentro, com "Tirar" em cada um e "Limpar". Sem ninguém, nem aparece. */
export function PainelDeSelecionados() {
  const { selecionados, tirar, limpar } = useSelecao();
  if (selecionados.length === 0) return null;
  const titulo = `Selecionados (${selecionados.length})`;
  return (
    <section aria-labelledby="selecionados-titulo" className="mt-6 max-w-3xl rounded-xl border border-linha bg-superficie">
      <div className="flex items-center justify-between gap-3 border-b border-linha px-4 py-2">
        <h2 id="selecionados-titulo" className="font-cond text-lg font-semibold">{titulo}</h2>
        <Button type="button" variant="discreto" onClick={limpar}>Limpar</Button>
      </div>
      <ul className="max-h-60 divide-y divide-linha overflow-auto">
        {selecionados.map((s) => (
          <li key={s.id} className="flex items-center gap-2 px-4 py-2">
            <span className="font-cond text-apoio text-apagado">{s.postoGrad}</span>
            <span className="font-cond font-semibold">{s.nomeGuerra}</span>
            <span className="ml-auto rounded border border-linha px-1.5 font-cond text-xs">{s.lotacao ?? 'Sem lotação'}</span>
            <Button type="button" variant="discreto" size="sm" aria-label={`Tirar ${s.postoGrad} ${s.nomeGuerra}`} onClick={() => tirar(s.id)}>
              <X aria-hidden />
              Tirar
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
