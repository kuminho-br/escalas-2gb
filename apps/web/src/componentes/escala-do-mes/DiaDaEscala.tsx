import { textoFaixa, type DiaDaEscala, type FaixaDoDia, type OcupanteDaVaga } from 'contratos';
import { cn } from '@/lib/utils';
import { CardDaGuarnicao, type VagaDaTela } from './CardDaGuarnicao';

const DIA_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

type Acoes = {
  aoEscolher?: (vaga: VagaDaTela) => void;
  aoRemover?: (o: OcupanteDaVaga, guarnicao: string, dia: number) => void;
  aoDesfazer?: (remocaoId: string) => void;
};

function Faixa({ faixa, dia, soVazias, aoEscolher, aoRemover, aoDesfazer }: { faixa: FaixaDoDia; dia: string; soVazias: boolean } & Acoes) {
  const cards = soVazias ? faixa.guarnicoes.filter((g) => !g.completa) : faixa.guarnicoes;
  if (soVazias && cards.length === 0) return null;
  const letras = [...new Set(faixa.turnos.map((t) => t.letra))].join(', ');
  const servicos = [...new Set(faixa.turnos.map((t) => t.servico))].join(', ');
  return (
    <div data-faixa data-noturna={faixa.noturna ? '' : undefined} className="flex gap-3">
      <div aria-hidden className={cn('w-1.5 shrink-0 rounded-full', faixa.noturna ? 'bg-[#24324F]' : 'bg-[#E8D9A3]')} />
      <div className="min-w-0 flex-1 grid gap-2">
        <p className="font-cond text-sm font-semibold">
          <span>{textoFaixa(faixa.inicio, faixa.fim)}</span> <span className="font-normal text-apagado">{letras} · {servicos}</span>
        </p>
        {cards.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {cards.map((g) => (
              <CardDaGuarnicao key={g.guarnicaoId} card={g} aoEscolher={aoEscolher && ((v) => aoEscolher({ ...v, data: dia, inicio: faixa.inicio, fim: faixa.fim }))} aoRemover={aoRemover && ((o, guarnicao) => aoRemover(o, guarnicao, Number(dia.slice(8))))} />
            ))}
          </div>
        )}
        {faixa.semPosto.length > 0 && (
          <p className="text-sm">
            <span className="text-apagado">Sem guarnição: </span>
            {faixa.semPosto.map((o) => o.nomeGuerra).join(', ')}
          </p>
        )}
        {faixa.removidos.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-apagado">
            <span>Removidos:</span>
            {faixa.removidos.map((r) => (
              <span key={r.remocaoId} className="inline-flex items-center gap-1">
                {r.nomeGuerra}
                {aoDesfazer && (
                  <button type="button" aria-label={`Desfazer remoção de ${r.nomeGuerra}`} onClick={() => aoDesfazer(r.remocaoId)} className="font-medium text-vinho underline underline-offset-2">
                    Desfazer
                  </button>
                )}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/** Um dia: o número grande parado à esquerda durante a rolagem e, ao lado, as faixas do dia. */
export function DiaDaEscalaVista({ dia, soVazias, aoEscolher, aoRemover, aoDesfazer }: { dia: DiaDaEscala; soVazias: boolean } & Acoes) {
  if (soVazias && dia.obrigatoriasVazias === 0) return null;
  const n = Number(dia.data.slice(8));
  const fimDeSemana = dia.diaDaSemana === 0 || dia.diaDaSemana === 6;
  return (
    <section aria-label={`Dia ${n}`} className={cn('grid grid-cols-[4.5rem_1fr] gap-3 rounded-xl border border-linha p-3 sm:grid-cols-[6rem_1fr]', fimDeSemana ? 'bg-black/[0.03]' : 'bg-fundo/40')}>
      <div className="self-start sticky top-[4.5rem]">
        <span className={cn('block font-cond text-4xl leading-none font-semibold', dia.feriado && 'text-alerta')}>{n}</span>
        <span className="block text-xs text-apagado">{DIA_DA_SEMANA[dia.diaDaSemana]}</span>
        {dia.feriado && <span className="block text-xs font-medium text-alerta">{dia.feriado}</span>}
      </div>
      <div className="grid gap-4">
        {dia.faixas.map((f) => <Faixa key={`${f.inicio}|${f.fim}`} faixa={f} dia={dia.data} soVazias={soVazias} aoEscolher={aoEscolher} aoRemover={aoRemover} aoDesfazer={aoDesfazer} />)}
      </div>
    </section>
  );
}
