import { CORES_SERVICO } from 'contratos';
import { Check, ChevronDown } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/componentes/ui/button';
import { corDoTexto, corValida, PALETA_PLANILHAS } from '@/lib/cores';
import { cn } from '@/lib/utils';

const COLUNAS = PALETA_PLANILHAS[0]!.length;
const GRADE = PALETA_PLANILHAS.flat();

function Amostra({ cor, nome, marcada, aoEscolher, tabIndex, aoFocar, refCelula }: {
  cor: string;
  nome: string;
  marcada: boolean;
  aoEscolher: (c: string) => void;
  tabIndex?: number;
  aoFocar?: () => void;
  refCelula?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      aria-label={nome}
      aria-pressed={marcada}
      tabIndex={tabIndex}
      ref={refCelula}
      onFocus={aoFocar}
      onClick={() => aoEscolher(cor)}
      className={cn('grid size-6 place-items-center rounded border border-black/10 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tinta', marcada && 'ring-2 ring-tinta ring-offset-1')}
      style={{ backgroundColor: cor, color: corDoTexto(cor) }}
    >
      {marcada && <Check className="size-3.5" aria-hidden />}
    </button>
  );
}

/** Escolha de cor como a do Google Planilhas: grade de cores, as cores dos serviços e uma cor personalizada. */
export function SeletorDeCor({ id, valor, aoMudar }: { id: string; valor: string; aoMudar: (cor: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [erro, setErro] = useState<string | null>(null);
  const atual = valor.toUpperCase();
  // a grade é uma parada só do Tab (a cor marcada, ou a primeira); as setas andam por ela
  const [foco, setFoco] = useState(0);
  const celulas = useRef<(HTMLButtonElement | null)[]>([]);
  const andar = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUNAS, ArrowUp: -COLUNAS }[e.key];
    if (passo === undefined) return;
    e.preventDefault();
    const novo = Math.min(GRADE.length - 1, Math.max(0, foco + passo));
    setFoco(novo);
    celulas.current[novo]?.focus();
  };

  function escolher(cor: string) {
    aoMudar(cor.toUpperCase());
    setTexto(cor.toUpperCase());
    setErro(null);
    setAberto(false);
  }
  function usarPersonalizada() {
    const cor = corValida(texto);
    if (!cor) {
      setErro('Use o formato #RRGGBB.');
      return;
    }
    escolher(cor);
  }

  return (
    <Popover.Root open={aberto} onOpenChange={(v) => { setAberto(v); if (v) { setTexto(valor); setErro(null); setFoco(Math.max(0, GRADE.findIndex((c) => c === atual))); } }}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          aria-label={`Cor: ${atual}`}
          className="relative size-9 shrink-0 rounded-md border border-black/15 shadow-xs"
          style={{ backgroundColor: valor }}
        >
          <ChevronDown className="absolute right-0.5 bottom-0.5 size-3" style={{ color: corDoTexto(valor) }} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 grid gap-3 rounded-lg border border-linha bg-superficie p-3 shadow-lg">
          <div className="grid gap-1" onKeyDown={andar}>
            {PALETA_PLANILHAS.map((linha, i) => (
              <div key={i} className={cn('flex gap-1', i === 1 && 'mt-1.5')}>
                {linha.map((c, k) => {
                  const idx = i * COLUNAS + k;
                  return (
                    <Amostra
                      key={c}
                      cor={c}
                      nome={`Cor ${c}`}
                      marcada={atual === c}
                      aoEscolher={escolher}
                      tabIndex={idx === foco ? 0 : -1}
                      aoFocar={() => setFoco(idx)}
                      refCelula={(el) => { celulas.current[idx] = el; }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="grid gap-1.5 border-t border-linha pt-2">
            <p className="text-xs text-apagado">Cores dos serviços</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(CORES_SERVICO).map(([nome, c]) => <Amostra key={nome} cor={c} nome={`Cor de ${nome}`} marcada={atual === c.toUpperCase()} aoEscolher={escolher} />)}
            </div>
          </div>
          <div className="grid gap-1.5 border-t border-linha pt-2">
            <p className="text-xs text-apagado">Personalizada</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Escolher no seletor do navegador"
                value={corValida(texto) ?? atual}
                onChange={(e) => {
                  // o seletor do navegador aplica a cor na hora, sem fechar o painel
                  const cor = e.target.value.toUpperCase();
                  setTexto(cor);
                  setErro(null);
                  aoMudar(cor);
                }}
                className="h-9 w-10 cursor-pointer rounded-md border border-linha bg-superficie"
              />
              <input
                aria-label="Código da cor"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usarPersonalizada(); } }}
                className="h-9 w-28 rounded-md border border-input bg-superficie px-2.5 font-cond text-base"
              />
              <Button type="button" size="sm" variant="secundario" onClick={usarPersonalizada}>Usar esta cor</Button>
            </div>
            {erro && <p role="alert" className="text-xs text-alerta">{erro}</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
