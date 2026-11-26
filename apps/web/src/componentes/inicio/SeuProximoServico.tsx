import { Link } from '@tanstack/react-router';
import type { MeuServico } from 'contratos';
import { useId } from 'react';
import { Placa } from '@/componentes/Placa';
import { diaPorExtenso, horarioCurto } from '@/lib/proximos-servicos';

/** "Turno B. Na ABT, como combatente.": o turno (menos o `U`), e a guarnição com a função quando há; sem nenhum dos dois, nada. */
function ondeEComo(s: MeuServico): string {
  const turno = s.turno === 'U' ? '' : `Turno ${s.turno}.`;
  const guarnicao = s.guarnicao ? (s.funcao ? `Na ${s.guarnicao}, como ${s.funcao.toLowerCase()}.` : `Na ${s.guarnicao}.`) : '';
  return [turno, guarnicao].filter(Boolean).join(' ');
}

/**
 * "Seu próximo serviço" (6.55), embaixo dos atalhos: o detalhe do primeiro cartão da cena. O dia, o serviço e o horário; o turno, a guarnição e a função; quem vai junto, com a placa
 * de cada um e o próprio marcado; e, se a escala ainda está em prévia, o aviso de que pode mudar. O elo leva à Minha escala do mês do serviço.
 */
export function SeuProximoServico({ servico: s }: { servico: MeuServico }) {
  const titulo = useId();
  const onde = ondeEComo(s);
  return (
    <section aria-labelledby={titulo} className="grid gap-2 rounded-superficie border border-linha bg-superficie p-4 md:p-5">
      <h2 id={titulo} className="font-cond text-bloco font-semibold">Seu próximo serviço</h2>
      <div className="grid gap-0.5">
        <p className="text-nome font-medium">{diaPorExtenso(s.data)}</p>
        <p className="text-corpo">{`${s.servico}, das ${horarioCurto(s.inicio, s.fim)}`}</p>
        {onde && <p className="text-corpo text-apagado">{onde}</p>}
      </div>
      {s.composicao.length > 0 && (
        <ul aria-label="Quem vai junto" className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
          {s.composicao.map((c, i) => (
            <li key={`${c.nomeGuerra}-${i}`} className="flex min-w-0">
              <Placa
                patente={c.patente}
                nome={c.nomeGuerra}
                estado={c.eu ? 'escolhida' : 'normal'}
                extra={<span className="ml-auto shrink-0 pl-1 text-apoio text-apagado">{[c.funcao, c.eu && 'você'].filter(Boolean).join(' · ')}</span>}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      )}
      {s.estado === 'previa' && <p className="text-apoio font-medium text-pendencia">Escala em prévia: pode mudar.</p>}
      <Link to="/minha-escala" search={{ mes: s.data.slice(0, 7) }} className="w-fit text-corpo font-medium text-vinho underline underline-offset-4">
        Ver minha escala do mês
      </Link>
    </section>
  );
}
