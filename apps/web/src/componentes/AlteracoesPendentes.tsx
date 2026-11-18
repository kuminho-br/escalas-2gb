import { useBlocker } from '@tanstack/react-router';
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

export const MENSAGEM_PENDENTE = 'Há alterações não salvas nesta ficha. Sair mesmo assim?';

type Registro = (chave: string, sujo: boolean) => void;
const Contexto = createContext<Registro | null>(null);

/**
 * Junta as alterações pendentes dos blocos da ficha. Com alguma pendente, trocar de ficha ou sair da tela
 * pergunta antes (MENSAGEM_PENDENTE), e fechar a aba ou recarregar usa o aviso do próprio navegador.
 */
export function ProvedorDePendencias({ children }: { children: ReactNode }) {
  const sujas = useRef(new Set<string>());
  const registrar = useCallback<Registro>((chave, sujo) => {
    if (sujo) sujas.current.add(chave);
    else sujas.current.delete(chave);
  }, []);
  useBlocker({
    // true bloqueia a navegação: sem pendência passa direto; com pendência, só segue se a pessoa confirmar
    shouldBlockFn: () => sujas.current.size > 0 && !window.confirm(MENSAGEM_PENDENTE),
    enableBeforeUnload: () => sujas.current.size > 0,
  });
  return <Contexto.Provider value={registrar}>{children}</Contexto.Provider>;
}

/** Diz ao provedor se este bloco está diferente do último gravado; ao sair da tela, o bloco deixa de contar. */
export function usePendencia(chave: string, sujo: boolean): void {
  const registrar = useContext(Contexto);
  // registra já na renderização: a navegação pode acontecer antes de qualquer efeito
  registrar?.(chave, sujo);
  useEffect(() => () => registrar?.(chave, false), [registrar, chave]);
}

/** "Alterações não salvas", ao lado do botão de salvar do bloco. */
export function EtiquetaPendente({ sujo }: { sujo: boolean }) {
  return sujo ? <p role="status" className="text-xs text-alerta">Alterações não salvas</p> : null;
}
