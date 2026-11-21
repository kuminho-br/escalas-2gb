import { useBlocker } from '@tanstack/react-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/componentes/ui/button';

export const MENSAGEM_PENDENTE = 'Há alterações não salvas nesta ficha. Sair mesmo assim?';

type Registro = (chave: string, sujo: boolean) => void;
const Contexto = createContext<Registro | null>(null);

// Só há uma ficha aberta por vez. O conjunto fica aqui, e não no provedor, para quem está fora da ficha
// (o botão Sair do topo) e para quem decide por conta própria (trocar de versão) poderem perguntar.
const sujas = new Set<string>();

/** Há alteração não salva na ficha aberta (ou, com `chave`, naquele bloco)? */
export function haAlteracoesPendentes(chave?: string): boolean {
  return chave ? sujas.has(chave) : sujas.size > 0;
}

/**
 * A página vai ser trocada à força (a sessão terminou): o que não foi salvo já se perdeu, e o aviso "Sair do site?" do navegador só atrapalharia
 * (o aviso de sessão terminada, na tela de entrar, já diz o que houve).
 */
export function descartarPendencias(): void {
  sujas.clear();
}

/** Pergunta se pode descartar as alterações pendentes; sem pendência, deixa passar. */
export function podeDescartar(chave?: string): boolean {
  return !haAlteracoesPendentes(chave) || window.confirm(MENSAGEM_PENDENTE);
}

// funções fixas: o bloqueio não é refeito a cada renderização
// true bloqueia a navegação: sem pendência passa direto; com pendência, só segue se a pessoa confirmar
const bloquearNavegacao = () => sujas.size > 0 && !window.confirm(MENSAGEM_PENDENTE);

/**
 * Junta as alterações pendentes dos blocos da ficha. Com alguma pendente, trocar de ficha ou sair da tela
 * pergunta antes (MENSAGEM_PENDENTE), e fechar a aba ou recarregar usa o aviso do próprio navegador.
 */
export function ProvedorDePendencias({ children }: { children: ReactNode }) {
  const registrar = useCallback<Registro>((chave, sujo) => {
    if (sujo) sujas.add(chave);
    else sujas.delete(chave);
  }, []);
  useBlocker({ shouldBlockFn: bloquearNavegacao, enableBeforeUnload: haAlteracoesPendentes });
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
/**
 * Trava o Salvar enquanto grava: `travar(f)` devolve uma função que, chamada de novo antes de `f` terminar,
 * não faz nada; `salvando` desabilita o botão. Dois cliques seguidos mandam um pedido só.
 */
export function useTrava() {
  const [salvando, setSalvando] = useState(false);
  const ocupado = useRef(false);
  const travar =
    <A extends unknown[]>(f: (...a: A) => Promise<void>) =>
    async (...a: A): Promise<void> => {
      if (ocupado.current) return;
      ocupado.current = true;
      setSalvando(true);
      try {
        await f(...a);
      } finally {
        ocupado.current = false;
        setSalvando(false);
      }
    };
  return { salvando, travar };
}

/**
 * O servidor trouxe outro conteúdo para este bloco (outra gravação, importação, volta à janela): sem alteração
 * pendente, `aoRecarregar` põe os campos no valor novo; com alteração, o que a pessoa digitou fica. O bloco não é
 * recriado (a `key` leva só o id), então o aviso de "salvo" continua na tela.
 */
export function useSincronizar(doServidor: string, sujo: boolean, aoRecarregar: () => void) {
  const [visto, setVisto] = useState(doServidor);
  if (doServidor !== visto) {
    setVisto(doServidor);
    if (!sujo) aoRecarregar();
  }
}

export function EtiquetaPendente({ sujo }: { sujo: boolean }) {
  return sujo ? <p role="status" className="text-xs text-alerta">Alterações não salvas</p> : null;
}

/**
 * O fim de todo bloco que grava: o botão fica apagado sem alteração e acende em vinho quando há o que salvar.
 * O "salvo" só aparece enquanto não há alteração nova; o erro fica até a próxima tentativa.
 */
export function AcoesDoBloco({
  sujo,
  salvando = false,
  desabilitado = false,
  forcar = false,
  aviso,
  rotulo = 'Salvar',
  tipo = 'submit',
  aoSalvar,
}: {
  sujo: boolean;
  salvando?: boolean;
  /** outro motivo para não poder salvar (ex.: sem mês escolhido) */
  desabilitado?: boolean;
  /** há o que gravar mesmo sem alteração da pessoa (ex.: tirar uma faixa que não existe mais) */
  forcar?: boolean;
  aviso: { erro: boolean; texto: string } | null;
  rotulo?: string;
  tipo?: 'submit' | 'button';
  aoSalvar?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type={tipo} variant={sujo || forcar ? 'default' : 'outline'} disabled={(!sujo && !forcar) || salvando || desabilitado} onClick={aoSalvar}>
        {rotulo}
      </Button>
      <EtiquetaPendente sujo={sujo} />
      {aviso && (aviso.erro || !sujo) && (
        <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
