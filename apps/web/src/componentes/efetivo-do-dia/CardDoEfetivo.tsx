import { Link } from '@tanstack/react-router';
import { textoFaixa, type FaltaNoEfetivo, type GuarnicaoNoEfetivo, type MilitarNoEfetivo } from 'contratos';
import { corDoTexto } from '@/lib/cores';
import { cn } from '@/lib/utils';

const fraseDaFalta = (f: FaltaNoEfetivo) => `${f.faltam === 1 ? 'Falta 1' : `Faltam ${f.faltam}`} ${f.funcao} ${textoFaixa(f.inicio, f.fim)}`;

function Militar({ m }: { m: MilitarNoEfetivo }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <span className="w-20 text-apagado">{m.funcao}</span>
      <span className="font-cond text-base font-semibold">
        <span className="text-xs font-normal text-apagado">{m.posto}</span> {m.nomeGuerra}
      </span>
      <span>{textoFaixa(m.inicio, m.fim)}</span>
      <span className="rounded px-1.5 text-xs font-medium" style={{ backgroundColor: m.servico.cor, color: corDoTexto(m.servico.cor) }}>{m.servico.nome}</span>
      {m.acumulo && <span className="text-xs text-apagado">acumula</span>}
    </li>
  );
}

/**
 * Uma guarnição do dia. O número só existe na meta (a ordem de ativação), e o estado nunca muda a posição: não ativada continua onde está.
 * Cada falta é um buraco com o horário e o atalho para a Escala do mês da escala que vincula a guarnição nele.
 */
export function CardDoEfetivo({ g, data }: { g: GuarnicaoNoEfetivo; data: string }) {
  const nome = g.ordem === null ? g.nome : `${g.ordem}º ${g.nome}`;
  return (
    <section aria-label={nome} className="grid content-start gap-2 rounded-lg border border-linha bg-superficie p-3">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="font-cond text-lg leading-tight font-semibold">{nome}</h2>
        {g.viatura && <span className="text-sm text-apagado">{g.viatura}</span>}
        <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-medium', g.ativada ? 'bg-black/[0.06] text-tinta' : 'bg-pendencia-fundo text-pendencia')}>
          {g.ativada ? 'ativada' : 'não ativada'}
        </span>
      </header>
      {g.horarios.length === 0 && <p className="text-sm text-apagado">Sem horário vinculado neste dia</p>}
      {g.faltas.map((f) => (
        <p key={`${f.funcao}|${f.inicio}|${f.fim}`} className="flex flex-wrap items-center gap-x-3 text-sm font-medium text-pendencia">
          <span>{fraseDaFalta(f)}</span>
          {f.escalaId && (
            <Link to="/escala-do-mes" search={{ escala: f.escalaId, mes: data.slice(0, 7), dia: data }} className="font-medium text-vinho underline underline-offset-2">
              Abrir na Escala do mês
            </Link>
          )}
        </p>
      ))}
      {g.militares.length > 0 && (
        <ul className="grid gap-1">
          {g.militares.map((m) => <Militar key={`${m.militarId}|${m.funcaoId}|${m.inicio}`} m={m} />)}
        </ul>
      )}
    </section>
  );
}
