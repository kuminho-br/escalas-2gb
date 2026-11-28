import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { UnidadeDeTrabalho } from 'contratos';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { No } from '@/lib/arvore-de-unidades';
import { degrausDoCaminho, proximoNivel } from '@/lib/degraus';
import { cn } from '@/lib/utils';

export type Acesso = 'trabalho' | 'consulta';

const DEGRAU = 'flex h-8 items-center gap-1 rounded-controle border border-linha pr-1.5 pl-2.5 font-cond text-corpo font-medium whitespace-nowrap text-apagado hover:bg-fundo hover:text-tinta';

/**
 * A unidade de trabalho em degraus (6.61): um botão por nível do caminho, separados por "›". Cada degrau abre só as unidades de dentro do degrau de cima; escolhida uma, o
 * próximo nível abre sozinho, até a pessoa parar numa unidade sua ou chegar à folha. Um nível com uma opção só é texto, ou um botão que escolhe essa unidade quando a pessoa tem acesso a ela (6.73). A "passagem" (a unidade acima das da pessoa, que só serve
 * para descer) nunca vira a unidade de trabalho: parado nela, o próximo degrau é obrigatório, e fechar ali volta à unidade de antes. No celular só a unidade atual cabe: tocar
 * nela abre os degraus num painel, um embaixo do outro.
 *
 * `aoEscolher` guarda a unidade e leva à lista da tela (a escolha de sempre do Topo); devolve false se a pessoa desistiu (alteração pendente), e aí nada muda.
 */
