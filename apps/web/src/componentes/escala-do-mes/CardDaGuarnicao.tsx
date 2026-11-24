import type { CardDaGuarnicao as Card, FuncaoNoCard, OcupanteDaVaga } from 'contratos';
import { Check, Plus } from 'lucide-react';
import { BarraDaVaga, classeDaVaga, classeDaVagaSoLeitura } from '@/componentes/VagaVazia';
import { estiloDaCor } from '@/lib/cores';
import { listaComE, nomeDaVaga } from '@/lib/escala';
import { cn } from '@/lib/utils';

/** A vaga que a tela oferece ao escalante (preenchida pelo diálogo "Escolher militar"). */
export type VagaDaTela = { data: string; inicio: string; fim: string; guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string; cnhExigida: FuncaoNoCard['cnhExigida'] };

function Ocupante({ o, vaga, aoRemover }: { o: OcupanteDaVaga; vaga: string; aoRemover?: (o: OcupanteDaVaga) => void }) {
  const acumulo = o.acumuloId !== null;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <span className="text-xs text-apagado">{o.posto}</span>
      <span className="font-cond text-base font-semibold">{o.nomeGuerra}</span>
      <span className="text-xs text-apagado">{o.matricula}</span>
      <span className="rounded px-1.5 text-xs font-medium" style={estiloDaCor(o.servico.cor)}>{o.servico.nome}</span>
      {o.acumulaCom.length > 0 && <span className="text-xs text-apagado">acumula com {listaComE(o.acumulaCom)}</span>}
      {aoRemover && (
        <button
          type="button"
          aria-label={acumulo ? `Tirar ${o.nomeGuerra} de ${vaga}` : `Remover ${o.nomeGuerra}`}
          onClick={() => aoRemover(o)}
          className="ml-auto rounded px-1.5 text-xs text-apagado hover:bg-accent hover:text-tinta"
        >
          {acumulo ? 'Tirar' : 'Remover'}
        </button>
      )}
    </li>
  );
}

/** O contador do cabeçalho do card: "Falta 1" e "Faltam 2". */
export const textoDoContador = (faltam: number) => (faltam === 1 ? 'Falta 1' : `Faltam ${faltam}`);

/** Um card por guarnição: nome, viatura, o ícone de completa (ou o contador "Faltam N") e uma linha por vaga. */
export function CardDaGuarnicao({ card, aoEscolher, aoRemover }: { card: Card; aoEscolher?: (vaga: Omit<VagaDaTela, 'data' | 'inicio' | 'fim'>) => void; aoRemover?: (o: OcupanteDaVaga, guarnicao: string, vaga: string) => void }) {
  const frases = card.faltam.join('. ');
  // as vagas obrigatórias que ainda estão vazias (o mesmo que o servidor diz em `faltam`, só que em número)
  const faltam = card.funcoes.reduce((n, f) => n + Math.max(0, f.minimo - f.ocupantes.length), 0);
  return (
    <div className="grid content-start gap-2 rounded-lg border border-linha bg-superficie p-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-cond text-base leading-tight font-semibold">{card.nome}</h4>
          {card.viatura && <p className="text-xs text-apagado">{card.viatura}</p>}
        </div>
        {card.completa ? (
          <span role="img" aria-label="Completa" title="Completa" className="text-encaixe">
            <Check className="size-5" aria-hidden />
          </span>
        ) : (
          // só o número: o que falta, em frases, fica no title e no nome acessível
          <span role="img" aria-label={frases} title={frases} className="inline-flex items-center gap-1.5 rounded-full border border-linha py-0.5 pr-2 pl-1.5 text-apoio font-medium whitespace-nowrap text-tinta">
            <span aria-hidden className="h-3 w-[3px] rounded-sm bg-vinho" />
            {textoDoContador(faltam)}
          </span>
        )}
      </header>
      <ul data-funcoes className="grid gap-1.5">
        {card.funcoes.map((f) => (
          // cada função é um painel próprio, com o cabeçalho dela
          <li key={f.funcaoId} data-painel-funcao className="grid gap-1 rounded-md bg-passa px-2 pt-1.5 pb-2">
            <p data-cabecalho-funcao className="text-xs font-medium text-apagado">
              {f.funcao}
              {f.cnhExigida && <span> (CNH {f.cnhExigida})</span>}
            </p>
            <ul className="grid gap-1">
              {f.ocupantes.map((o) => {
                const vaga = nomeDaVaga(card.nome, f.funcao, card.funcoes.length);
                return <Ocupante key={`${o.alocacaoId}|${o.acumuloId ?? ''}`} o={o} vaga={vaga} aoRemover={aoRemover && ((x) => aoRemover(x, card.nome, vaga))} />;
              })}
              {Array.from({ length: Math.max(0, f.maximo - f.ocupantes.length) }, (_, i) => {
                const obrigatoria = f.ocupantes.length + i < f.minimo;
                // sem como escolher (a unidade é só de consulta), a vaga livre é só um aviso: nada para clicar
                if (!aoEscolher) {
                  return (
                    <li key={`v${i}`}>
                      <div
                        data-obrigatoria={obrigatoria ? '' : undefined}
                        className={cn('relative flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1 text-left text-sm', classeDaVagaSoLeitura(obrigatoria), obrigatoria ? 'pl-3 font-medium' : 'font-normal')}
                      >
                        {obrigatoria && <BarraDaVaga />}
                        Vaga livre
                        {!obrigatoria && <span className="ml-auto text-xs font-normal">opcional</span>}
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={`v${i}`}>
                    <button
                      type="button"
                      data-obrigatoria={obrigatoria ? '' : undefined}
                      aria-label={`Escolher militar para ${f.funcao} de ${card.nome}`}
                      onClick={() => aoEscolher({ guarnicaoId: card.guarnicaoId, guarnicao: card.nome, funcaoId: f.funcaoId, funcao: f.funcao, cnhExigida: f.cnhExigida })}
                      className={cn(
                        'relative flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1 text-left text-sm focus-visible:z-10',
                        classeDaVaga(obrigatoria),
                        obrigatoria ? 'pl-3 font-medium' : 'font-normal',
                      )}
                    >
                      {obrigatoria && <BarraDaVaga />}
                      <Plus className="size-4 shrink-0" aria-hidden />
                      Escolher militar
                      {!obrigatoria && <span className="ml-auto text-xs font-normal">opcional</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
