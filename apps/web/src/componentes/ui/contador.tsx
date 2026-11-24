import { Minus, Plus } from 'lucide-react';
import { Button } from '@/componentes/ui/button';

/**
 * O contador do sistema de estilo: um grupo com borda `encaixe`, menos, o valor em 17 px estreita e mais. Os botões se apagam em `minimo` e em `maximo`.
 * `rotulo` dá o nome do grupo ("Mínimo de Chefe") e, em minúscula, o dos botões ("Diminuir mínimo de Chefe").
 */
export function Contador({ rotulo, valor, minimo = 0, maximo = Number.MAX_SAFE_INTEGER, aoMudar }: { rotulo: string; valor: number; minimo?: number; maximo?: number; aoMudar: (valor: number) => void }) {
  // os botões dizem o verbo e o rótulo em minúscula: "Diminuir mínimo de Chefe"
  const nome = rotulo.charAt(0).toLowerCase() + rotulo.slice(1);
  return (
    <span role="group" aria-label={rotulo} className="inline-flex items-center overflow-hidden rounded-controle border border-encaixe bg-superficie">
      <Button type="button" variant="discreto" size="icon-sm" className="rounded-none" aria-label={`Diminuir ${nome}`} disabled={valor <= minimo} onClick={() => aoMudar(valor - 1)}>
        <Minus aria-hidden />
      </Button>
      <span className="min-w-8 text-center font-cond text-nome font-semibold tabular-nums">{valor}</span>
      <Button type="button" variant="discreto" size="icon-sm" className="rounded-none" aria-label={`Aumentar ${nome}`} disabled={valor >= maximo} onClick={() => aoMudar(valor + 1)}>
        <Plus aria-hidden />
      </Button>
    </span>
  );
}
