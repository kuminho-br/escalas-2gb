import { textoFaixa, type OpcaoDaVaga } from 'contratos';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** A vaga cai em mais de um horário cadastrado (vínculos das escalas da guarnição): o escalante escolhe qual escala, e a escolha define a escala. */
export function EscolherHorarioDaVaga({ opcoes, aoEscolher, aoFechar }: { opcoes: OpcaoDaVaga[]; aoEscolher: (o: OpcaoDaVaga) => void; aoFechar: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Qual horário?</DialogTitle>
          <DialogDescription>Esta vaga cai em mais de um horário cadastrado neste dia.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {opcoes.map((o) => (
            <li key={`${o.escalaId}|${o.inicio}|${o.fim}`}>
              <button type="button" onClick={() => aoEscolher(o)} className="w-full rounded-md border border-linha px-3 py-2 text-left hover:bg-accent">
                {textoFaixa(o.inicio, o.fim)} · {o.escala}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
