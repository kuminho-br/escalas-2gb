import { mesPorExtenso } from 'contratos';
import { mesAtual } from '@/lib/meses';
import { cn } from '@/lib/utils';

/**
 * Chips das versões por vigência (da mais antiga para a mais recente na tela).
 * `vigencias` vem da mais recente para a mais antiga; "em vigor" só na vigente que já começou.
 */
export function LinhaDoTempo({ vigencias, escolhida, aoEscolher }: { vigencias: string[]; escolhida: string | undefined; aoEscolher: (v: string) => void }) {
  const mes = mesAtual();
  const vigente = vigencias.find((v) => v <= mes);
  return (
    <ol className="mb-4 flex flex-wrap items-center gap-y-2" aria-label="Versões por vigência">
      {[...vigencias].reverse().map((v, i) => (
        <li key={v} className="flex items-center">
          {/* a linha liga uma versão à seguinte; a que só vale no futuro tem borda tracejada */}
          {i > 0 && <span aria-hidden className="mx-1.5 h-0.5 w-6 bg-linha" />}
          <button
            type="button"
            aria-pressed={v === escolhida}
            data-futura={v > mes ? '' : undefined}
            onClick={() => aoEscolher(v)}
            className={cn('rounded-md border px-2.5 py-1 text-sm', v === escolhida ? 'border-tinta bg-tinta text-white' : 'border-linha', v > mes && 'border-dashed')}
          >
            {mesPorExtenso(v)}
            {v === vigente && <span className="ml-1.5 text-xs opacity-80">em vigor</span>}
            {v > mes && <span className="sr-only"> (ainda não vale)</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}
