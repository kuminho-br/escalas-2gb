import { ChevronLeft, ChevronRight, Pin } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { QuadroDeAvisos as Quadro } from 'contratos';
import type { Eu } from '@/api/eu';
import { Button } from '@/componentes/ui/button';
import { diaEMesBr } from '@/lib/meses';
import { cn } from '@/lib/utils';
import { JanelaDoAviso, type ModoDaJanela } from './JanelaDoAviso';

/** Acima disto os pontos não cabem no painel: ficam só a contagem e as setas. */
const MAXIMO_DE_PONTOS = 12;

/**
 * O painel de avisos (6.56), dentro da cena da tela inicial: um painel escuro translúcido com a borda de cima em vinho. Um aviso por vez, com setas (que dão a volta) e pontos; não passa sozinho.
 * O aviso mostra o título, o texto (que rola dentro dele se for longo, sem crescer a cena), "{posto} {nome de guerra}, {dd/mm}, {unidade}" e a marca "Fixado". Quem pode alterar o aviso vê
 * "Editar" e "Retirar"; quem pode publicar em alguma unidade vê "Publicar aviso". Sem aviso, o painel só existe para quem pode publicar.
 */
export function QuadroDeAvisos({ eu, quadro, className }: { eu: Eu; quadro: Quadro; className?: string }) {
  const titulo = useId();
  const [indice, setIndice] = useState(0);
  const [janela, setJanela] = useState<ModoDaJanela | null>(null);
  const total = quadro.avisos.length;
  // a lista muda (um aviso retirado, um publicado): o índice nunca passa do último
  useEffect(() => {
    if (indice > 0 && indice >= total) setIndice(Math.max(0, total - 1));
  }, [indice, total]);
  if (total === 0 && !quadro.podePublicar) return null;
  const atual = quadro.avisos[Math.min(indice, total - 1)];
  const passar = (n: number) => setIndice((i) => (i + n + total) % total);

  return (
    <>
      <section aria-labelledby={titulo} className={cn('grid max-h-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-superficie border border-t-[3px] border-white/20 border-t-vinho bg-tinta/70 px-4 pt-3.5 pb-3 text-white backdrop-blur-sm', className)}>
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
            <b className="line-clamp-2 font-cond text-nome leading-[22px] font-semibold break-words">{atual.titulo}</b>
            <p className="max-h-24 min-h-0 overflow-y-auto [scrollbar-color:var(--color-encaixe)_transparent] [scrollbar-width:thin] text-corpo leading-[21px] break-words whitespace-pre-line text-white/90">{atual.texto}</p>
            <small className="flex flex-wrap items-center gap-x-2 text-apoio leading-[18px] text-white/75">
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
                <button type="button" onClick={() => setJanela({ tipo: 'editar', aviso: atual })} className="text-apoio font-medium underline underline-offset-3">Editar</button>
                <button type="button" onClick={() => setJanela({ tipo: 'retirar', aviso: atual })} className="text-apoio font-medium underline underline-offset-3">Retirar</button>
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
                  onClick={() => setIndice(i)}
                  className={cn('size-1.5 rounded-full p-0 outline-offset-4', i === indice ? 'bg-white' : 'bg-white/35')}
                />
              ))}
            </div>
          )}
          {quadro.podePublicar && (
            <Button type="button" variant="link" size="xs" onClick={() => setJanela({ tipo: 'publicar' })} className="ml-auto px-0 text-white">
              Publicar aviso
            </Button>
          )}
        </footer>
      </section>
      {janela && <JanelaDoAviso eu={eu} modo={janela} aoFechar={() => setJanela(null)} />}
    </>
  );
}
