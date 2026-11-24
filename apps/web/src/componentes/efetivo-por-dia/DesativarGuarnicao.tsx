import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** Desativar uma guarnição em que há gente escalada no dia: quem está só nela é desescalado (quem também está em outra continua nessa), e o "Desfazer" devolve. */
export function DesativarGuarnicao({ nome, salvando, erro, aoDesativar, aoFechar }: {
  nome: string;
  salvando: boolean;
  erro: string | null;
  aoDesativar: () => void;
  aoFechar: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desativar a {nome}?</DialogTitle>
          <DialogDescription>Quem está escalado só nela neste dia será desescalado. Quem também está em outra guarnição continua nessa.</DialogDescription>
        </DialogHeader>
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" disabled={salvando} onClick={aoDesativar}>Desativar</Button>
          <Button type="button" variant="discreto" onClick={aoFechar}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
