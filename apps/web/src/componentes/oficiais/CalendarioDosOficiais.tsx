import { textoHora, type EscalaDosOficiais } from 'contratos';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Turno = EscalaDosOficiais['turnosDoServico'][number];
type Oficial = EscalaDosOficiais['oficiais'][number];
type Sorteado = EscalaDosOficiais['turnos'][number];

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const faixaDoTurno = (t: Turno) => `${textoHora(t.inicio)} às ${textoHora(t.fim)}`;
export const rotuloDoTurnoNaTela = (t: Turno) => `${t.rotulo}, ${faixaDoTurno(t)}`;

/**
 * Dia e noite se distinguem pela cor (decisão do usuário, 22/11/2026), sem o bloco escuro (6.22): uma faixa de 4 px à esquerda (âmbar no Dia, tinta na
 * Noite) e um fundo leve (branco no Dia, `passa` na Noite). A cor diz o turno; quem domina a tela é o nome de quem foi escalado.
 */
const TOM = {
  Dia: { faixa: 'border-l-4 border-l-pendencia', fundo: 'bg-superficie' },
  Noite: { faixa: 'border-l-4 border-l-tinta', fundo: 'bg-passa' },
} as const;

interface Props {
  escala: EscalaDosOficiais;
  /** O clique num lugar: livre (nas escolhas) ou qualquer um (com a escala fechada). Sem ele, o calendário é só de leitura. */
  aoClicarTurno?: (t: Sorteado) => void;
  aoTirar?: (t: Sorteado) => void;
  desabilitado?: boolean;
  /** O lugar que acabou de ser lançado: fica marcado até o próximo lançamento. */
  recente?: { dia: string; turnoId: string } | null;
}

export function LegendaDosTurnos({ turnos }: { turnos: Turno[] }) {
  return (
    <div aria-label="Legenda dos turnos" role="group" className="flex flex-wrap items-center gap-2 text-sm">
      {turnos.map((t) => (
        <span key={t.id} className={cn('inline-flex items-center gap-1.5 rounded-md border border-linha py-0.5 pr-2 pl-2 text-[13px]', TOM[t.rotulo].faixa, TOM[t.rotulo].fundo)}>
          {rotuloDoTurnoNaTela(t)}
        </span>
      ))}
    </div>
  );
}

