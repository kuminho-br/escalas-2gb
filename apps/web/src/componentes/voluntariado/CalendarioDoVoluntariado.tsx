import { mesPorExtenso, somarMeses, type MilitarDoVoluntariado, type VoluntariadoDoMilitar } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { mensagemDe } from '@/api/cliente';
import { EtiquetaPendente, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { acaoDoDia, aplicarAoDia, conjuntoDeMarcas, copiarDoMes, fimDeSemana, marcarDias, marcasDoConjunto, serializar, textoDoRodape, type Marcas } from '@/lib/voluntariado';
import { cn } from '@/lib/utils';

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** O mês do militar: um quadro por dia com o número (marca os dois turnos) e os botões A e B. */
export function CalendarioDoVoluntariado({
  militar,
  mes,
  dados,
  aoSalvar,
}: {
  militar: MilitarDoVoluntariado;
  mes: string;
  dados: VoluntariadoDoMilitar;
  /** grava e segue; `soltarPendencia` tira o aviso de alteração pendente antes de navegar */
  aoSalvar: (marcas: ReturnType<typeof marcasDoConjunto>, soltarPendencia: () => void) => Promise<void>;
}) {
  const doServidor = conjuntoDeMarcas(dados.marcas);
  const [marcas, setMarcas] = useState<Marcas>(doServidor);
  const [salvo, setSalvo] = useState(serializar(doServidor));
  const sujo = serializar(marcas) !== salvo;
  usePendencia('voluntariado', sujo);
  useSincronizar(serializar(doServidor), sujo, () => {
    setMarcas(doServidor);
    setSalvo(serializar(doServidor));
  });
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);

  const gravar = travar(async () => {
    setErro(null);
    try {
      await aoSalvar(marcasDoConjunto(marcas), () => flushSync(() => setSalvo(serializar(marcas))));
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  // arrastar pelos números: a ação (marcar ou desmarcar) é a do primeiro dia e vale até soltar
  const arrasto = useRef<'marcar' | 'desmarcar' | null>(null);
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
  const aoTeclar = (e: React.KeyboardEvent, dia: string) => {
    const passo = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (passo === undefined) return;
    e.preventDefault();
    const destino = dias[dias.indexOf(dia) + passo];
    if (destino) irPara(destino);
  };
  const anterior = somarMeses(mes, -1);
  const brancos = diaDaSemana(dias[0]!);
  const alternarTurno = (dia: string, t: 'A' | 'B') => {
    const novo = new Set(marcas);
    if (!novo.delete(`${dia}|${t}`)) novo.add(`${dia}|${t}`);
    setMarcas(novo);
  };
  const equipe = militar.jornada === 'adm' ? 'Adm.' : militar.equipe ? `Equipe ${militar.equipe}.` : 'Sem equipe.';
  const aviso = militar.voluntarioJes ? '' : ' Não é voluntário JES: as marcações valem só para diárias.';

  return (
    <section className="grid content-start gap-4 rounded-xl border border-linha bg-superficie p-4">
      <header className="grid gap-1">
        <h2 className="font-cond text-2xl leading-tight font-semibold">{`${militar.posto} ${militar.nomeGuerra}`}</h2>
        <p className="text-sm text-apagado">{`${equipe}${aviso}`}</p>
      </header>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded border border-linha px-2 py-0.5">A 08h às 20h</span>
        <span className="rounded border border-linha px-2 py-0.5">B 20h às 08h</span>
      </p>
      <div
        ref={grade}
        role="group"
        aria-label="Calendário do voluntariado"
        onKeyDown={(e) => {
          // Enter em qualquer ponto do calendário salva e passa ao próximo (e não aciona o botão em foco)
          if (e.key !== 'Enter') return;
          e.preventDefault();
          void gravar();
        }}
        className="grid grid-cols-7 gap-2"
      >
        {SEMANA.map((s) => <span key={s} aria-hidden className="text-center text-xs text-apagado">{s}</span>)}
        {Array.from({ length: brancos }, (_, i) => <span key={`b${i}`} aria-hidden />)}
        {dias.map((d) => {
          const n = Number(d.slice(8));
          const a = marcas.has(`${d}|A`);
          const b = marcas.has(`${d}|B`);
          const fds = [0, 6].includes(diaDaSemana(d));
          return (
            <div key={d} className={cn('grid gap-1.5 rounded-md border p-1.5', fds && 'bg-black/[0.03]', a || b ? 'border-tinta' : 'border-linha')}>
              <button
                type="button"
                data-dia={d}
                aria-label={`Dia ${n}: ${a && b ? 'desmarcar' : 'marcar'} os dois turnos`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                  const acao = acaoDoDia(marcas, d);
                  arrasto.current = acao;
                  setMarcas((m) => aplicarAoDia(m, d, acao));
                }}
                onPointerEnter={() => arrasto.current && setMarcas((m) => aplicarAoDia(m, d, arrasto.current!))}
                // clique do mouse ou do toque já foi tratado ao apertar; o do teclado (e dos leitores de tela) vem sem `detail`
                onClick={(e) => e.detail === 0 && setMarcas((m) => aplicarAoDia(m, d, acaoDoDia(m, d)))}
                onKeyDown={(e) => aoTeclar(e, d)}
                className="rounded text-left font-cond text-base leading-none font-semibold hover:bg-accent"
              >
                {n}
              </button>
              <span className="flex gap-1">
                {(['A', 'B'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={t === 'A' ? a : b}
                    aria-label={`Dia ${n}, turno ${t}`}
                    onClick={() => alternarTurno(d, t)}
                    className={cn('flex-1 rounded border px-1 py-0.5 text-xs font-semibold', (t === 'A' ? a : b) ? 'border-tinta bg-tinta text-white' : 'border-linha text-apagado hover:bg-accent')}
                  >
                    {t}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setMarcas((m) => marcarDias(m, fimDeSemana(mes)))}>Todos os sábados e domingos</Button>
        {dados.folgas && militar.equipe && (
          <Button type="button" size="sm" variant="outline" onClick={() => setMarcas((m) => marcarDias(m, dados.folgas!))}>{`Dias de folga da equipe ${militar.equipe}`}</Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={dados.doMesAnterior.length === 0} onClick={() => setMarcas(copiarDoMes(dados.doMesAnterior, mes))}>
          {`Copiar de ${mesPorExtenso(anterior)}`}
        </Button>
      </div>
      <p className="text-sm text-apagado">{textoDoRodape(marcas)}</p>
      <p className="text-xs text-apagado">Atalhos de teclado: setas movem, espaço marca, Enter salva e passa ao próximo.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setMarcas(new Set())} disabled={salvando}>Limpar</Button>
        <Button type="button" onClick={() => void gravar()} disabled={salvando}>Salvar e ir para o próximo</Button>
        <EtiquetaPendente sujo={sujo} />
      </div>
      {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
    </section>
  );
}
