import { cn } from '@/lib/utils';

/** A frase da cota por extenso (leitor de tela e dica): "2 de 6 saldos no mês". */
const porExtenso = (feitos: number, total: number) => `${feitos} de ${total} saldos no mês`;
/** Passou do total: com total 0, qualquer saldo já passa. Passar não trava nada, só pinta de âmbar. */
const acima = (feitos: number, total: number) => feitos > total;

/**
 * A cota de saldo do Adm à vista: uma barra pequena que enche conforme os saldos do mês são alocados (a cor normal da marca). Acima do total fica cheia e
 * em âmbar (a cor de pendência), sem travar. É uma imagem para o leitor de tela: "{n} de {total} saldos no mês".
 */
export function CotaDeSaldo({ feitos, total, className }: { feitos: number; total: number; className?: string }) {
  const passou = acima(feitos, total);
  const pct = passou ? 100 : total > 0 ? Math.min(100, (feitos / total) * 100) : 0;
  return (
    <span
      role="img"
      aria-label={porExtenso(feitos, total)}
      title={porExtenso(feitos, total)}
      data-cota-de-saldo
      data-estado={passou ? 'acima' : 'dentro'}
      className={cn('relative inline-block h-1.5 w-7 shrink-0 self-center overflow-hidden rounded-full bg-black/[0.08] align-middle', className)}
    >
      <span data-enchimento className={cn('absolute inset-y-0 left-0 rounded-full', passou ? 'bg-pendencia' : 'bg-vinho')} style={{ width: `${pct}%` }} />
    </span>
  );
}

/** O número da cota ao lado da etiqueta do Saldo ("2/6"); âmbar acima do total ("7/6"). */
export function NumeroDaCota({ feitos, total, className }: { feitos: number; total: number; className?: string }) {
  return (
    <span title={porExtenso(feitos, total)} className={cn('text-apoio font-medium', acima(feitos, total) ? 'text-pendencia' : 'text-apagado', className)}>
      {feitos}/{total}
    </span>
  );
}
