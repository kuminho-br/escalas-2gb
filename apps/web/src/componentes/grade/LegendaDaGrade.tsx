import type { GrupoDaGrade } from 'contratos';
import { estiloDaCor } from '@/lib/cores';

/**
 * A legenda, numa linha acima da tabela (6.70): os mesmos quadradinhos das células (a cor ajustada, lisos: a letra do turno é da célula, não da legenda, 6.74), o traço do afastado
 * e o contorno do choque. Cada cor é um serviço; só entra o que aparece na grade. No fim da linha, só no computador, a dica de como rolar para os lados.
 */
export function LegendaDaGrade({ grupos }: { grupos: GrupoDaGrade[] }) {
  const blocos = grupos.flatMap((g) => g.linhas.flatMap((l) => Object.values(l.dias).flat()));
  const porServico = new Map<string, { id: string; nome: string; cor: string }>();
  for (const b of blocos) if (!porServico.has(b.servico.id)) porServico.set(b.servico.id, { id: b.servico.id, nome: b.servico.nome, cor: b.servico.cor });
  const servicos = [...porServico.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const temChoque = grupos.some((g) => g.linhas.some((l) => l.choques.length > 0));
  const temAfastado = grupos.some((g) => g.linhas.some((l) => l.afastamentos.length > 0));
  if (!servicos.length && !temChoque && !temAfastado) return null;
  return (
    <ul aria-label="Legenda" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-linha px-4 py-2.5 text-[13px] text-apagado">
      {servicos.map((s) => (
        <li key={s.id} className="inline-flex items-center gap-1.5">
          <span aria-hidden data-quadrado className="h-[18px] w-5 rounded-[3px]" style={estiloDaCor(s.cor)} />
          {s.nome}
        </li>
      ))}
      {temAfastado && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="relative h-4 w-6.5"><span data-traco-do-afastado className="afastado-traco" /></span>
          Afastado
        </li>
      )}
      {temChoque && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-4 w-5 rounded-[3px] bg-alerta/10 ring-2 ring-alerta ring-inset" />
          Choque de horário
        </li>
      )}
      <li className="ml-auto max-md:hidden">Para rolar para os lados, segure Shift e gire a roda do mouse.</li>
    </ul>
  );
}
