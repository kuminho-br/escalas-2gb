import type { EfetivoDoDia } from 'contratos';
import { Button } from '@/componentes/ui/button';

/** "Desativadas hoje": as guarnições da meta padrão do dia que não estão na meta do dia. "Reativar" põe a guarnição no fim da meta do dia. */
export function Desativadas({ guarnicoes, salvando, aoReativar }: { guarnicoes: EfetivoDoDia['desativadas']; salvando: boolean; aoReativar: (guarnicaoId: string) => void }) {
  if (!guarnicoes.length) return null;
  return (
    <section aria-label="Desativadas hoje" className="grid gap-2">
      <h2 className="font-cond text-lg font-semibold text-apagado">Desativadas hoje</h2>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-2">
        {guarnicoes.map((g) => (
          <li key={g.guarnicaoId} className="flex items-center gap-2 rounded-lg border border-linha bg-superficie p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-cond text-base leading-tight font-semibold">{g.nome}</p>
              {g.viatura && <p className="truncate text-xs text-apagado">{g.viatura}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" aria-label={`Reativar ${g.nome}`} disabled={salvando} onClick={() => aoReativar(g.guarnicaoId)}>Reativar</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
