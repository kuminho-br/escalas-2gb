import { textoHora, type EscalaDosOficiais } from 'contratos';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Turno = EscalaDosOficiais['turnosDoServico'][number];
type Lugar = EscalaDosOficiais['turnos'][number];

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const faixaDoTurno = (t: Turno) => `${textoHora(t.inicio)} às ${textoHora(t.fim)}`;
export const rotuloDoTurnoNaTela = (t: Turno) => `${t.rotulo}, ${faixaDoTurno(t)}`;

const NOME_DO_SERVICO = { jes: 'JES', saldo: 'Saldo' } as const;
/** A cor da faixa da placa quando o cadastro do serviço não a trouxe. */
const COR_PADRAO = { jes: '#6E56A8', saldo: '#2B7BB9' } as const;
const corDoServico = (e: EscalaDosOficiais, s: 'jes' | 'saldo') => e.servicos[s]?.cor ?? COR_PADRAO[s];

interface Props {
  escala: EscalaDosOficiais;
  /** O clique num turno (livre ou com nome): a tela decide se lança, tira ou pergunta. Sem ele (mês encerrado), o calendário é só de leitura. */
  aoClicarTurno?: (t: Lugar) => void;
  /** O clique no número do dia marca ou tira o dia vermelho (só no modo de marcar dias vermelhos). Sem ele, o dia vermelho só aparece marcado. */
  aoMarcarDia?: (dia: string) => void;
  /** O oficial escolhido na lista: os turnos dele ganham um contorno leve. */
  oficialEscolhido?: string | null;
}

/** A legenda: o que cada linha do dia é (Dia em cima, Noite embaixo) e a cor de cada serviço. */
export function LegendaDosTurnos({ turnos, escala }: { turnos: Turno[]; escala?: EscalaDosOficiais }) {
  return (
    <div aria-label="Legenda dos turnos" role="group" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-apoio leading-[18px]">
      {turnos.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1.5">
          <i aria-hidden data-amostra-do-turno={t.rotulo === 'Noite' ? 'noite' : 'dia'} className={cn('inline-block h-[18px] w-6 rounded border border-linha', t.rotulo === 'Noite' ? 'bg-passa' : 'bg-superficie')} />
          {rotuloDoTurnoNaTela(t)}
        </span>
      ))}
      {escala && (['jes', 'saldo'] as const).filter((s) => escala.servicos[s]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <i aria-hidden data-cor-do-servico={s} className="inline-block h-3.5 w-1.5 rounded-sm" style={{ backgroundColor: corDoServico(escala, s) }} />
          {NOME_DO_SERVICO[s]}
        </span>
      ))}
      {escala && (
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden data-amostra-dia-vermelho className="inline-block size-[18px] rounded-sm bg-alerta" />
          Dia vermelho
        </span>
      )}
    </div>
  );
}

/**
 * O número do dia. O dia vermelho (um dia ruim, que ninguém quer tirar) leva o número em branco dentro de um quadrado vermelho (a cor de alerta) e o texto "Dia vermelho"
 * para o leitor de tela. No modo de marcar dias vermelhos, o número é um botão que marca ou tira o dia vermelho; fora dele, é só o número.
 */
function CabecalhoDoDia({ dia, vermelho, aoMarcar }: { dia: string; vermelho: boolean; aoMarcar?: (dia: string) => void }) {
  const dm = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  // o dia vermelho é o número em branco dentro de um quadrado vermelho (a cor de alerta: branco sobre ela tem 6,5:1); o dia comum é só o número
  const numero = (
    <>
      {vermelho ? (
        <b data-quadrado-vermelho className="grid size-7 place-items-center rounded-md bg-alerta font-cond text-corpo leading-none font-semibold text-white">{Number(dia.slice(8))}</b>
      ) : (
        <b className="font-cond text-corpo leading-7 font-semibold">{Number(dia.slice(8))}</b>
      )}
      {vermelho && <span className="sr-only">Dia vermelho</span>}
    </>
  );
  return (
    <div className="flex items-center gap-2">
      {aoMarcar ? (
        <button
          type="button"
          aria-pressed={vermelho}
          aria-label={`Dia vermelho: ${dm}`}
          title={vermelho ? 'Tirar a marca de dia vermelho' : 'Marcar como dia vermelho'}
          onClick={() => aoMarcar(dia)}
          className="-ml-1 flex min-h-11 min-w-11 items-center gap-1.5 rounded px-1 hover:bg-passa focus-visible:outline-2"
        >
          {numero}
        </button>
      ) : (
        <span className="flex items-center gap-1.5">{numero}</span>
      )}
      {/* o cabeçalho das colunas já diz o dia da semana; na coluna única do celular ele volta */}
      <span data-dia-da-semana className="text-apoio text-apagado md:hidden">{SEMANA[new Date(`${dia}T00:00:00Z`).getUTCDay()]}</span>
    </div>
  );
}

/**
 * O mês em dias. Cada dia é uma célula sem caixa, com os dois turnos colados (Dia em cima, Noite embaixo); cada turno é uma placa de 36 px: a faixa da cor do
 * serviço à esquerda (JES ou Saldo; o nome do serviço vai na dica e para o leitor de tela), a patente em 13 px e o nome em 15 px. O turno livre é um contorno
 * tracejado. No computador, a semana; no celular, uma coluna.
 */
