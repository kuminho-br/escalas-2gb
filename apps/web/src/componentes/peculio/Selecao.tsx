import { useQueryClient } from '@tanstack/react-query';
import { LIMITE_DA_EXPORTACAO, type LinhaDaBusca, type ResultadoDaBusca } from 'contratos';
import { pedir } from '@/api/cliente';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** A seleção vai até o que a exportação aceita de uma vez (6.63); acima disso a pessoa vê esta frase, e não o erro da validação. */
export const LIMITE_DA_SELECAO = LIMITE_DA_EXPORTACAO;
export const MSG_LIMITE_DA_SELECAO = `Dá para selecionar até ${LIMITE_DA_SELECAO} militares de uma vez.`;

type Contexto = {
  selecionados: LinhaDaBusca[];
  /** A frase do limite, quando a última inclusão passou dele (nada entrou); some na mudança seguinte da seleção. */
  aviso: string | null;
  tem: (id: string) => boolean;
  alternar: (linha: LinhaDaBusca) => void;
  /** Põe as linhas na seleção; passando do limite, não entra nenhuma e o `aviso` diz por quê. */
  incluir: (linhas: LinhaDaBusca[]) => void;
  tirar: (id: string) => void;
  /** Troca os dados dos que já estão na seleção pelos das linhas novas (pelo id); quem não vem nas linhas fica como estava. */
  atualizar: (linhas: LinhaDaBusca[]) => void;
  limpar: () => void;
  /**
   * Depois de uma importação ou do lote: lê de novo os dados de quem está na seleção (a seleção continua com os mesmos militares, com o dado novo, a lotação inclusive) e faz a
   * pesquisa e o Pecúlio buscarem de novo. As fichas já lidas saem do cache: abrir uma delas espera a leitura nova.
   */
  reler: () => void;
  /** A releitura falhou: o que está na seleção pode ser a lotação de antes. */
  releituraFalhou: boolean;
};
const SelecaoContext = createContext<Contexto | null>(null);

/**
 * A seleção de militares de "Pesquisar militares" (6.51): quem a pessoa marcou fica selecionado mesmo quando ela muda os filtros ou carrega um arquivo, e é assim que o
 * conjunto fica não contíguo (busca, marca, busca de novo, marca mais). Vive acima das rotas do Pecúlio (abrir uma ficha e voltar não a perde): some ao sair do módulo, e não é gravada. É a entrada da atualização em lote (6.52).
 */
export function SelecaoDeMilitares({ ativa = true, children }: { ativa?: boolean; children: ReactNode }) {
  const [selecionados, setSelecionados] = useState<LinhaDaBusca[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [releituraFalhou, setReleituraFalhou] = useState(false);
  const queryClient = useQueryClient();
  // fora do módulo Pecúlio a seleção some
  useEffect(() => {
    if (!ativa) { setSelecionados([]); setAviso(null); }
  }, [ativa]);
  // a seleção muda de uma vez só: a conta do limite e o aviso saem do mesmo valor
  const mudar = useCallback((f: (atual: LinhaDaBusca[]) => LinhaDaBusca[]) => {
    setSelecionados((atual) => {
      const novo = f(atual);
      if (novo.length > LIMITE_DA_SELECAO && novo.length > atual.length) { setAviso(MSG_LIMITE_DA_SELECAO); return atual; }
      setAviso(null);
      return novo;
    });
  }, []);
  const reler = useCallback(() => {
    if (selecionados.length > 0) {
      void pedir<ResultadoDaBusca>('POST', '/api/consulta/militares/buscar', { matriculas: selecionados.map((s) => s.matricula) }).then(
        (r) => { setSelecionados((atual) => atual.map((s) => r.militares.find((l) => l.id === s.id) ?? s)); setReleituraFalhou(false); },
        () => setReleituraFalhou(true),
      );
    }
    queryClient.removeQueries({ queryKey: ['consulta', 'militar'] });
    queryClient.removeQueries({ queryKey: ['militar'] });
    void queryClient.invalidateQueries({ queryKey: ['consulta'] });
    void queryClient.invalidateQueries({ queryKey: ['peculio'] });
    void queryClient.invalidateQueries({ queryKey: ['militares'] });
  }, [selecionados, queryClient]);
  const valor = useMemo<Contexto>(
    () => ({
      selecionados,
      aviso,
      reler,
      releituraFalhou,
      tem: (id) => selecionados.some((s) => s.id === id),
      alternar: (linha) => mudar((atual) => (atual.some((s) => s.id === linha.id) ? atual.filter((s) => s.id !== linha.id) : [...atual, linha])),
      incluir: (linhas) => mudar((atual) => { const ja = new Set(atual.map((s) => s.id)); return [...atual, ...linhas.filter((l) => !ja.has(l.id))]; }),
      tirar: (id) => mudar((atual) => atual.filter((s) => s.id !== id)),
      atualizar: (linhas) => setSelecionados((atual) => atual.map((s) => linhas.find((l) => l.id === s.id) ?? s)),
      limpar: () => { setSelecionados([]); setAviso(null); setReleituraFalhou(false); },
    }),
    [selecionados, aviso, mudar, reler, releituraFalhou],
  );
  return <SelecaoContext.Provider value={valor}>{children}</SelecaoContext.Provider>;
}

export function useSelecao(): Contexto {
  const c = useContext(SelecaoContext);
  if (!c) throw new Error('useSelecao fora de SelecaoDeMilitares');
  return c;
}
