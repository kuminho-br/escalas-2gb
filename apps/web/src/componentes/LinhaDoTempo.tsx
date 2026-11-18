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
    <ol className="mb-4 flex flex-wrap gap-2" aria-label="Versões por vigência">
      {[...vigencias].reverse().map((v) => (
        <li key={v}>
          <button
            type="button"
            aria-pressed={v === escolhida}
            onClick={() => aoEscolher(v)}
            className={cn('rounded-md border px-2.5 py-1 text-sm', v === escolhida ? 'border-tinta bg-tinta text-white' : 'border-linha')}
          >
            {mesPorExtenso(v)}
            {v === vigente && <span className="ml-1.5 text-xs opacity-80">em vigor</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}
