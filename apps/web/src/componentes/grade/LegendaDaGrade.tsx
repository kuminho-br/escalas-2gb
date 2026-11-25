import type { GrupoDaGrade } from 'contratos';

/** Cada cor é um serviço e a letra é o turno; só entram os serviços que aparecem na grade. */
export function LegendaDaGrade({ grupos }: { grupos: GrupoDaGrade[] }) {
  const blocos = grupos.flatMap((g) => g.linhas.flatMap((l) => Object.values(l.dias).flat()));
  const servicos = [...new Map(blocos.flatMap((b) => (b.servico ? [[b.servico.id, b.servico] as const] : []))).values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const temExpediente = blocos.some((b) => b.expediente);
  const temChoque = grupos.some((g) => g.linhas.some((l) => l.choques.length > 0));
  if (!servicos.length && !temExpediente && !temChoque) return null;
  return (
    <ul aria-label="Legenda" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-linha px-4 py-2.5 text-[13px] text-apagado">
      {servicos.map((s) => (
        <li key={s.id} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px]" style={{ backgroundColor: s.cor }} />
          {s.nome}
        </li>
      ))}
      {temExpediente && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] bg-[#8A94A1]" />
          Expediente do ADM
        </li>
      )}
      {temChoque && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] bg-alerta/10 ring-2 ring-alerta ring-inset" />
          Choque de horário
        </li>
      )}
    </ul>
  );
}
