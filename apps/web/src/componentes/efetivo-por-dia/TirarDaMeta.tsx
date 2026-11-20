import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** Tirar da meta uma guarnição em que há gente escalada no dia: desescalar também, só tirar da meta, ou desistir (decisão 1-b). */
export function TirarDaMeta({ nome, alocados, salvando, erro, aoEscolher, aoFechar }: {
  nome: string;
  alocados: number;
  salvando: boolean;
  erro: string | null;
  aoEscolher: (desescalar: boolean) => void;
  aoFechar: () => void;
}) {
  const quem = alocados === 1 ? 'Há 1 militar escalado' : `Há ${alocados} militares escalados`;
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tirar {nome} da meta deste dia</DialogTitle>
          <DialogDescription>{quem} no {nome} neste dia.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-apagado">"Só tirar da meta" deixa a guarnição na tela, fora da meta. "Tirar e desescalar" também tira quem está nela neste dia.</p>
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button type="button" disabled={salvando} onClick={() => aoEscolher(true)}>Tirar e desescalar</Button>
          <Button type="button" variant="outline" disabled={salvando} onClick={() => aoEscolher(false)}>Só tirar da meta</Button>
          <Button type="button" variant="ghost" onClick={aoFechar}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
