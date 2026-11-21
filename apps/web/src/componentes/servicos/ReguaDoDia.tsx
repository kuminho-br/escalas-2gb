import { textoHora, type Servico } from 'contratos';
import { useState } from 'react';
import { estiloDaCor } from '@/lib/cores';
import { cn } from '@/lib/utils';
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

/** O dia de 0h a 24h com os turnos gravados na cor do serviço; o turno que passa da meia-noite continua pelo D+1. */
export function ReguaDoDia({ servico }: { servico: Servico }) {
  const [emCima, setEmCima] = useState<number | null>(null);
  if (servico.turnos.length === 0) return null;
  const rotulo = `Turnos do dia: ${servico.turnos.map((t) => `${t.letra} das ${textoHora(t.inicio)} às ${textoHora(t.fim)}`).join('; ')}`;
  const fundo = servico.cor;
  const segmentos = segmentosDoDia(servico.turnos);
  const fim = fimDaRegua(segmentos);
  const pct = (min: number) => `${(min / fim) * 100}%`;
  const temDiaSeguinte = fim > 1440;
  const marcas = Array.from({ length: Math.floor(fim / 360) + 1 }, (_, i) => i * 6);
  // com pouco D+1 não há espaço para centrar: a legenda encosta no canto direito
  const diaSeguinteCurto = (fim - 1440) / fim < 0.15;
  const dica = emCima === null ? null : segmentos[emCima];
  const turnoDaDica = dica && servico.turnos.find((t) => t.letra === dica.letra);
  return (
    <div className="mb-4">
      <div className="relative">
        {dica && turnoDaDica && (
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full z-30 mb-1.5 -translate-x-1/2 rounded-md bg-tinta px-2 py-1 text-xs whitespace-nowrap text-white shadow-sm"
            style={{ left: pct(Math.min(Math.max((dica.ini + dica.fim) / 2, fim * 0.12), fim * 0.88)) }}
          >
            Turno {turnoDaDica.letra}, das {textoHora(turnoDaDica.inicio)} às {textoHora(turnoDaDica.fim)}
          </span>
        )}
        <div role="img" aria-label={rotulo} className="relative h-8 overflow-hidden rounded-md border border-linha bg-fundo">
          {temDiaSeguinte && <span aria-hidden className="absolute inset-y-0 right-0 bg-black/[0.06]" style={{ left: pct(1440) }} />}
          {segmentos.map((s, i) => (
            <span
              key={i}
              aria-hidden
              onMouseEnter={() => setEmCima(i)}
              onMouseLeave={() => setEmCima((atual) => (atual === i ? null : atual))}
              className="absolute inset-y-0 grid place-items-center border-r border-white/50 font-cond text-sm font-semibold"
              style={{ left: pct(s.ini), width: pct(s.fim - s.ini), ...estiloDaCor(fundo) }}
            >
              {/* a letra só cabe em trecho largo; o nome acessível da régua já a diz */}
              {(s.fim - s.ini) / fim >= 0.06 && <span className="relative z-20">{s.letra}</span>}
            </span>
          ))}
        </div>
        {/* início e fim do dia (0h e 24h): linha vinho cheia, um pouco mais alta que a barra, em todo serviço */}
        {[0, 1440].map((m) => (
          <span
            key={m}
            data-limite-do-dia
            aria-hidden
            className="pointer-events-none absolute -inset-y-1 z-10 w-0.5 -translate-x-1/2 rounded-full bg-vinho"
            style={{ left: pct(m) }}
          />
        ))}
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-xs text-apagado">
        {marcas.map((h) => (
          <span
            key={h}
            className={cn('absolute', h === 0 ? 'translate-x-0' : h * 60 === fim ? '-translate-x-full' : '-translate-x-1/2')}
            style={{ left: pct(h * 60) }}
          >
            {h <= 24 ? `${String(h).padStart(2, '0')}h` : textoMinutos(h * 60)}
          </span>
        ))}
      </div>
      {temDiaSeguinte && (
        <div aria-hidden className="relative h-4 font-cond text-xs font-semibold text-tinta">
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(720) }}>D</span>
          <span
            className={cn('absolute whitespace-nowrap', diaSeguinteCurto ? 'right-0 text-right' : '-translate-x-1/2')}
            style={diaSeguinteCurto ? undefined : { left: pct((1440 + fim) / 2) }}
          >
            D+1
          </span>
        </div>
      )}
      {frasesDeSobreposicao(servico.turnos).map((f) => (
        <p key={f} role="status" className="mt-2 text-sm text-alerta">{f}</p>
      ))}
    </div>
  );
}
