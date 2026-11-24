import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** Voltar o dia à meta padrão: pede confirmação e não desescala ninguém (a guarnição que sai da meta continua na tela, sem número, com as pessoas). */
export function ConfirmarVoltarAoPadrao({ salvando, erro, aoVoltar, aoFechar }: { salvando: boolean; erro: string | null; aoVoltar: () => void; aoFechar: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voltar este dia à meta padrão?</DialogTitle>
          <DialogDescription>A meta deste dia volta a ser a meta padrão. Ninguém é desescalado.</DialogDescription>
        </DialogHeader>
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" disabled={salvando} onClick={aoVoltar}>Voltar</Button>
          <Button type="button" variant="discreto" onClick={aoFechar}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
