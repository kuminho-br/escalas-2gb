import type { CotaRestante } from 'contratos';
import { estiloDaCor } from '@/lib/cores';
import { cn } from '@/lib/utils';

/** "JES: restam 26 de 40"; passando da cota, "JES: 2 acima da cota de 40". */
export function textoDaCota(c: CotaRestante): string {
  const resta = c.quantidade - c.usadas;
  return resta >= 0 ? `${c.servico}: restam ${resta} de ${c.quantidade}` : `${c.servico}: ${-resta} acima da cota de ${c.quantidade}`;
}

/** As cotas do mês que ainda sobram, por serviço (a barreira de suporte do chefe). Sem cotas, nada aparece. */
export function CotasRestantes({ cotas }: { cotas: CotaRestante[] }) {
  if (cotas.length === 0) return null;
  return (
    <ul aria-label="Cotas restantes" className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
      {cotas.map((c) => (
        <li key={c.servicoId} className={cn('rounded px-2 py-0.5 font-medium', c.usadas > c.quantidade && 'ring-2 ring-pendencia')} style={estiloDaCor(c.cor)}>
          {textoDaCota(c)}
        </li>
      ))}
    </ul>
  );
}