export function CalendarioDosOficiais({ escala: e, aoClicarTurno, aoMarcarDia, oficialEscolhido }: Props) {
  const turnos = e.turnosDoServico;
  const porId = new Map(e.oficiais.map((o) => [o.militarId, o] as const));
  const avisados = new Set(e.avisos.map((a) => `${a.dia}|${a.turnoId}`));
  const dias = [...new Set(e.turnos.map((t) => t.dia))].sort();
  const primeiro = dias[0] ? new Date(`${dias[0]}T00:00:00Z`).getUTCDay() : 0;
  const vermelhos = new Set(e.diasVermelhos);

  function placa(d: string, t: Turno) {
    const x = e.turnos.find((y) => y.dia === d && y.turnoId === t.id);
    if (!x) return null;
    const dd = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const base = `${dd}, ${rotuloDoTurnoNaTela(t)}`;
    const dono = x.militarId ? porId.get(x.militarId) : null;
    const alerta = avisados.has(`${d}|${t.id}`);
    const doEscolhido = Boolean(oficialEscolhido && x.militarId === oficialEscolhido);
    const comum = { 'data-turno': t.rotulo === 'Noite' ? 'noite' : 'dia', 'data-alerta': alerta ? 'true' : undefined, 'data-servico': x.servico ?? undefined } as const;
    const base36 = cn(
      'relative flex h-9 min-w-0 items-center gap-1.5 rounded-md border pr-1.5 pl-3 text-left leading-none',
      alerta && 'ring-2 ring-pendencia',
      !alerta && doEscolhido && 'ring-1 ring-tinta',
    );
    const interativo = Boolean(aoClicarTurno);

    if (x.militarId === null) {
      const rotulo = e.etapa === 'encerrada' || e.etapa === 'fechada' ? 'vazio' : 'livre';
      const conteudo = (
        <>
          <span className="truncate text-apoio text-apagado">{rotulo}</span>
        </>
      );
      const classe = cn(base36, 'border-dashed border-encaixe pl-2');
      return interativo ? (
        <button key={t.id} type="button" {...comum} aria-label={`${base}: ${rotulo}`} onClick={() => aoClicarTurno!(x)} className={cn(classe, 'hover:border-tinta hover:border-solid focus-visible:outline-2 focus-visible:outline-offset-1')}>
          {conteudo}
        </button>
      ) : (
        <div key={t.id} {...comum} className={classe}>{conteudo}</div>
      );
    }

    const nome = dono?.nomeGuerra ?? 'outro oficial';
    const servico = x.servico ?? 'saldo';
    const saiu = x.saiuMilitarId ? porId.get(x.saiuMilitarId) : null;
    const dica = dono ? `${dono.posto} ${dono.nomeGuerra} · ${t.rotulo} · ${NOME_DO_SERVICO[servico]}${saiu ? ` · cobriu ${saiu.nomeGuerra}` : ''}` : undefined;
    // o Dia é branco e a Noite, o cinza leve de painel: a linha de cima e a de baixo do dia se distinguem sem letra
    const classe = cn(base36, 'border-linha shadow-apoiada', t.rotulo === 'Noite' ? 'bg-passa' : 'bg-superficie');
    const conteudo = (
      <>
        {/* a faixa da cor do serviço, na altura toda da placa; o nome do serviço vai na dica e no texto para o leitor de tela */}
        <i aria-hidden data-faixa-do-servico={servico} className="absolute inset-y-0 left-0 w-[5px] rounded-l-[5px]" style={{ backgroundColor: corDoServico(e, servico) }} />
        <span className="sr-only">{`${base} (${NOME_DO_SERVICO[servico]})${saiu ? `, cobriu ${saiu.nomeGuerra}` : ''}`}</span>
        {/* com a célula estreita (menos de 8,5 rem), a patente sai da placa para o nome caber inteiro; ela continua na dica e no texto do leitor de tela */}
        {dono && <span aria-hidden className="hidden shrink-0 text-apoio font-medium text-apagado @[8.5rem]:inline">{dono.posto}</span>}
        <span aria-hidden className="min-w-0 flex-1 truncate font-cond text-corpo leading-[22px] font-semibold tracking-[0.01em] text-tinta">{nome}</span>
        {alerta && <AlertTriangle className="size-4 shrink-0 text-pendencia" aria-label="Alerta" />}
      </>
    );
    return interativo ? (
      <button key={t.id} type="button" {...comum} aria-label={`${base}: ${nome} (${NOME_DO_SERVICO[servico]})`} title={dica} onClick={() => aoClicarTurno!(x)} className={cn(classe, 'hover:border-encaixe hover:bg-passa focus-visible:outline-2 focus-visible:outline-offset-1')}>
        {conteudo}
      </button>
    ) : (
      <div key={t.id} {...comum} title={dica} className={classe}>{conteudo}</div>
    );
  }

  return (
    <div aria-label="Calendário do mês" role="group" className="grid gap-x-1.5 gap-y-3 md:grid-cols-7">
      {SEMANA.map((s) => (
        <div key={s} aria-hidden className="hidden text-center text-apoio font-medium text-apagado md:block">{s}</div>
      ))}
      {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} aria-hidden className="hidden md:block" />)}
      {dias.map((d) => (
        <div key={d} data-dia className="@container grid min-w-0 content-start gap-0.5">
          <CabecalhoDoDia dia={d} vermelho={vermelhos.has(d)} aoMarcar={aoMarcarDia} />
          <div className="grid grid-cols-2 gap-0.5 md:grid-cols-1">{turnos.map((t) => placa(d, t))}</div>
        </div>
      ))}
    </div>
  );
}
