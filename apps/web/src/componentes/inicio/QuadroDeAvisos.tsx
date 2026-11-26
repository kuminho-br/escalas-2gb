import { ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { useId, useRef } from 'react';
import type { QuadroDeAvisos as Quadro } from 'contratos';
import { Button } from '@/componentes/ui/button';
import { diaEMesBr } from '@/lib/meses';
import { cn } from '@/lib/utils';
import type { ModoDaJanela } from './JanelaDoAviso';

/** Acima disto os pontos não cabem no painel: ficam só a contagem e as setas. */
const MAXIMO_DE_PONTOS = 12;

/**
 * O painel de avisos (6.56), dentro da cena da tela inicial: um painel escuro translúcido com a borda de cima em vinho. Um aviso por vez, com setas (que dão a volta) e pontos; não passa sozinho.
 * O aviso mostra o título, o texto (que rola dentro dele se for longo, sem crescer a cena), "{posto} {nome de guerra}, {dd/mm}, {unidade}" e a marca "Fixado". Quem pode alterar o aviso vê
 * "Editar" e "Retirar"; quem pode publicar em alguma unidade vê "Publicar aviso". Sem aviso, o painel só existe para quem pode publicar.
 * O aviso à vista é guardado pelo id, fora do painel (`idAtual` e `aoMudarId`), e a janela também (`aoAbrirJanela`): o painel pode sair do lugar e voltar (a tela cruzou 1024 px) sem perder
 * qual aviso está à vista nem fechar a janela. Se o aviso à vista sai da lista (retirado), fica o que ocupa o mesmo lugar (o vizinho).
 */
export function QuadroDeAvisos({ quadro, idAtual, aoMudarId, aoAbrirJanela, className }: {
  quadro: Quadro;
  idAtual: string | null;
  aoMudarId: (id: string) => void;
  aoAbrirJanela: (modo: ModoDaJanela) => void;
  className?: string;
}) {
  const titulo = useId();
  const total = quadro.avisos.length;
  // a posição do aviso à vista: a do id; sem ele na lista (retirado), a mesma posição de antes, até o último
  const ultimaPosicao = useRef(0);
  const achado = idAtual ? quadro.avisos.findIndex((a) => a.id === idAtual) : -1;
  const indice = total === 0 ? 0 : achado >= 0 ? achado : Math.min(ultimaPosicao.current, total - 1);
  ultimaPosicao.current = indice;
  if (total === 0 && !quadro.podePublicar) return null;
  const atual = quadro.avisos[indice];
  const passar = (n: number) => aoMudarId(quadro.avisos[(indice + n + total) % total]!.id);

  return (
    <>
      {/* o painel recebe o foco quando o aviso à vista é retirado (o botão "Retirar" saiu da tela) */}
      <section aria-labelledby={titulo} data-painel-de-avisos tabIndex={-1} className={cn('grid max-h-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-superficie border border-t-3 border-white/20 border-t-vinho bg-tinta/70 px-4 pt-3.5 pb-3 text-white outline-none backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-white', className)}>
        {/* a troca de aviso é dita ao leitor de tela, sem repetir o texto todo */}
        <p aria-live="polite" className="sr-only">{atual ? `Aviso ${indice + 1} de ${total}: ${atual.titulo}` : ''}</p>
        <header className="flex items-center gap-2">
          <h2 id={titulo} className="font-cond text-nome leading-none font-semibold">Avisos</h2>
          {total > 0 && <span className="text-apoio text-white/80">{`${indice + 1} de ${total}`}</span>}
          {total > 1 && (
            <div className="ml-auto flex gap-0.5">
              <button type="button" aria-label="Aviso anterior" onClick={() => passar(-1)} className="grid size-7 place-items-center rounded-controle hover:bg-white/15 focus-visible:outline-white">
                <ChevronLeft aria-hidden className="size-4" />
              </button>
              <button type="button" aria-label="Próximo aviso" onClick={() => passar(1)} className="grid size-7 place-items-center rounded-controle hover:bg-white/15 focus-visible:outline-white">
                <ChevronRight aria-hidden className="size-4" />
              </button>
            </div>
          )}
        </header>
        {atual ? (
          <article className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-1">
            <b className="line-clamp-2 font-cond text-nome font-semibold break-words">{atual.titulo}</b>
            <p className="max-h-24 min-h-0 overflow-y-auto [scrollbar-color:var(--color-encaixe)_transparent] [scrollbar-width:thin] text-corpo break-words whitespace-pre-line text-white/90">{atual.texto}</p>
            <small className="flex flex-wrap items-center gap-x-2 text-apoio text-white/75">
              <span>{`${atual.autor.patente} ${atual.autor.nomeGuerra}, ${diaEMesBr(atual.publicadoEm)}, ${atual.unidadeSigla}`}</span>
              {atual.fixado && (
                <span className="inline-flex items-center gap-1 font-medium text-white">
                  <Pin aria-hidden className="size-3" />
                  Fixado
                </span>
              )}
            </small>
            {atual.podeAlterar && (
              <div className="flex gap-3">
                <button type="button" onClick={() => aoAbrirJanela({ tipo: 'editar', aviso: atual })} className="rounded-xs text-apoio font-medium underline underline-offset-3 focus-visible:outline-white">Editar</button>
                <button type="button" onClick={() => aoAbrirJanela({ tipo: 'retirar', aviso: atual })} className="rounded-xs text-apoio font-medium underline underline-offset-3 focus-visible:outline-white">Retirar</button>
              </div>
            )}
          </article>
        ) : (
          <p className="text-corpo text-white/90">Nenhum aviso.</p>
        )}
        <footer className="flex items-center gap-2">
          {total > 1 && total <= MAXIMO_DE_PONTOS && (
            <div className="flex min-w-0 flex-wrap gap-[5px] overflow-hidden">
              {quadro.avisos.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={`Ir ao aviso ${i + 1}`}
                  aria-current={i === indice ? 'true' : undefined}
                  onClick={() => aoMudarId(a.id)}
                  // as setas bastam para o teclado: seis pontos de 6 px não são seis paradas de Tab
                  tabIndex={-1}
                  className={cn('size-1.5 rounded-full p-0 outline-offset-4', i === indice ? 'bg-white' : 'bg-white/35')}
                />
              ))}
            </div>
          )}
          {quadro.podePublicar && (
            <Button type="button" variant="link" size="xs" onClick={() => aoAbrirJanela({ tipo: 'publicar' })} className="ml-auto px-0 text-white focus-visible:outline-white">
              Publicar aviso
            </Button>
          )}
        </footer>
      </section>
    </>
  );
}