/** O mês em dias, com os turnos do serviço. No celular, uma coluna; no computador, a semana. */
export function CalendarioDosOficiais({ escala: e, aoClicarTurno, aoTirar, desabilitado, recente }: Props) {
  const turnos = e.turnosDoServico;
  const porId = new Map(e.oficiais.map((o) => [o.militarId, o] as const));
  const vez = e.etapa === 'escolhas' ? (porId.get(e.vez ?? '') ?? null) : null;
  const nomeDoServico = { jes: 'JES', saldo: 'Saldo' } as const;
  const avisados = new Set(e.avisos.map((a) => `${a.dia}|${a.turnoId}`));
  const dias = [...new Set(e.turnos.map((t) => t.dia))].sort();
  const primeiro = dias[0] ? new Date(`${dias[0]}T00:00:00Z`).getUTCDay() : 0;

  function celula(d: string, t: Turno) {
    const x = e.turnos.find((y) => y.dia === d && y.turnoId === t.id);
    if (!x) return null;
    const dd = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const base = `${dd}, ${rotuloDoTurnoNaTela(t)}`;
    const dono = x.militarId ? porId.get(x.militarId) : null;
    const alerta = avisados.has(`${d}|${t.id}`);
    const eRecente = recente?.dia === d && recente.turnoId === t.id;
    const daVez = Boolean(vez && x.militarId === vez.militarId);
    const classe = cn(
      'relative flex min-h-12 min-w-0 flex-col justify-center rounded-md border px-1 py-1 text-left leading-tight',
      alerta && 'ring-2 ring-pendencia',
      eRecente && 'ring-2 ring-tinta',
      !eRecente && !alerta && daVez && 'ring-1 ring-vinho',
    );
    // a placa de quem foi escalado: faixa do turno, fundo leve e uma sombra apoiada; o livre é só um contorno tracejado
    const placa = cn(classe, 'border-linha shadow-[0_1px_2px_rgba(28,36,48,.12)]', TOM[t.rotulo].faixa, TOM[t.rotulo].fundo);
    const livre = cn(classe, 'border-dashed border-encaixe');
    const rotulo = <span className="text-[13px] leading-[18px] font-medium text-apagado">{t.rotulo}</span>;
    const marca = alerta ? <AlertTriangle className="ml-auto size-4 shrink-0 self-center text-pendencia" aria-label="Alerta" /> : null;
    // com o "Tirar", a primeira linha reserva o canto da direita (o nome fica com a largura toda da linha de baixo)
    const comTirar = !x.militarId ? false : e.etapa === 'escolhas' && Boolean(aoTirar);
    const comum = { 'data-turno': t.rotulo === 'Noite' ? 'noite' : 'dia', 'data-alerta': alerta ? 'true' : undefined, 'data-recente': eRecente ? 'true' : undefined } as const;

    if (x.militarId === null) {
      // sem nome: nas escolhas é livre; com a escala fechada qualquer lugar abre a escolha
      if (e.etapa === 'escolhas' && aoClicarTurno) {
        return (
          <button key={t.id} type="button" {...comum} disabled={desabilitado} aria-label={`${base}: livre`} onClick={() => aoClicarTurno(x)} className={cn(livre, 'hover:border-tinta focus-visible:outline-2')}>
            {rotulo}
            <span className="text-[13px] leading-[18px] text-apagado">livre</span>
          </button>
        );
      }
      if (e.etapa === 'fechada' && aoClicarTurno) {
        return (
          <button key={t.id} type="button" {...comum} disabled={desabilitado} aria-label={`${base}: vazio`} onClick={() => aoClicarTurno(x)} className={cn(livre, 'hover:border-tinta')}>
            {rotulo}
            <span className="text-[13px] leading-[18px] text-apagado">vazio</span>
          </button>
        );
      }
      return (
        <div key={t.id} {...comum} className={livre}>
          {rotulo}
          <span className="text-[13px] leading-[18px] text-apagado">{e.etapa === 'encerrada' || e.etapa === 'fechada' ? 'vazio' : 'livre'}</span>
        </div>
      );
    }

    const nome = dono?.nomeGuerra ?? 'outro oficial';
    const saiu = x.saiuMilitarId ? porId.get(x.saiuMilitarId) : null;
    // a patente nunca é cortada; o nome longo corta com reticências (a dica mostra tudo)
    const conteudo = (
      <>
        {/* o turno (Dia ou Noite) e a data para o leitor de tela: a placa de quem foi escalado não traz a palavra escrita */}
        <span className="sr-only">{`${base}${x.servico ? ` (${nomeDoServico[x.servico]})` : ''}`}</span>
        <span className={cn('flex min-w-0 flex-wrap items-baseline gap-x-1.5', comTirar && 'pr-6')}>
          {dono && <span className="shrink-0 text-[13px] leading-[18px] font-medium text-apagado">{dono.posto}</span>}
          {x.servico && <span data-servico={x.servico} aria-hidden className="shrink-0 rounded border border-linha px-1 text-[13px] leading-[18px] font-medium text-tinta">{nomeDoServico[x.servico]}</span>}
          {marca}
        </span>
        {/* o turno está na faixa, no fundo, na dica e no texto para o leitor de tela: o nome ganha a largura da célula */}
        <span className="min-w-0 truncate font-cond text-[17px] leading-6 font-semibold tracking-[0.01em] text-tinta">{nome}</span>
        {saiu && <span className="text-[13px] leading-[18px] text-apagado">cobriu {saiu.nomeGuerra}</span>}
      </>
    );
    if (e.etapa === 'fechada' && aoClicarTurno) {
      return (
        <button key={t.id} type="button" {...comum} disabled={desabilitado} aria-label={`${base}: ${nome} (${nomeDoServico[x.servico!]})`} onClick={() => aoClicarTurno(x)} className={cn(placa, 'hover:border-encaixe')} title={dono ? `${dono.posto} ${dono.nomeGuerra} · ${t.rotulo}` : undefined}>
          {conteudo}
        </button>
      );
    }
    return (
      <div key={t.id} {...comum} className={placa} title={dono ? `${dono.posto} ${dono.nomeGuerra} · ${t.rotulo}` : undefined}>
        {conteudo}
        {e.etapa === 'escolhas' && aoTirar && (
          <button
            type="button"
            disabled={desabilitado}
            aria-label={`Tirar ${nome} deste turno`}
            onClick={() => aoTirar(x)}
            className="absolute top-0.5 right-0.5 rounded p-1 text-apagado hover:text-tinta"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div aria-label="Calendário do mês" role="group" className="grid gap-x-1 gap-y-3 md:grid-cols-7">
      {SEMANA.map((s) => (
        <div key={s} aria-hidden className="hidden text-center text-[13px] font-medium text-apagado md:block">{s}</div>
      ))}
      {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} aria-hidden className="hidden md:block" />)}
      {dias.map((d) => (
        <div key={d} data-dia className="grid content-start gap-1 p-0.5">
          <div className="flex items-baseline gap-2">
            <b className="font-cond text-[15px] leading-[22px] font-semibold">{Number(d.slice(8))}</b>
            {/* o cabeçalho das colunas já diz o dia da semana; na coluna única do celular ele volta */}
            <span data-dia-da-semana className="text-[13px] text-apagado md:hidden">{SEMANA[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 md:grid-cols-1">{turnos.map((t) => celula(d, t))}</div>
        </div>
      ))}
    </div>
  );
}
