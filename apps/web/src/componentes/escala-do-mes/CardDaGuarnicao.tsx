import type { CardDaGuarnicao as Card, FuncaoNoCard, OcupanteDaVaga } from 'contratos';
import { Check, TriangleAlert } from 'lucide-react';
import { corDoTexto } from '@/lib/cores';
import { cn } from '@/lib/utils';

/** A vaga que a tela oferece ao escalante (preenchida pelo diálogo "Escolher militar"). */
export type VagaDaTela = { data: string; inicio: string; fim: string; guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string; cnhExigida: FuncaoNoCard['cnhExigida'] };

function Ocupante({ o }: { o: OcupanteDaVaga }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <span className="text-xs text-apagado">{o.posto}</span>
      <span className="font-cond text-base font-semibold">{o.nomeGuerra}</span>
      <span className="text-xs text-apagado">{o.matricula}</span>
      <span className="rounded px-1.5 text-xs font-medium" style={{ backgroundColor: o.servico.cor, color: corDoTexto(o.servico.cor) }}>{o.servico.nome}</span>
    </li>
  );
}

/** Um card por guarnição: nome, viatura, o ícone de completa ou faltando e uma linha por vaga. */
export function CardDaGuarnicao({ card, aoEscolher }: { card: Card; aoEscolher?: (vaga: Omit<VagaDaTela, 'data' | 'inicio' | 'fim'>) => void }) {
  const frases = card.faltam.join('. ');
  return (
    <div className="grid content-start gap-2 rounded-lg border border-linha bg-superficie p-3">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-cond text-base leading-tight font-semibold">{card.nome}</h4>
          {card.viatura && <p className="text-xs text-apagado">{card.viatura}</p>}
        </div>
        {card.completa ? (
          <span role="img" aria-label="Completa" title="Completa" className="text-[#2F8F5B]">
            <Check className="size-5" aria-hidden />
          </span>
        ) : (
          <span role="img" aria-label={frases} title={frases} className="text-alerta">
            <TriangleAlert className="size-5" aria-hidden />
          </span>
        )}
      </header>
      <ul className="grid gap-2">
        {card.funcoes.map((f) => (
          <li key={f.funcaoId} className="grid gap-1">
            <p className="text-xs font-medium text-apagado">
              {f.funcao}
              {f.cnhExigida && <span> (CNH {f.cnhExigida})</span>}
            </p>
            <ul className="grid gap-1">
              {f.ocupantes.map((o) => <Ocupante key={o.alocacaoId} o={o} />)}
              {Array.from({ length: Math.max(0, f.maximo - f.ocupantes.length) }, (_, i) => {
                const obrigatoria = f.ocupantes.length + i < f.minimo;
                return (
                  <li key={`v${i}`}>
                    <button
                      type="button"
                      data-obrigatoria={obrigatoria ? '' : undefined}
                      aria-label={`Escolher militar para ${f.funcao} de ${card.nome}`}
                      onClick={() => aoEscolher?.({ guarnicaoId: card.guarnicaoId, guarnicao: card.nome, funcaoId: f.funcaoId, funcao: f.funcao, cnhExigida: f.cnhExigida })}
                      className={cn(
                        'w-full rounded-md border px-2 py-1 text-left text-sm',
                        obrigatoria
                          ? 'border-[#F2C200] bg-[repeating-linear-gradient(135deg,#FFF3B8_0_8px,#FFFFFF_8px_16px)] font-medium'
                          : 'border-dashed border-linha text-apagado',
                      )}
                    >
                      Escolher militar
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
