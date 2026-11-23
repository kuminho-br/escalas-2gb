import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bloco da ficha (dentro do FichaPainel, que desenha a moldura e as linhas entre os blocos): título, conteúdo e, opcionalmente, ações à direita do título.
 * Com `recolhida`, começa fechado: o título vira um botão que mostra o `resumo` e abre o conteúdo.
 */
export function Secao({ titulo, acoes, resumo, recolhida, children }: { titulo: string; acoes?: ReactNode; resumo?: string; recolhida?: boolean; children: ReactNode }) {
  const [aberta, setAberta] = useState(!recolhida);
  const idConteudo = useId();
  return (
    <section className="p-4">
      <header className={cn('flex items-center justify-between gap-2', aberta && 'mb-3')}>
        {recolhida ? (
          <h3 className="min-w-0 flex-1 font-cond text-lg font-semibold">
            <button type="button" aria-expanded={aberta} aria-controls={idConteudo} onClick={() => setAberta(!aberta)} className="flex w-full items-center gap-2 text-left">
              <ChevronRight className={cn('size-4 shrink-0 transition-transform', aberta && 'rotate-90')} aria-hidden />
              <span>{titulo}</span>
              {resumo && <span className="truncate font-sans text-sm font-normal text-apagado">{resumo}</span>}
            </button>
          </h3>
        ) : (
          <h3 className="font-cond text-lg font-semibold">{titulo}</h3>
        )}
        {aberta && acoes}
      </header>
      {aberta && <div id={idConteudo}>{children}</div>}
    </section>
  );
}

/** Bloquear não é esconder: o bloco sem permissão aparece só para leitura, e esta frase diz com quem falar. */
export function DonoDoBloco({ unidadeDeCima }: { unidadeDeCima: string | null }) {
  return <p className="mb-3 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{`Este bloco é alterado por quem tem nível de acesso em ${unidadeDeCima ?? 'uma unidade acima'}.`}</p>;
}

/** O que a tela diz perto do campo quando uma lista (postos, tipos de afastamento) não carrega: sem isso o botão ficaria apagado sem explicação. */
export const LISTA_NAO_CARREGOU = 'Não deu para carregar a lista. Recarregue a página.';
export const LISTA_NAO_ATUALIZOU = 'Não deu para atualizar.';

/**
 * O aviso de uma lista (postos, funções, tipos) que falhou: sem lista na tela, "não deu para carregar" (o campo fica sem opções); com a lista já carregada,
 * só um aviso pequeno de que não atualizou (as opções que estão na tela continuam valendo).
 */
export function avisoDaLista(consulta: { isError: boolean; data?: unknown }): string | undefined {
  if (!consulta.isError) return undefined;
  return consulta.data ? LISTA_NAO_ATUALIZOU : LISTA_NAO_CARREGOU;
}

export const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
