import { textoHora, type Servico } from 'contratos';
import { corDoTexto } from '@/lib/cores';
import { segmentosDoDia, sobreposicoes, textoMinutos } from '@/lib/turnos';

const MARCAS = [0, 6, 12, 18, 24];

/** "Os turnos A e B se sobrepõem das 07h às 08h e das 18h às 19h." — um par por frase. */
function frasesDeSobreposicao(turnos: Servico['turnos']): string[] {
  const porPar = new Map<string, string[]>();
  for (const s of sobreposicoes(turnos)) {
    const k = s.letras.join(' e ');
    porPar.set(k, [...(porPar.get(k) ?? []), `das ${textoMinutos(s.ini)} às ${textoMinutos(s.fim)}`]);
  }
  return [...porPar].map(([par, trechos]) => `Os turnos ${par} se sobrepõem ${trechos.length > 1 ? `${trechos.slice(0, -1).join(', ')} e ${trechos.at(-1)}` : trechos[0]}.`);
}

/** O dia de 0h a 24h com os turnos gravados desenhados na cor do serviço. */
export function ReguaDoDia({ servico }: { servico: Servico }) {
  if (servico.turnos.length === 0) return null;
  const rotulo = `Turnos do dia: ${servico.turnos.map((t) => `${t.letra} das ${textoHora(t.inicio)} às ${textoHora(t.fim)}`).join('; ')}`;
  const fundo = servico.cor;
  return (
    <div className="mb-4">
      <div role="img" aria-label={rotulo} className="relative h-8 overflow-hidden rounded-md border border-linha bg-fundo">
        {segmentosDoDia(servico.turnos).map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-y-0 grid place-items-center border-r border-white/50 font-cond text-sm font-semibold"
            style={{ left: `${(s.ini / 1440) * 100}%`, width: `${((s.fim - s.ini) / 1440) * 100}%`, backgroundColor: fundo, color: corDoTexto(fundo) }}
          >
            {s.letra}
          </span>
        ))}
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-xs text-apagado">
        {MARCAS.map((h) => (
          <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(h / 24) * 100}%` }}>
            {h}h
          </span>
        ))}
      </div>
      {frasesDeSobreposicao(servico.turnos).map((f) => (
        <p key={f} role="status" className="mt-2 text-sm text-alerta">{f}</p>
      ))}
    </div>
  );
}
