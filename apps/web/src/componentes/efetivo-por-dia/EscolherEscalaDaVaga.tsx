import { textoFaixa, type OpcaoDaVaga } from 'contratos';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** A vaga cai em vínculos de mais de uma escala ou faixa: o escalante escolhe por qual vai escalar. */
export function EscolherEscalaDaVaga({ opcoes, aoEscolher, aoFechar }: { opcoes: OpcaoDaVaga[]; aoEscolher: (o: OpcaoDaVaga) => void; aoFechar: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Por qual escala?</DialogTitle>
          <DialogDescription>Esta vaga é coberta por mais de uma escala neste dia.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {opcoes.map((o) => (
            <li key={`${o.escalaId}|${o.inicio}|${o.fim}`}>
              <button
                type="button"
                onClick={() => aoEscolher(o)}
                className="w-full rounded-md border border-linha px-3 py-2 text-left hover:bg-accent"
              >
                {o.escala} {textoFaixa(o.inicio, o.fim)}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
