import { useQuery } from '@tanstack/react-query';
import { consultaRegistroDoPasado } from '@/api/escala-do-mes';
import { Button } from '@/componentes/ui/button';
import { dataEHoraBr } from '@/lib/meses';

/**
 * "Alterações no passado ({n})" (7.4): um botão discreto que abre a lista do registro da escala no mês, da mais nova para a mais velha: quando, quem, a frase pronta e o motivo.
 * Sem nenhuma alteração (ou sem permissão para ler o registro), nada aparece.
 */
export function AlteracoesNoPassado({ escalaId, mes, aberto, aoAlternar }: { escalaId: string; mes: string; aberto: boolean; aoAlternar: () => void }) {
  const registro = useQuery(consultaRegistroDoPasado(escalaId, mes));
  const linhas = registro.data ?? [];
  if (linhas.length === 0) return null;
  return (
    <>
      <Button type="button" variant="discreto" size="sm" aria-expanded={aberto} onClick={aoAlternar}>{`Alterações no passado (${linhas.length})`}</Button>
      {aberto && (
        <section aria-label="Alterações no passado" className="basis-full rounded-xl border border-linha bg-superficie">
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
      )}
    </>
  );
}
