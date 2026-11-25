import type { FiltrosDaBusca } from 'contratos';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Marca } from './ArvoreDeMarcar';
import { EXTRAS_VAZIOS, type Extras } from './FiltrosDaPesquisa';
import { SelecaoDeMilitares } from './Selecao';

/**
 * O que a pessoa montou em "Pesquisar militares" (as marcas da árvore, as matrículas do arquivo, "Mais filtros" e a busca em vigor), com a chave do endereço que a produziu.
 * Vive acima das rotas do Pecúlio (6.52): abrir a ficha de um militar e voltar não perde a seleção nem o que estava montado; sair do módulo Pecúlio zera tudo.
 */
export type EstadoDaPesquisa = { marcas: Marca[]; matriculas: string[]; extras: Extras; aplicados: FiltrosDaBusca | null; chave: string };
export const ESTADO_VAZIO: EstadoDaPesquisa = { marcas: [], matriculas: [], extras: EXTRAS_VAZIOS, aplicados: null, chave: '|' };

type Contexto = { estado: EstadoDaPesquisa; mudar: (parte: Partial<EstadoDaPesquisa>) => void; reiniciar: (chave: string) => void };
const Ctx = createContext<Contexto | null>(null);

export function PesquisaDoPeculio({ ativa, children }: { ativa: boolean; children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDaPesquisa>(ESTADO_VAZIO);
  // fora do módulo Pecúlio, tudo some (a seleção também: ver `SelecaoDeMilitares`)
  useEffect(() => {
    if (!ativa) setEstado(ESTADO_VAZIO);
  }, [ativa]);
  // as funções são sempre as mesmas: a tela as usa como dependência de efeito, e só o endereço deve fazê-la rodar de novo
  const mudar = useCallback((parte: Partial<EstadoDaPesquisa>) => setEstado((e) => ({ ...e, ...parte })), []);
  const reiniciar = useCallback((chave: string) => setEstado({ ...ESTADO_VAZIO, chave }), []);
  const valor = useMemo<Contexto>(() => ({ estado, mudar, reiniciar }), [estado, mudar, reiniciar]);
  return (
    <Ctx.Provider value={valor}>
      <SelecaoDeMilitares ativa={ativa}>{children}</SelecaoDeMilitares>
    </Ctx.Provider>
  );
}

export function usePesquisaDoPeculio(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePesquisaDoPeculio fora de PesquisaDoPeculio');
  return c;
}
