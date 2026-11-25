import { useQuery } from '@tanstack/react-query';
import { mensagemDe } from '@/api/cliente';
import { consultaRegistroDoVoluntariado } from '@/api/voluntariado';

const FORMATO = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' });
/** "25/11/2026 às 11:30", no horário de Recife. */
const quando = (iso: string) => FORMATO.format(new Date(iso)).replace(', ', ' às ');

/** As correções que o escalante fez no que o militar marcou neste mês: quando, quem e a frase do registro, da mais nova para a mais velha. */
export function RegistroDeCorrecoes({ militarId, mes }: { militarId: string; mes: string }) {
  const registro = useQuery(consultaRegistroDoVoluntariado(militarId, mes));
  return (
    <section aria-label="Correções" className="grid gap-2 rounded-xl border border-linha bg-superficie p-4">
      <h3 className="font-cond text-lg font-semibold">Correções</h3>
      <p className="text-sm text-apagado">Este mês foi preenchido pelo militar. O que o escalante mudou depois fica aqui.</p>
      {registro.error && <p role="alert" className="text-sm text-alerta">{mensagemDe(registro.error)}</p>}
      <ul className="grid gap-2">
        {registro.data?.map((r) => (
          <li key={r.id} className="grid gap-0.5 border-t border-linha pt-2 first:border-t-0 first:pt-0">
            <span>{r.texto}</span>
            <span className="text-sm text-apagado">{`${r.por ? `por ${r.por.patente} ${r.por.nomeGuerra} · ` : ''}${quando(r.em)}`}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
