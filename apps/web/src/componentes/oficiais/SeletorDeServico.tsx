import type { EscalaDosOficiais, ServicoDaRodada } from 'contratos';
import { cn } from '@/lib/utils';

const NOME = { jes: 'JES', saldo: 'Saldo' } as const;

interface Props {
  servico: ServicoDaRodada;
  aoMudar: (s: ServicoDaRodada) => void;
  jes: EscalaDosOficiais['jes'];
  /** A escala tem o serviço JES? Sem ele, só o Saldo se escolhe. */
  temJes: boolean;
}

/**
 * "Escalar: JES | Saldo": o serviço que os próximos cliques lançam. Com JES escolhido, diz quantos JES ainda restam na cota da unidade no mês; sem cota
 * cadastrada, avisa; com a cota acabada, o número fica âmbar e avisa (nada impede de lançar).
 */
export function SeletorDeServico({ servico, aoMudar, jes, temJes }: Props) {
  const restam = jes.cota === null ? null : jes.cota - jes.usados;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span id="escalar-rotulo" className="text-[15px] font-medium">Escalar:</span>
        <div role="radiogroup" aria-labelledby="escalar-rotulo" className="inline-flex overflow-hidden rounded-md border border-encaixe">
          {(['jes', 'saldo'] as const).map((s) => {
            const escolhido = servico === s;
            const desligado = s === 'jes' && !temJes;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={escolhido}
                disabled={desligado}
                title={desligado ? 'A escala não tem o serviço JES.' : undefined}
                onClick={() => aoMudar(s)}
                className={cn(
                  'h-9 min-w-16 px-3.5 text-[15px] font-medium transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
                  escolhido ? 'bg-tinta text-white' : 'bg-superficie text-tinta hover:bg-passa',
                  desligado && 'cursor-not-allowed bg-linha text-apagado hover:bg-linha',
                  s === 'saldo' && 'border-l border-encaixe',
                )}
              >
                {NOME[s]}
              </button>
            );
          })}
        </div>
      </div>
      {servico === 'jes' && temJes && (
        <p role="status" className="text-[15px]">
          {restam === null ? (
            <span className="text-apagado">Sem cota de JES cadastrada no mês.</span>
          ) : (
            <>
              <span>JES restam </span>
              <b className={cn('font-cond text-[17px] font-semibold tabular-nums', restam <= 0 ? 'rounded bg-pendencia-fundo px-1.5 text-pendencia' : 'text-tinta')}>{Math.max(restam, 0)}</b>
              <span> de {jes.cota}</span>
              {restam <= 0 && <span className="ml-2 text-[13px] font-medium text-pendencia">A cota de JES do mês acabou.</span>}
            </>
          )}
        </p>
      )}
    </div>
  );
}
