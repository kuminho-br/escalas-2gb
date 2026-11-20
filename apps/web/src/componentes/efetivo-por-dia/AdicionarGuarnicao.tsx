import { useQuery } from '@tanstack/react-query';
import { consultaGuarnicoes } from '@/api/guarnicoes';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** Todos os modelos ativos da seção no mês do dia; o que já está na meta do dia aparece "já está no dia", desabilitado. O escolhido entra no fim da meta. */
export function AdicionarGuarnicao({ unidadeId, data, naMeta, salvando, erro, aoEscolher, aoFechar }: {
  unidadeId: string;
  data: string;
  naMeta: string[];
  salvando: boolean;
  erro: string | null;
  aoEscolher: (guarnicaoId: string) => void;
  aoFechar: () => void;
}) {
  const modelos = useQuery(consultaGuarnicoes(unidadeId, data.slice(0, 7)));
  const ativos = (modelos.data ?? []).filter((m) => m.ativa);
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar guarnição</DialogTitle>
          <DialogDescription>A guarnição entra no fim da meta deste dia.</DialogDescription>
        </DialogHeader>
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        {modelos.isPending && <p className="text-apagado">Carregando…</p>}
        {modelos.data && !ativos.length && <p className="text-apagado">Nenhum modelo de guarnição ativo neste mês.</p>}
        <ul className="grid gap-2">
          {ativos.map((m) => {
            const jaEsta = naMeta.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={salvando || jaEsta}
                  onClick={() => aoEscolher(m.id)}
                  className="flex w-full items-baseline justify-between gap-2 rounded-md border border-linha px-3 py-2 text-left hover:bg-accent disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  {m.nome}
                  {jaEsta && <span className="text-xs text-apagado">já está no dia</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
