import { Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { acimaDe, montarArvore, nomeDoNo, textoDoNo, todosOsNos, type No, type UnidadeDaArvore } from '@/lib/arvore-de-unidades';
import { normalizarBusca } from '@/lib/texto';
import { cn } from '@/lib/utils';

/** A árvore ganha a busca por sigla quando passa deste tamanho. */
const BUSCA_A_PARTIR_DE = 15;
const CHAVE_ABERTA_TODA = 'arvore:aberta-toda';

// a última escolha de "Abrir tudo" fica lembrada no navegador; se ele recusa guardar (modo privado, dados bloqueados), a árvore funciona do mesmo jeito
function lembraAbertaToda(): boolean {
  try {
    return localStorage.getItem(CHAVE_ABERTA_TODA) === '1';
  } catch {
    return false;
  }
}
function guardarAbertaToda(aberta: boolean) {
  try {
    if (aberta) localStorage.setItem(CHAVE_ABERTA_TODA, '1');
    else localStorage.removeItem(CHAVE_ABERTA_TODA);
  } catch {
    // sem lembrar: vale só enquanto a caixa está aberta
  }
}

/**
 * O que vem aberto: o caminho até a unidade escolhida, as passagens (elas só existem para dar lugar ao que a pessoa pode escolher, então o que é
 * escolhível fica à vista) e, quando a árvore tem um alto só, o primeiro nível dele.
 */
function abertosDeInicio(arvores: No[][], valor: string): Set<string> {
  const abertos = new Set<string>();
  for (const nos of arvores) {
    for (const id of acimaDe(nos, valor)) abertos.add(id);
    for (const n of todosOsNos(nos)) if (n.passagem) abertos.add(n.id);
    if (nos.length === 1) abertos.add(nos[0]!.id);
  }
  return abertos;
}

/** Só os nós cuja sigla bate com a busca, cada um com o caminho dele (as de cima entram para dizer onde ele fica). */
function filtrar(nos: No[], busca: string): No[] {
  return nos.flatMap((n) => {
    const filhos = filtrar(n.filhos, busca);
    return normalizarBusca(n.sigla).includes(busca) || filhos.length > 0 ? [{ ...n, filhos }] : [];
  });
}

export interface GrupoDaArvore {
  /** O nome da árvore para o leitor de tela (e o título à vista, quando há `titulo`). */
  rotulo: string;
  titulo?: string;
  nos: No[];
  aoEscolher: (id: string) => void;
}

/**
 * O painel de escolha: uma ou mais árvores de unidades que abrem nó a nó, com "Abrir tudo" / "Fechar tudo" no alto e a busca por sigla nas árvores
 * grandes. O teclado segue o padrão de árvore: as setas para cima e para baixo andam entre os nós à vista, a direita abre, a esquerda fecha ou sobe
 * à mãe, e o Enter escolhe. A passagem (a unidade que só dá lugar às de baixo) aparece apagada e não é escolhível.
 */
export function PainelDaArvore({ grupos, valor, aoLimpar }: { grupos: GrupoDaArvore[]; valor: string; aoLimpar?: () => void }) {
  const arvores = grupos.map((g) => g.nos);
  const todos = arvores.flatMap(todosOsNos);
  const [abertaToda, setAbertaToda] = useState(lembraAbertaToda);
  const [abertos, setAbertos] = useState(() => (abertaToda ? new Set(todos.map((n) => n.id)) : abertosDeInicio(arvores, valor)));
  const [busca, setBusca] = useState('');
  const buscada = normalizarBusca(busca);
  const temOQueAbrir = todos.some((n) => n.filhos.length > 0);

  const alternarTudo = () => {
    const abrir = !abertaToda;
    setAbertaToda(abrir);
    guardarAbertaToda(abrir);
    setAbertos(abrir ? new Set(todos.map((n) => n.id)) : abertosDeInicio(arvores, valor));
  };
  const alternar = (id: string, abrir?: boolean) =>
    setAbertos((antes) => {
      const depois = new Set(antes);
      if (abrir ?? !antes.has(id)) depois.add(id);
      else depois.delete(id);
      return depois;
    });

  const filtrados = grupos.map((g) => ({ ...g, nos: buscada ? filtrar(g.nos, buscada) : g.nos }));
  const nada = buscada !== '' && filtrados.every((g) => g.nos.length === 0);

  return (
    <div className="flex max-h-[inherit] min-h-0 flex-col">
      {(todos.length > BUSCA_A_PARTIR_DE || temOQueAbrir || aoLimpar) && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-linha p-2">
          {todos.length > BUSCA_A_PARTIR_DE && (
            <Input type="search" aria-label="Buscar unidade" placeholder="Buscar unidade" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-8 min-w-0 flex-[1_1_8rem]" autoComplete="off" />
          )}
          {temOQueAbrir && (
            <Button type="button" variant="discreto" size="sm" onClick={alternarTudo} disabled={buscada !== ''}>
              {abertaToda ? <ChevronsDownUp aria-hidden /> : <ChevronsUpDown aria-hidden />}
              {abertaToda ? 'Fechar tudo' : 'Abrir tudo'}
            </Button>
          )}
          {aoLimpar && <Button type="button" variant="discreto" size="sm" className="ml-auto" onClick={aoLimpar}>Limpar</Button>}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1">
        {filtrados.map((g, i) => (
          <div key={g.rotulo} className={cn(i > 0 && 'mt-1 border-t border-linha pt-1')}>
            {g.titulo && <p className="px-2.5 pt-1.5 pb-1 font-cond text-apoio font-medium text-apagado">{g.titulo}</p>}
            {/* com a busca, tudo o que sobrou vem aberto: cada achada aparece com o caminho dela */}
            <Arvore rotulo={g.rotulo} nos={g.nos} valor={valor} abertos={buscada ? null : abertos} aoAlternar={alternar} aoEscolher={g.aoEscolher} />
          </div>
        ))}
        {nada && <p className="px-2.5 py-2 text-apoio text-apagado">Nenhuma unidade com essa sigla.</p>}
      </div>
    </div>
  );
}

/** Uma árvore (`role="tree"`): o foco anda de nó em nó (um só nó entra na ordem do Tab). `abertos` nulo quer dizer tudo aberto. */
function Arvore({ rotulo, nos, valor, abertos, aoAlternar, aoEscolher }: { rotulo: string; nos: No[]; valor: string; abertos: Set<string> | null; aoAlternar: (id: string, abrir?: boolean) => void; aoEscolher: (id: string) => void }) {
  const lista = useRef<HTMLUListElement>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const aberto = (n: No) => n.filhos.length > 0 && (abertos === null || abertos.has(n.id));
  // os nós à vista, na ordem em que aparecem: é por eles que as setas andam
  const aVista = useMemo(() => {
    const andar = (lista: No[]): No[] => lista.flatMap((n) => [n, ...(n.filhos.length > 0 && (abertos === null || abertos.has(n.id)) ? andar(n.filhos) : [])]);
    return andar(nos);
  }, [nos, abertos]);
  // o nó que o Tab alcança: o que tem o foco, senão a unidade escolhida, senão o primeiro
  const doTab = aVista.find((n) => n.id === foco)?.id ?? aVista.find((n) => n.id === valor)?.id ?? aVista[0]?.id;
  const focar = (id: string | undefined) => {
    if (!id) return;
    setFoco(id);
    lista.current?.querySelector<HTMLElement>(`[data-no="${CSS.escape(id)}"]`)?.focus();
  };
  const escolher = (n: No) => {
    if (!n.passagem) aoEscolher(n.id);
  };

  function aoTeclar(e: KeyboardEvent<HTMLUListElement>) {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')?.dataset.no;
    const i = aVista.findIndex((n) => n.id === id);
    const n = aVista[i];
    if (!n) return;
    const tecla = e.key;
    if (tecla === 'ArrowDown') focar(aVista[i + 1]?.id);
    else if (tecla === 'ArrowUp') focar(aVista[i - 1]?.id);
    else if (tecla === 'Home') focar(aVista[0]?.id);
    else if (tecla === 'End') focar(aVista.at(-1)?.id);
    else if (tecla === 'ArrowRight') {
      if (n.filhos.length === 0) return;
      if (aberto(n)) focar(n.filhos[0]!.id);
      else aoAlternar(n.id, true);
    } else if (tecla === 'ArrowLeft') {
      if (aberto(n) && abertos !== null) aoAlternar(n.id, false);
      else focar(aVista.slice(0, i).reverse().find((x) => x.nivel === n.nivel - 1)?.id);
    } else if (tecla === 'Enter' || tecla === ' ') escolher(n);
    else return;
    // a tecla foi usada pela árvore: não rola a página nem envia o formulário em volta
    e.preventDefault();
    e.stopPropagation();
  }

  const desenhar = (n: No) => {
    const temFilhos = n.filhos.length > 0;
    const estaAberto = aberto(n);
    const escolhido = n.id === valor;
    return (
      <li
        key={n.id}
        role="treeitem"
        data-no={n.id}
        aria-label={nomeDoNo(n)}
        aria-level={n.nivel + 1}
        aria-expanded={temFilhos ? estaAberto : undefined}
        aria-selected={escolhido}
        aria-disabled={n.passagem || undefined}
        tabIndex={n.id === doTab ? 0 : -1}
        onFocus={(e) => { if (e.target === e.currentTarget) setFoco(n.id); }}
        // o clique é do nó mais de dentro: não sobe para a mãe, que tem o mesmo tratamento
        onClick={(e) => { e.stopPropagation(); escolher(n); }}
        className="group/no rounded-sm outline-none"
      >
        <div
          style={{ paddingLeft: `${0.25 + n.nivel * 1}rem` }}
          className={cn(
            'flex min-h-9 items-center gap-1 rounded-sm pr-2.5 text-corpo select-none group-focus-visible/no:outline-2 group-focus-visible/no:-outline-offset-2 group-focus-visible/no:outline-tinta',
            n.passagem ? 'text-apagado' : 'cursor-pointer text-tinta hover:bg-passa',
            escolhido && 'bg-passa font-semibold',
          )}
        >
          {temFilhos ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={`${estaAberto ? 'Fechar' : 'Abrir'} ${n.sigla}`}
              disabled={abertos === null}
              onClick={(e) => { e.stopPropagation(); aoAlternar(n.id); }}
              className="grid size-7 shrink-0 place-items-center rounded-sm text-apagado hover:bg-tinta/8 hover:text-tinta disabled:pointer-events-none"
            >
              <ChevronRight aria-hidden className={cn('size-4 transition-transform motion-reduce:transition-none', estaAberto && 'rotate-90')} />
            </button>
          ) : (
            <span aria-hidden className="size-7 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">{n.sigla}</span>
          {escolhido && <Check aria-hidden className="size-4 shrink-0 text-vinho" />}
        </div>
        {temFilhos && estaAberto && <ul role="group">{n.filhos.map(desenhar)}</ul>}
      </li>
    );
  };

  if (nos.length === 0) return null;
  return (
    <ul ref={lista} role="tree" aria-label={rotulo} onKeyDown={aoTeclar}>
      {nos.map(desenhar)}
    </ul>
  );
}

/** As classes da caixa flutuante da árvore: cabe na tela do celular, rola por dentro e nunca de lado. */
export const classeDaCaixaDaArvore =
  'z-50 w-[min(20rem,calc(100vw-2rem))] max-h-[min(26rem,var(--radix-popover-content-available-height))] overflow-hidden rounded-controle border border-linha bg-superficie text-tinta shadow-por-cima';

/** Ao abrir, o foco vai para a unidade escolhida (ou a primeira), e não para o primeiro botão da caixa. */
export function focarNaArvore(e: Event) {
  const no = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]');
  if (!no) return;
  e.preventDefault();
  no.focus();
}

/**
 * O campo de escolher uma unidade (6.45): um botão com a unidade escolhida que abre a árvore. `unidades` são as que a pessoa pode escolher; `todas`, a
 * árvore inteira, que dá lugar às permitidas (as de cima entram como passagem). Com `permiteLimpar`, serve de filtro: sem unidade, mostra `textoVazio`.
 */
export function EscolherUnidade({
  id, rotulo, unidades, todas, valor, aoEscolher, permiteLimpar = false, textoVazio = 'Escolha a unidade', textoDoValor, disabled, className, ...resto
}: {
  id?: string;
  /** O nome do campo para o leitor de tela (o mesmo do rótulo à vista). */
  rotulo: string;
  unidades: UnidadeDaArvore[];
  todas?: UnidadeDaArvore[];
  /** O id da unidade escolhida; vazio quando não há. */
  valor: string;
  aoEscolher: (id: string) => void;
  permiteLimpar?: boolean;
  textoVazio?: string;
  /** O texto da unidade escolhida enquanto a lista não chega (ou quando ela não está na lista). */
  textoDoValor?: string;
  disabled?: boolean;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const nos = useMemo(() => montarArvore(unidades, todas), [unidades, todas]);
  const escolhido = useMemo(() => (valor ? todosOsNos(nos).find((n) => n.id === valor) : undefined), [nos, valor]);
  const texto = escolhido ? textoDoNo(escolhido) : valor && textoDoValor ? textoDoValor : textoVazio;
  const escolher = (novo: string) => {
    aoEscolher(novo);
    setAberto(false);
  };
  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger asChild>
        <button
          {...resto}
          id={id}
          type="button"
          disabled={disabled}
          aria-label={`${rotulo}: ${texto}`}
          className={cn(
            'flex h-(--altura-controle) w-full min-w-0 items-center gap-2 rounded-controle border border-encaixe bg-superficie px-3 text-left text-corpo transition-colors hover:border-tinta disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2 aria-invalid:border-alerta',
            className,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', !escolhido && !(valor && textoDoValor) && 'text-apagado')}>
            {escolhido && escolhido.caminho.length > 1 && <span className="text-apagado">{`${escolhido.caminho.at(-2)} / `}</span>}
            {escolhido ? escolhido.sigla : texto}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-apagado" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={16} className={classeDaCaixaDaArvore} onOpenAutoFocus={focarNaArvore}>
          <PainelDaArvore grupos={[{ rotulo, nos, aoEscolher: escolher }]} valor={valor} aoLimpar={permiteLimpar && valor ? () => escolher('') : undefined} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
