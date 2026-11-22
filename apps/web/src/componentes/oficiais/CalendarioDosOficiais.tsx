import { textoHora, type EscalaDosOficiais } from 'contratos';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Turno = EscalaDosOficiais['turnosDoServico'][number];
type Oficial = EscalaDosOficiais['oficiais'][number];
type Sorteado = EscalaDosOficiais['turnos'][number];

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const faixaDoTurno = (t: Turno) => `${textoHora(t.inicio)} às ${textoHora(t.fim)}`;
export const rotuloDoTurnoNaTela = (t: Turno) => `${t.rotulo}, ${faixaDoTurno(t)}`;

/** Dia e noite se distinguem só pela cor (decisão do usuário, 22/11/2026): o Dia no fundo claro, a Noite num cinza escuro, com o texto do turno escrito. */
const TOM = {
  Dia: 'border-linha bg-superficie text-tinta',
  Noite: 'border-tinta bg-tinta text-white',
} as const;

interface Props {
  escala: EscalaDosOficiais;
  /** O clique num turno: livre (nas escolhas) ou qualquer um (com a escala fechada). Sem ele, o calendário é só de leitura. */
  aoClicarTurno?: (t: Sorteado) => void;
  aoTirar?: (t: Sorteado) => void;
  desabilitado?: boolean;
}

export function LegendaDosTurnos({ turnos }: { turnos: Turno[] }) {
  return (
    <div aria-label="Legenda dos turnos" role="group" className="flex flex-wrap items-center gap-2 text-sm">
      {turnos.map((t) => (
        <span key={t.id} className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5', TOM[t.rotulo])}>
          {rotuloDoTurnoNaTela(t)}
        </span>
      ))}
    </div>
  );
}

/** O mês em dias, com os turnos do serviço. No celular, uma coluna; no computador, a semana. */
export function CalendarioDosOficiais({ escala: e, aoClicarTurno, aoTirar, desabilitado }: Props) {
  const turnos = e.turnosDoServico;
  const porId = new Map(e.oficiais.map((o) => [o.militarId, o] as const));
  const vez = e.etapa === 'escolhas' ? (porId.get(e.vez ?? '') ?? null) : null;
  const avisados = new Set(e.avisos.map((a) => `${a.dia}|${a.turnoId}`));
  const dias = [...new Set(e.turnos.map((t) => t.dia))].sort();
  const primeiro = dias[0] ? new Date(`${dias[0]}T00:00:00Z`).getUTCDay() : 0;
  const afastado = (o: Oficial | null, d: string) => !!o?.afastamentos.some((a) => a.inicio <= d && d <= a.fim);

  function celula(d: string, t: Turno) {
    const x = e.turnos.find((y) => y.dia === d && y.turnoId === t.id);
    if (!x) return null;
    const dd = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const base = `${dd}, ${rotuloDoTurnoNaTela(t)}`;
    const tom = t.rotulo === 'Noite' ? 'escuro' : 'claro';
    const dono = x.militarId ? porId.get(x.militarId) : null;
    const alerta = avisados.has(`${d}|${t.id}`);
    const classe = cn('relative flex min-h-12 min-w-0 flex-col justify-center rounded-md border px-1.5 py-1 text-left text-[13px] leading-tight', TOM[t.rotulo], alerta && 'ring-2 ring-pendencia');
    const rotulo = <span className="text-[11px] opacity-80">{t.rotulo}</span>;
    const marca = alerta ? <AlertTriangle className="absolute top-1 right-1 size-3.5 text-pendencia" aria-label="Alerta" /> : null;
    const comum = { 'data-tom': tom, 'data-alerta': alerta ? 'true' : undefined } as const;

    if (x.militarId === null) {
      // sem nome: nas escolhas é livre (ou afastado, para a vez); com a escala fechada qualquer turno abre a escolha
      if (e.etapa === 'escolhas' && afastado(vez, d)) {
        return (
          <div key={t.id} {...comum} className={cn(classe, 'opacity-60')} title={`${vez!.posto} ${vez!.nomeGuerra} está afastado neste dia: o dia não é oferecido`}>
            {rotulo}
            <span className="font-medium">afastado</span>
          </div>
        );
      }
      if (e.etapa === 'escolhas' && aoClicarTurno) {
        return (
          <button key={t.id} type="button" {...comum} disabled={desabilitado} aria-label={`${base}: livre`} onClick={() => aoClicarTurno(x)} className={cn(classe, 'hover:border-encaixe focus-visible:outline-2')}>
            {rotulo}
            <span className="font-medium">livre</span>
          </button>
        );
      }
      if (e.etapa === 'fechada' && aoClicarTurno) {
        return (
          <button key={t.id} type="button" {...comum} disabled={desabilitado} aria-label={`${base}: vazio`} onClick={() => aoClicarTurno(x)} className={cn(classe, 'border-dashed hover:border-encaixe')}>
            {rotulo}
            <span className="font-medium">vazio</span>
          </button>
        );
      }
      return (
        <div key={t.id} {...comum} className={cn(classe, 'border-dashed')}>
          {rotulo}
          <span className="font-medium">{e.etapa === 'encerrada' || e.etapa === 'fechada' ? 'vazio' : 'livre'}</span>
        </div>
      );
    }

    const nome = dono?.nomeGuerra ?? 'outro oficial';
    const saiu = x.saiuMilitarId ? porId.get(x.saiuMilitarId) : null;
    const conteudo = (
      <>
        {rotulo}
        <span className="font-medium">{nome}</span>
        {saiu && <span className="text-[11px] opacity-80">cobriu {saiu.nomeGuerra}</span>}
        {marca}
      </>
    );
    if (e.etapa === 'fechada' && aoClicarTurno) {
      return (
        <button key={t.id} type="button" {...comum} disabled={desabilitado} aria-label={`${base}: ${nome}`} onClick={() => aoClicarTurno(x)} className={cn(classe, 'hover:border-encaixe')}>
          {conteudo}
        </button>
      );
    }
    return (
      <div key={t.id} {...comum} className={classe} title={dono ? `${dono.posto} ${dono.nomeGuerra}` : undefined}>
        {conteudo}
        {e.etapa === 'escolhas' && aoTirar && (
          <button
            type="button"
            disabled={desabilitado}
            aria-label={`Tirar ${nome} deste turno`}
            onClick={() => aoTirar(x)}
            className="absolute right-0.5 bottom-0.5 rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div aria-label="Calendário do mês" role="group" className="grid gap-1.5 md:grid-cols-7">
      {SEMANA.map((s) => (
        <div key={s} aria-hidden className="hidden text-center text-xs font-medium text-apagado md:block">{s}</div>
      ))}
      {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} aria-hidden className="hidden md:block" />)}
      {dias.map((d) => (
        <div key={d} className="grid gap-1 rounded-lg border border-linha bg-fundo/60 p-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <b className="text-sm">{Number(d.slice(8))}</b>
            <span className="text-apagado">{SEMANA[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 md:grid-cols-1">{turnos.map((t) => celula(d, t))}</div>
        </div>
      ))}
    </div>
  );
}