export function DegrausDaUnidade({ arvore, unidade, soConsulta, acessoDe, aoEscolher, todasAsUnidades }: { arvore: No[]; unidade: UnidadeDeTrabalho; soConsulta: boolean; acessoDe: (id: string) => Acesso | undefined; aoEscolher: (id: string, soConsulta: boolean) => boolean; /** o botão da árvore inteira (6.73): fica no fim dos degraus e, no celular, dentro do painel */ todasAsUnidades?: ReactNode }) {
  const base = degrausDoCaminho(arvore, unidade.id).map((d) => d.no);
  // o caminho a meio, enquanto a pessoa desce (pode terminar numa passagem); fora disso vale o da unidade de trabalho
  const [parcial, setParcial] = useState<No[] | null>(null);
  const [aberto, setAberto] = useState(-1);
  const [painel, setPainel] = useState(false);
  const [aviso, setAviso] = useState('');
  const [foco, setFoco] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  // o foco volta ao botão da unidade (celular) quando quem fechou estava no painel
  const focoNoGatilho = useRef(false);
  const caminho = parcial ?? base;
  // antes de a lista da corporação chegar, a árvore começa na unidade mais alta da pessoa: os níveis de cima vêm do caminho da unidade, só para leitura
  const cima = unidade.caminho.length - base.length;
  const acima = !parcial && cima > 0 && base.every((no, k) => unidade.caminho[cima + k] === no.sigla) ? unidade.caminho.slice(0, cima) : [];
  const ultimo = caminho.at(-1);
  const proximo = ultimo ? proximoNivel(ultimo) : null;
  const opcoesDe = (i: number): No[] => (i === 0 ? arvore : (caminho[i - 1]?.filhos ?? []));

  // a unidade de trabalho mudou (a escolha chegou ao site): o caminho a meio passa a ser o da unidade
  useEffect(() => setParcial(null), [unidade.id]);
  // ao abrir uma lista, o foco vai à unidade marcada (ou à primeira)
  useEffect(() => {
    if (aberto < 0) return;
    const lista = navRef.current?.querySelector('[role="listbox"]');
    (lista?.querySelector<HTMLElement>('[aria-selected="true"]') ?? lista?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }, [aberto, caminho.length]);
  // fechar devolve o foco: ao último degrau (ao botão do celular, se o painel estava aberto)
  useEffect(() => {
    if (!foco) return;
    const degraus = navRef.current?.querySelectorAll<HTMLElement>('[data-degrau]') ?? [];
    (focoNoGatilho.current ? gatilho.current : degraus[degraus.length - 1])?.focus();
    // só quando pede: o painel que abriu não mexe no foco
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco]);

  function fechar() {
    // fechou no meio do caminho, numa passagem: volta à unidade de trabalho de antes
    if (parcial && ultimo && !acessoDe(ultimo.id)) setParcial(null);
    focoNoGatilho.current = painel;
    setAberto(-1);
    setFoco((f) => f + 1);
    setPainel(false);
  }

  useEffect(() => {
    if (aberto < 0 && !painel) return;
    const fora = (e: Event) => {
      if (navRef.current && !navRef.current.contains(e.target as Node) && !gatilho.current?.contains(e.target as Node)) {
        if (parcial && ultimo && !acessoDe(ultimo.id)) setParcial(null);
        setAberto(-1);
        setPainel(false);
      }
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  });

  function escolherOpcao(i: number, n: No) {
    const acesso = acessoDe(n.id);
    const novo = [...caminho.slice(0, i), n];
    if (acesso && !(n.id === unidade.id && (acesso === 'consulta') === soConsulta)) {
      if (!aoEscolher(n.id, acesso === 'consulta')) {
        // a pessoa desistiu (alteração pendente): a unidade e os degraus ficam como estavam
        focoNoGatilho.current = painel;
        setParcial(null);
        setAberto(-1);
        setPainel(false);
        setFoco((f) => f + 1);
        return;
      }
      setAviso(`Unidade de trabalho: ${n.caminho.join(' / ')}${acesso === 'consulta' ? ', só consulta' : ''}`);
    }
    setParcial(novo);
    // escolheu e tem mais abaixo: o próximo nível abre sozinho
    if (n.filhos.length) setAberto(novo.length);
    else {
      focoNoGatilho.current = painel;
      setAberto(-1);
      setPainel(false);
      setFoco((f) => f + 1);
    }
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && (aberto >= 0 || painel)) {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const opcoes = [...(navRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const k = opcoes.indexOf(document.activeElement as HTMLElement);
    if (k < 0) return;
    e.preventDefault();
    opcoes[(k + (e.key === 'ArrowDown' ? 1 : opcoes.length - 1)) % opcoes.length]!.focus();
  }

  const lista = (i: number) => {
    const de = i === 0 ? null : caminho[i - 1]!.sigla;
    return (
      <div
        role="listbox"
        aria-label={de ? `Unidades dentro de ${de}` : 'Corporação'}
        className="absolute top-full left-0 z-30 mt-1.5 grid max-w-85 min-w-72 gap-0.5 rounded-lg border border-linha bg-superficie p-1.5 font-sans shadow-lg md:max-h-[min(26rem,calc(100dvh-5rem))] md:overflow-y-auto max-md:static max-md:mt-1 max-md:w-full max-md:max-w-none max-md:min-w-0 max-md:shadow-none"
      >
        {de && <p className="px-2 pt-1.5 pb-1 text-apoio text-apagado">{`Dentro de ${de}`}</p>}
        {opcoesDe(i).map((n) => {
          const escolhida = caminho[i]?.id === n.id;
          const acesso = acessoDe(n.id);
          return (
            <button
              key={n.id}
              type="button"
              role="option"
              aria-selected={escolhida}
              onClick={() => escolherOpcao(i, n)}
              className="flex w-full items-center gap-2.5 rounded-controle border-l-3 border-transparent p-2 text-left hover:bg-fundo focus-visible:bg-fundo aria-selected:border-vinho"
            >
              <span className="grid min-w-0 flex-1 gap-0.5">
                <b className="font-cond text-corpo leading-none font-semibold text-tinta">{n.sigla}</b>
                {n.nome && <small className="text-apoio leading-tight text-apagado">{n.nome}</small>}
              </span>
              {acesso === 'consulta' && <span className="rounded bg-fundo px-1.5 py-0.5 text-apoio text-apagado">Só consulta</span>}
              {escolhida ? <Check aria-hidden className="size-4 shrink-0 text-tinta" /> : n.filhos.length > 0 ? <ChevronRight aria-hidden className="size-4 shrink-0 text-apagado" /> : null}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <nav ref={navRef} aria-label="Unidade de trabalho" onKeyDown={aoTeclar} className="min-w-0 flex-1 md:relative">
      {/* celular: só a unidade atual; tocar abre os degraus num painel */}
      <button
        ref={gatilho}
        type="button"
        aria-expanded={painel}
        aria-label={`Unidade de trabalho: ${unidade.caminho.join(' / ')}${soConsulta ? ' (só consulta)' : ''}`}
        onClick={() => {
          // fechar o painel pelo botão é fechar de verdade: numa passagem, volta à unidade de antes
          if (painel) fechar();
          else {
            setAberto(-1);
            setPainel(true);
          }
        }}
        className="flex max-w-full items-center gap-1.5 rounded-controle border border-encaixe px-2.5 py-1.5 font-cond text-corpo font-semibold text-tinta md:hidden"
      >
        <span aria-hidden className="truncate">{unidade.sigla}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-apagado" />
      </button>
      <ol
        className={cn(
          'flex items-center gap-1 font-cond text-corpo',
          painel
            ? 'max-md:absolute max-md:inset-x-0 max-md:top-full max-md:z-30 max-md:flex-col max-md:items-stretch max-md:gap-1.5 max-md:max-h-[70dvh] max-md:overflow-y-auto max-md:border-b max-md:border-linha max-md:bg-superficie max-md:p-3 max-md:shadow-lg'
            : 'max-md:hidden',
        )}
      >
        {acima.map((sigla, k) => (
          <li key={`acima-${k}`} className="flex items-center gap-1">
            {k > 0 && <span aria-hidden className="px-px text-encaixe max-md:hidden">›</span>}
            <span className="px-1 text-apagado max-md:text-apoio">{sigla}</span>
          </li>
        ))}
        {caminho.map((n, i) => {
          const opcoes = opcoesDe(i);
          const folha = i === caminho.length - 1;
          return (
            <li key={n.id} className={cn('relative flex items-center gap-1 max-md:flex-wrap', i + acima.length > 0 && '')}>
              {i + acima.length > 0 && <span aria-hidden className="px-px text-encaixe max-md:hidden">›</span>}
              {opcoes.length > 1 ? (
                <button
                  type="button"
                  data-degrau={i}
                  aria-expanded={aberto === i}
                  aria-haspopup="listbox"
                  aria-current={folha ? 'location' : undefined}
                  onClick={() => (aberto === i ? fechar() : setAberto(i))}
                  className={cn(DEGRAU, folha && 'border-encaixe font-semibold text-tinta', aberto === i && 'bg-fundo text-tinta')}
                >
                  <span>{n.sigla}</span>
                  <ChevronDown aria-hidden className="size-3.5" />
                </button>
              ) : acessoDe(n.id) && (n.id !== unidade.id || n.filhos.length > 0) ? (
                // 6.73: o nível de uma opção só (CBMPE, DGO) é um botão quando a pessoa tem acesso a ele: faz dele a unidade de trabalho e abre o nível de baixo
                <button
                  type="button"
                  data-degrau={i}
                  aria-current={folha ? 'location' : undefined}
                  onClick={() => escolherOpcao(i, n)}
                  className={cn(DEGRAU, 'pr-2.5', folha && 'border-encaixe font-semibold text-tinta')}
                >
                  {n.sigla}
                </button>
              ) : (
                <span aria-current={folha ? 'location' : undefined} className={cn('px-1 text-apagado max-md:text-apoio', folha && 'font-semibold text-tinta')}>{n.sigla}</span>
              )}
              {aberto === i && lista(i)}
            </li>
          );
        })}
        {proximo && (
          <li className="relative flex items-center gap-1 max-md:flex-wrap">
            <span aria-hidden className="px-px text-encaixe max-md:hidden">›</span>
            <button
              type="button"
              data-degrau={caminho.length}
              aria-expanded={aberto === caminho.length}
              aria-haspopup="listbox"
              onClick={() => (aberto === caminho.length ? fechar() : setAberto(caminho.length))}
              className={cn(DEGRAU, 'border-dashed', proximo.obrigatorio && 'border-vinho text-vinho hover:text-vinho')}
            >
              <span>{proximo.obrigatorio ? `Escolha: ${proximo.rotulo.toLocaleLowerCase('pt-BR')}` : proximo.rotulo}</span>
              <ChevronDown aria-hidden className="size-3.5" />
            </button>
            {aberto === caminho.length && lista(caminho.length)}
          </li>
        )}
        {todasAsUnidades && <li data-todas-as-unidades className="flex items-center max-md:mt-1">{todasAsUnidades}</li>}
      </ol>
      <p role="status" className="sr-only">{aviso}</p>
    </nav>
  );
}
