import { textoFaixa, type DiaDaEscala, type FaixaDoDia, type OcupanteDaVaga } from 'contratos';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { cn } from '@/lib/utils';
import { CardDaGuarnicao, PlacaDoOcupante, type VagaDaTela } from './CardDaGuarnicao';

const DIA_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

type Acoes = {
  aoEscolher?: (vaga: VagaDaTela) => void;
  aoRemover?: (o: OcupanteDaVaga, guarnicao: string, dia: number, vaga: string, daVaga?: Omit<VagaDaTela, 'data' | 'inicio' | 'fim'>) => void;
  aoTrocar?: (o: OcupanteDaVaga, guarnicao: string, dia: number, vaga: string, daVaga: VagaDaTela) => void;
  aoDesfazer?: (remocaoId: string) => void;
};

function Faixa({ faixa, dia, soVazias, aoEscolher, aoRemover, aoTrocar }: { faixa: FaixaDoDia; dia: string; soVazias: boolean } & Acoes) {
  const cards = soVazias ? faixa.guarnicoes.filter((g) => !g.completa) : faixa.guarnicoes;
  if (soVazias && cards.length === 0) return null;
  const letras = [...new Set(faixa.turnos.map((t) => t.letra))].join(', ');
  // uma etiqueta para cada serviço da faixa, na cor cadastrada
  const servicos = [...new Map(faixa.turnos.map((t) => [t.servicoId, t])).values()];
  return (
    // o turno com mais de uma guarnição (como no Ordinário) ocupa a linha inteira; o de uma só fica lado a lado com os outros
    <div data-faixa data-noturna={faixa.noturna ? '' : undefined} data-larga={faixa.guarnicoes.length > 1 ? '' : undefined} className={cn('flex min-w-0', faixa.guarnicoes.length > 1 && 'col-span-full')}>
      <div className="min-w-0 flex-1 grid gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-cond text-sm font-semibold">
          <span>{textoFaixa(faixa.inicio, faixa.fim)}</span>
          <span className="font-normal text-apagado">{letras}</span>
          {servicos.map((t) => <Etiqueta key={t.servicoId} tipo="servico" cor={t.cor}>{t.servico}</Etiqueta>)}
        </p>
        {cards.length > 0 && (
          <div data-cards-do-turno className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] items-start gap-3">
            {cards.map((g) => (
              <CardDaGuarnicao key={g.guarnicaoId} card={g} aoEscolher={aoEscolher && ((v) => aoEscolher({ ...v, data: dia, inicio: faixa.inicio, fim: faixa.fim }))} aoRemover={aoRemover && ((o, guarnicao, vaga, daVaga) => aoRemover(o, guarnicao, Number(dia.slice(8)), vaga, daVaga))} aoTrocar={aoTrocar && aoEscolher && ((o, guarnicao, vaga, v) => aoTrocar(o, guarnicao, Number(dia.slice(8)), vaga, { ...v, data: dia, inicio: faixa.inicio, fim: faixa.fim }))} />
            ))}
          </div>
        )}
        {faixa.semPosto.length > 0 && (
          <div className="grid gap-1.5">
            <p className="text-apoio font-medium text-apagado">Sem guarnição</p>
            <ul className="grid gap-1.5">
              {faixa.semPosto.map((o) => (
                <li key={o.alocacaoId}>
                  <PlacaDoOcupante o={o} vaga="Sem guarnição" acoes={aoRemover ? [{ rotulo: 'Remover do turno', aoEscolher: () => aoRemover(o, 'Sem guarnição', Number(dia.slice(8)), 'Sem guarnição') }] : undefined} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * O painel "Removidos" do dia: quem foi tirado de um turno e não volta quando a pré-escala é gerada de novo. Fica junto, no fim do dia, e cresce
 * para mostrar todos (cada um com o horário do turno e o "Permitir de novo").
 */
function Removidos({ dia, aoDesfazer }: { dia: DiaDaEscala; aoDesfazer?: Acoes['aoDesfazer'] }) {
  const removidos = dia.faixas.flatMap((f) => f.removidos.map((r) => ({ ...r, horario: textoFaixa(f.inicio, f.fim) })));
  if (removidos.length === 0) return null;
  return (
    <section aria-label="Removidos" data-removidos className="col-span-full grid gap-1.5 rounded-lg bg-passa px-3 py-2 text-xs">
      <h4 className="font-medium text-apagado">Removidos</h4>
      <ul className="grid gap-1">
        {removidos.map((r) => (
          <li key={r.remocaoId} className="flex flex-wrap items-center gap-x-2">
            <span className="text-apagado">{r.horario}</span>
            <span className="font-medium">{r.nomeGuerra}</span>
            {aoDesfazer && (
              <button
                type="button"
                aria-label={`Permitir de novo ${r.nomeGuerra} neste turno`}
                title="Tira a marca de remoção: a pré-escala poderá escalar este militar neste turno de novo. Ele não volta para a vaga agora."
                onClick={() => aoDesfazer(r.remocaoId)}
                className="font-medium text-vinho underline underline-offset-2"
              >
                Permitir de novo
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Um dia: o número grande parado à esquerda durante a rolagem e, ao lado, as faixas do dia. */
export function DiaDaEscalaVista({ dia, soVazias, aoEscolher, aoRemover, aoTrocar, aoDesfazer }: { dia: DiaDaEscala; soVazias: boolean } & Acoes) {
  if (soVazias && dia.obrigatoriasVazias === 0) return null;
  const n = Number(dia.data.slice(8));
  const fimDeSemana = dia.diaDaSemana === 0 || dia.diaDaSemana === 6;
  return (
    <section id={`dia-${dia.data}`} aria-label={`Dia ${n}`} className={cn('scroll-mt-20 grid grid-cols-[4.5rem_0.375rem_1fr] gap-3 rounded-xl border border-linha p-3 sm:grid-cols-[6rem_0.375rem_1fr]', fimDeSemana ? 'bg-black/[0.03]' : 'bg-fundo/40')}>
      <div className="self-start sticky top-[calc(var(--faixa)+4.5rem)]">
        <span className={cn('block font-cond text-4xl leading-none font-semibold', dia.feriado && 'text-alerta')}>{n}</span>
        <span className="block text-xs text-apagado">{DIA_DA_SEMANA[dia.diaDaSemana]}</span>
        {dia.feriado && <span className="block text-xs font-medium text-alerta">{dia.feriado}</span>}
      </div>
      {/* uma barra só por dia, entre o número e os turnos (sai a barra clara/escura de cada turno) */}
      <div data-barra-do-dia aria-hidden className="w-1.5 self-stretch rounded-full bg-linha" />
      {/* os turnos do dia lado a lado, numa grade de ~20rem (adendo de 19/11 depois da 2.4): no celular, um embaixo do outro */}
      <div data-faixas-do-dia className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4">
        {dia.faixas.map((f) => <Faixa key={`${f.inicio}|${f.fim}`} faixa={f} dia={dia.data} soVazias={soVazias} aoEscolher={aoEscolher} aoRemover={aoRemover} aoTrocar={aoTrocar} />)}
        <Removidos dia={dia} aoDesfazer={aoDesfazer} />
      </div>
    </section>
  );
}
