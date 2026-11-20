import { useQuery } from '@tanstack/react-query';
import { consultaGuarnicoes } from '@/api/guarnicoes';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** Os modelos ativos da seção no mês do dia que ainda não estão na meta do dia; o escolhido entra no fim da meta. */
export function AdicionarGuarnicao({ unidadeId, data, naMeta, salvando, aoEscolher, aoFechar }: {
  unidadeId: string;
  data: string;
  naMeta: string[];
  salvando: boolean;
  aoEscolher: (guarnicaoId: string) => void;
  aoFechar: () => void;
}) {
  const modelos = useQuery(consultaGuarnicoes(unidadeId, data.slice(0, 7)));
  const fora = (modelos.data ?? []).filter((m) => m.ativa && !naMeta.includes(m.id));
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar guarnição</DialogTitle>
          <DialogDescription>A guarnição entra no fim da meta deste dia.</DialogDescription>
        </DialogHeader>
        {modelos.isPending && <p className="text-apagado">Carregando…</p>}
        {modelos.data && !fora.length && <p className="text-apagado">Todos os modelos ativos já estão na meta deste dia.</p>}
        <ul className="grid gap-2">
          {fora.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={salvando}
                onClick={() => aoEscolher(m.id)}
                className="w-full rounded-md border border-linha px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
              >
                {m.nome}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
