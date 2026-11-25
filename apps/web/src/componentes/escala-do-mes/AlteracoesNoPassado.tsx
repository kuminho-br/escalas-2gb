import type { RegistroDeAlteracao } from 'contratos';
import { Button } from '@/componentes/ui/button';
import { dataEHoraBr } from '@/lib/meses';

/** O botão "Alterações no passado ({n})" (7.4): fica ao lado dos botões do estado da escala e abre a lista. */
export function BotaoDasAlteracoesNoPassado({ total, aberto, aoAlternar }: { total: number; aberto: boolean; aoAlternar: () => void }) {
  return <Button type="button" variant="discreto" size="sm" aria-expanded={aberto} onClick={aoAlternar}>{`Alterações no passado (${total})`}</Button>;
}

/** A lista do registro da escala no mês, da mais nova para a mais velha: a frase pronta, quem e quando, e o motivo. */
export function ListaDasAlteracoesNoPassado({ linhas }: { linhas: RegistroDeAlteracao[] }) {
  return (
    <section aria-label="Alterações no passado" className="basis-full rounded-xl border border-linha">
      <ul className="divide-y divide-linha">
        {linhas.map((l) => (
          <li key={l.id} className="grid gap-0.5 px-4 py-2.5">
            <span className="text-corpo">{l.texto}</span>
            <span className="text-apoio text-apagado">{`${l.por ? `${l.por.patente} ${l.por.nomeGuerra}` : 'Alguém'}, ${dataEHoraBr(l.em)}`}</span>
            {l.justificativa && <span className="text-apoio text-apagado">{`Motivo: ${l.justificativa}`}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
