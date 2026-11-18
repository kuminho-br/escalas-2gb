import { textoHora, type Servico } from 'contratos';
import { corDoTexto } from '@/lib/cores';
import { fimDaRegua, segmentosDoDia, sobreposicoes, textoMinutos } from '@/lib/turnos';

/** "Os turnos A e B se sobrepõem das 07h às 08h e das 18h às 19h." — um par por frase; 24h seguidas saem "o dia todo". */
function frasesDeSobreposicao(turnos: Servico['turnos']): string[] {
  const porPar = new Map<string, string[]>();
  for (const s of sobreposicoes(turnos)) {
    const k = s.letras.join(' e ');
    const trecho = s.fim - s.ini >= 1440 ? 'o dia todo' : `das ${textoMinutos(s.ini)} às ${textoMinutos(s.fim)}`;
    porPar.set(k, [...(porPar.get(k) ?? []), trecho]);
  }
  return [...porPar].map(([par, trechos]) => `Os turnos ${par} se sobrepõem ${trechos.length > 1 ? `${trechos.slice(0, -1).join(', ')} e ${trechos.at(-1)}` : trechos[0]}.`);
}

/** O dia de 0h a 24h com os turnos gravados na cor do serviço; o turno que passa da meia-noite continua pelo dia seguinte. */
export function ReguaDoDia({ servico }: { servico: Servico }) {
  if (servico.turnos.length === 0) return null;
  const rotulo = `Turnos do dia: ${servico.turnos.map((t) => `${t.letra} das ${textoHora(t.inicio)} às ${textoHora(t.fim)}`).join('; ')}`;
  const fundo = servico.cor;
  const segmentos = segmentosDoDia(servico.turnos);
  const fim = fimDaRegua(segmentos);
  const pct = (min: number) => `${(min / fim) * 100}%`;
  const temDiaSeguinte = fim > 1440;
  const marcas = Array.from({ length: Math.floor(fim / 360) + 1 }, (_, i) => i * 6);
  return (
    <div className="mb-4">
      <div role="img" aria-label={rotulo} className="relative h-8 overflow-hidden rounded-md border border-linha bg-fundo">
        {temDiaSeguinte && <span aria-hidden className="absolute inset-y-0 right-0 bg-black/[0.06]" style={{ left: pct(1440) }} />}
        {segmentos.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-y-0 grid place-items-center border-r border-white/50 font-cond text-sm font-semibold"
            style={{ left: pct(s.ini), width: pct(s.fim - s.ini), backgroundColor: fundo, color: corDoTexto(fundo) }}
          >
            {s.letra}
          </span>
        ))}
        {temDiaSeguinte && <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-tinta/60" style={{ left: pct(1440) }} />}
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-xs text-apagado">
        {marcas.map((h) => (
          <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(h * 60) }}>
            {h <= 24 ? `${h}h` : textoMinutos(h * 60)}
          </span>
        ))}
      </div>
      {temDiaSeguinte && (
        <div aria-hidden className="relative h-4 text-xs text-apagado">
          <span className="absolute pl-1" style={{ left: pct(1440) }}>dia seguinte</span>
        </div>
      )}
      {frasesDeSobreposicao(servico.turnos).map((f) => (
        <p key={f} role="status" className="mt-2 text-sm text-alerta">{f}</p>
      ))}
    </div>
  );
}
