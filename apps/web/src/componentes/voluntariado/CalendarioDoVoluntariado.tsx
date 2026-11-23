import { mesPorExtenso, somarMeses, type FaixaDeDisponibilidade, type MilitarDoVoluntariado, type VoluntariadoDoMilitar } from 'contratos';
import { diaDaSemana, diasDoMes, type Faixa } from 'dominio';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { mensagemDe } from '@/api/cliente';
import { EtiquetaPendente, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { alternarBloco, copiarDoMes, estadoDoBloco, faixasParaEnviar, fimDeSemana, marcarDias, marcasDoServidor, textoDoRodape, tirarBloco, type Estado, type Marcas } from '@/lib/voluntariado';
import { cn } from '@/lib/utils';
import { useEhCelular } from '@/lib/useEhCelular';
import { CLASSE_DA_TECLA, GuiaComoMarcar } from './GuiaComoMarcar';

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const hh = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}h`;
const minutosDe = (hora: string): number => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
const fmt = (f: { inicio: string; fim: string }) => `${hh(minutosDe(f.inicio))} às ${hh(minutosDe(f.fim))}`;

/**
 * O mês do militar em blocos: cada dia tem uma faixa com os blocos do dia (tirados dos serviços que pedem voluntariado), em largura
 * proporcional à duração. Clicar no bloco marca só ele; no número, marca o dia inteiro; arrastar pelos blocos aplica a ação do primeiro.
 */
export function CalendarioDoVoluntariado({
  militar,
  mes,
  dados,
  aoSalvar,
  focarAoAbrir = false,
  aoAbrir,
  guiaAberto = true,
  aoAbrirGuia,
  aoFecharGuia,
  soLeitura = false,
}: {
  militar: MilitarDoVoluntariado;
  mes: string;
  dados: VoluntariadoDoMilitar;
  /** grava e segue; `soltarPendencia` tira o aviso de alteração pendente antes de navegar */
  aoSalvar: (faixas: FaixaDeDisponibilidade[], soltarPendencia: () => void) => Promise<void>;
  /** veio de "Salvar e ir para o próximo": o foco vai para o dia 1, e o teclado segue de onde parou */
  focarAoAbrir?: boolean;
  aoAbrir?: () => void;
  /** o guia "Como marcar" é da tela (não do militar): fechado, não volta ao passar para o próximo */
  guiaAberto?: boolean;
  aoAbrirGuia?: () => void;
  aoFecharGuia?: () => void;
  /** Unidade só de consulta: o mês se vê e não se marca (sem guia, atalhos, "Limpar" nem "Salvar"). */
  soLeitura?: boolean;
}) {
  const doServidor = marcasDoServidor(dados.faixas);
  const [marcas, setMarcas] = useState<Marcas>(doServidor);
  const assinatura = (c: Marcas) => JSON.stringify(faixasParaEnviar(c));
  const [salvo, setSalvo] = useState(assinatura(doServidor));
  const sujo = assinatura(marcas) !== salvo;
  usePendencia('voluntariado', sujo);
  useSincronizar(JSON.stringify(dados.faixas), sujo, () => {
    setMarcas(doServidor);
    setSalvo(assinatura(doServidor));
  });
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);

  const gravar = travar(async () => {
    setErro(null);
    try {
      await aoSalvar(faixasParaEnviar(marcas), () => flushSync(() => setSalvo(assinatura(marcas))));
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  // arrastar pelos blocos: a ação (marcar ou desmarcar) é a do primeiro bloco e vale até soltar
  const arrasto = useRef<'marcar' | 'desmarcar' | null>(null);
  // tipo do último ponteiro apertado: o toque marca no clique (sem rolagem), não no apertar
  const ponteiro = useRef<string>('mouse');
  const grade = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const soltar = () => (arrasto.current = null);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    return () => {
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
    };
  }, []);
  const dias = diasDoMes(mes);
  const irPara = (dia: string) => grade.current?.querySelector<HTMLElement>(`[data-dia="${dia}"]`)?.focus();
  useEffect(() => {
    if (!focarAoAbrir) return;
    irPara(dias[0]!);
    aoAbrir?.();
    // só ao montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const aoTeclar = (e: React.KeyboardEvent, dia: string) => {
    const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (passo === undefined) return;
    e.preventDefault();
    const destino = dias[dias.indexOf(dia) + passo];
    if (destino) irPara(destino);
  };
  const anterior = somarMeses(mes, -1);
  const brancos = diaDaSemana(dias[0]!);
  const blocos = dados.blocos.map((b) => ({ inicio: minutosDe(b.inicio), fim: minutosDe(b.fim) === 0 ? 1440 : minutosDe(b.fim) }));
  const equipe = militar.jornada === 'adm' ? 'Adm.' : militar.equipe ? `Equipe ${militar.equipe}.` : 'Sem equipe.';
  const aviso = militar.voluntarioJes ? '' : ' Não é voluntário JES: os horários valem só para diárias.';
  const cortes = [...new Set(blocos.flatMap((b) => [b.inicio, b.fim]))].sort((a, b) => a - b);
  const rotuloDoBloco = (dia: number, b: Faixa) => `Dia ${dia}, ${hh(b.inicio)} às ${hh(b.fim === 1440 ? 1440 : b.fim)}`;
  // celular: um dia por linha, só toque (o arrasto não vale: deslizar o dedo rola a página)
  const celular = useEhCelular();

  return (
    <section className="grid content-start gap-4 rounded-xl border border-linha bg-superficie p-4">
      <header className="grid gap-1">
        <h2 className="font-cond text-2xl leading-tight font-semibold">{`${militar.posto} ${militar.nomeGuerra}`}</h2>
        <p className="text-sm text-apagado">{`${equipe}${aviso}`}</p>
        {!soLeitura && <button type="button" onClick={() => aoAbrirGuia?.()} className="justify-self-start rounded text-sm text-vinho underline underline-offset-2">Como marcar</button>}
      </header>

      {guiaAberto && !soLeitura && <GuiaComoMarcar blocos={blocos} celular={celular} aoFechar={() => aoFecharGuia?.()} />}

      {/* só no celular: a régua dos cortes, parada no topo da rolagem, com as mesmas colunas e bordas das linhas dos dias (no computador, o horário aparece ao passar o mouse e no guia) */}
      {celular && (
      <div aria-hidden className="sticky top-0 z-10 grid gap-1 bg-superficie">
        <div className="grid grid-cols-[3.5rem_1fr] gap-2 rounded-md border border-transparent p-1.5">
          <span />
          <div data-rotulos-dos-cortes className="relative h-4 border border-transparent text-xs text-apagado">
            {cortes.map((c, i) => {
              // as pontas ficam na borda da faixa (o último corte é a meia-noite do dia seguinte: "00h"); os do meio, centrados no corte
              const ultimo = i === cortes.length - 1;
              return (
                <span key={c} className={cn('absolute', i > 0 && !ultimo && '-translate-x-1/2')} style={ultimo ? { right: 0 } : { left: `${(c / 1440) * 100}%` }}>{hh(c % 1440)}</span>
              );
            })}
          </div>
        </div>
      </div>
      )}

      <div ref={grade} role="group" aria-label="Calendário do voluntariado" data-disposicao={celular ? 'linhas' : 'calendario'} onKeyDown={soLeitura ? undefined : (e) => { if (e.key === 'Enter') { e.preventDefault(); void gravar(); } }} className={cn(celular ? 'grid gap-2' : 'grid grid-cols-7 gap-2')}>
        {!celular && SEMANA.map((s) => <span key={s} aria-hidden className="text-center text-xs text-apagado">{s}</span>)}
        {!celular && Array.from({ length: brancos }, (_, i) => <span key={`b${i}`} aria-hidden />)}
        {dias.map((d) => {
          const n = Number(d.slice(8));
          const fds = [0, 6].includes(diaDaSemana(d));
          const todos = blocos.map((b) => estadoDoBloco(marcas, d, b));
          const algum = todos.some((e) => e !== 'vazio');
          return (
            <div
              key={d}
              data-linha-do-dia={d}
              className={cn(
                celular ? 'grid grid-cols-[3.5rem_1fr] items-center gap-2 rounded-md border p-1.5' : 'grid gap-1.5 rounded-md border p-1.5',
                fds && 'bg-black/[0.03]',
                algum ? 'border-tinta' : 'border-linha',
              )}
            >

              {soLeitura ? (
                <span data-dia={d} className={cn('justify-self-start font-cond text-base font-semibold', celular ? 'flex h-10 items-center' : 'min-h-7 min-w-8 px-1')}>
                  {n}
                  {celular && <span data-diasemana className="ml-1 text-xs font-normal text-apagado">{SEMANA[diaDaSemana(d)]}</span>}
                </span>
              ) : (
              <button
                type="button"
                data-dia={d}
                aria-label={`Dia ${n}: ${todos.every((e) => e === 'cheio') ? 'desmarcar' : 'marcar'} o dia inteiro`}
                title={`${todos.every((e) => e === 'cheio') ? 'Desmarcar' : 'Marcar'} o dia inteiro`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  ponteiro.current = e.pointerType;
                  arrasto.current = null;
                  if (e.pointerType !== 'mouse') return;
                  const acao = todos.every((x) => x === 'cheio') ? 'desmarcar' : 'marcar';
                  arrasto.current = acao;
                  setMarcas((m) => marcarOuTirar(m, d, blocos, acao));
                }}
                onPointerEnter={(ev) => {
                  const acao = arrasto.current;
                  if (acao && ev.pointerType === 'mouse') setMarcas((m) => marcarOuTirar(m, d, blocos, acao));
                }}
                // o clique do mouse já foi tratado ao apertar; o do toque, do teclado e dos leitores de tela marca aqui
                onClick={(e) => (e.detail === 0 || ponteiro.current !== 'mouse') && setMarcas((m) => marcarOuTirar(m, d, blocos, todos.every((x) => x === 'cheio') ? 'desmarcar' : 'marcar'))}
                onKeyDown={(e) => aoTeclar(e, d)}
                className={cn(
                  // uma tecla: igual em qualquer estado do dia; ao apertar "afunda"
                  CLASSE_DA_TECLA,
                  'justify-self-start hover:border-apagado hover:bg-accent active:translate-y-px active:shadow-none',
                  celular ? 'h-10' : 'min-h-7 min-w-8',
                )}
              >
                {n}
                {celular && <span data-diasemana className="ml-1 text-xs font-normal text-apagado">{SEMANA[diaDaSemana(d)]}</span>}
              </button>
              )}
              <div className="flex h-7 rounded border border-linha" style={{ touchAction: 'manipulation' }}>
                {blocos.map((b, k) => {
                  const e = todos[k]!;
                  if (soLeitura) {
                    // só para ver: o mesmo desenho do bloco, sem botão; o estado vai no nome (a cor sozinha não diz nada ao leitor de tela)
                    const estado = e === 'cheio' ? 'marcado' : e === 'parcial' ? 'marcado em parte' : 'não marcado';
                    return (
                      <div
                        key={k}
                        role="img"
                        aria-label={`${rotuloDoBloco(n, b)}: ${estado}`}
                        title={`${hh(b.inicio)} às ${hh(b.fim)}`}
                        data-estado={e}
                        style={{ flex: b.fim - b.inicio }}
                        className={cn(
                          'min-w-0 border-r border-linha first:rounded-l last:rounded-r last:border-r-0',
                          e === 'cheio' && 'bg-vinho',
                          e === 'parcial' && 'bg-[repeating-linear-gradient(135deg,var(--color-vinho)_0_4px,#fff_4px_8px)]',
                          e === 'vazio' && 'bg-superficie',
                        )}
                      />
                    );
                  }
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-label={rotuloDoBloco(n, b)}
                      aria-pressed={e === 'cheio' ? true : e === 'parcial' ? 'mixed' : false}
                      title={`${hh(b.inicio)} às ${hh(b.fim)}`}
                      data-estado={e}
                      onPointerDown={(ev) => {
                        if (ev.button !== 0) return;
                        ponteiro.current = ev.pointerType;
                        arrasto.current = null;
                        // no toque, a marcação vem no clique (se o dedo rolar a página, nada é marcado)
                        if (ev.pointerType !== 'mouse') return;
                        const acao: 'marcar' | 'desmarcar' = e === 'cheio' ? 'desmarcar' : 'marcar';
                        arrasto.current = acao;
                        setMarcas((m) => alternarSe(m, d, b, acao));
                      }}
                      onPointerEnter={(ev) => {
                        const acao = arrasto.current;
                        if (acao && ev.pointerType === 'mouse') setMarcas((m) => alternarSe(m, d, b, acao));
                      }}
                      onClick={(ev) => (ev.detail === 0 || ponteiro.current !== 'mouse') && setMarcas((m) => alternarBloco(m, d, b))}
                      onKeyDown={(ev) => aoTeclar(ev, d)}
                      style={{ flex: b.fim - b.inicio }}
                      className={cn(
                        'group relative min-w-0 border-r border-linha first:rounded-l last:rounded-r last:border-r-0',
                        e === 'cheio' && 'bg-vinho',
                        e === 'parcial' && 'bg-[repeating-linear-gradient(135deg,var(--color-vinho)_0_4px,#fff_4px_8px)]',
                        e === 'vazio' && 'bg-superficie',
                        'hover:brightness-95 focus-visible:z-10',
                      )}
                    >
                      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 rounded bg-tinta px-1.5 py-0.5 text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block">
                        {`${hh(b.inicio)} às ${hh(b.fim)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!soLeitura && (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setMarcas((m) => marcarDias(m, fimDeSemana(mes)))}>Todos os sábados e domingos</Button>
        {dados.folgas && militar.equipe && (
          <Button type="button" size="sm" variant="outline" onClick={() => setMarcas((m) => marcarDias(m, dados.folgas!))}>{`Dias de folga da equipe ${militar.equipe}`}</Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={dados.doMesAnterior.length === 0} onClick={() => setMarcas(copiarDoMes(dados.doMesAnterior, mes))}>
          {`Copiar de ${mesPorExtenso(anterior)}`}
        </Button>
      </div>
      )}
      {/* no celular o resumo e o Salvar ficam numa barra fixa embaixo: o botão não fica depois das 31 linhas */}
      <div data-barra-de-salvar className={cn('grid gap-2', celular && 'sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-linha bg-superficie px-4 py-3')}>
        <p className="text-sm break-words text-apagado">{textoDoRodape(marcas)}</p>
        {!soLeitura && (
          <>
            {!celular && <p className="text-xs text-apagado">Atalhos de teclado: setas movem, espaço marca, Enter salva e passa ao próximo.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setMarcas(new Map())} disabled={salvando}>Limpar</Button>
              <Button type="button" onClick={() => void gravar()} disabled={salvando}>{celular ? 'Salvar' : 'Salvar e ir para o próximo'}</Button>
              <EtiquetaPendente sujo={sujo} />
            </div>
            {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          </>
        )}
      </div>
    </section>
  );
}

/** Marca ou desmarca o dia inteiro (o número): todos os blocos com a mesma ação. */
function marcarOuTirar(m: Marcas, dia: string, blocos: Faixa[], acao: 'marcar' | 'desmarcar'): Marcas {
  let atual = m;
  for (const b of blocos) atual = alternarSe(atual, dia, b, acao);
  return atual;
}

/** Aplica uma ação a um bloco (marcar ou desmarcar), sem inverter o que já está como a ação pede; desmarcar um bloco parcial tira o pedaço. */
function alternarSe(m: Marcas, dia: string, b: Faixa, acao: 'marcar' | 'desmarcar'): Marcas {
  const estado: Estado = estadoDoBloco(m, dia, b);
  if (acao === 'desmarcar') return estado === 'vazio' ? m : tirarBloco(m, dia, b);
  return estado === 'cheio' ? m : alternarBloco(m, dia, b);
}
