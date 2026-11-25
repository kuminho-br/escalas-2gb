// A prévia de uma escala num mês (fase 7.3): lançada, a corporação lê a escala e o passado dela passa a pedir justificativa. Existir a linha em `escala_previa` é estar lançada.
import { mesParaData } from 'contratos';
import type { Consulta } from '../banco/banco.ts';

export type PreviaLancada = { em: string; por: { patente: string; nomeGuerra: string } | null };

/** A prévia lançada da escala no mês, com quem lançou e quando (ISO em UTC); null se é rascunho. */
export async function previaLancada(c: Consulta, escalaId: string, mes: string): Promise<PreviaLancada | null> {
  const { rows } = await c.query<{ em: string; patente: string | null; nome_guerra: string | null }>(
    `select to_char(k.lancada_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as em, p.sigla as patente, m.nome_guerra
       from escala_previa k
       left join usuario u on u.id = k.lancada_por left join militar m on m.id = u.militar_id left join posto_grad p on p.id = m.posto_grad_id
      where k.escala_id = $1 and k.mes = $2::date`,
    [escalaId, mesParaData(mes)],
  );
  const r = rows[0];
  if (!r) return null;
  return { em: r.em, por: r.patente && r.nome_guerra ? { patente: r.patente, nomeGuerra: r.nome_guerra } : null };
}

/** Lança a prévia (lançar de novo não muda nada, nem quem lançou) ou recolhe (apaga a linha; recolher o que não está lançado também não é erro). */
export async function mudarPrevia(tx: Consulta, escalaId: string, mes: string, lancada: boolean, usuarioId: string): Promise<void> {
  if (lancada) {
    await tx.query('insert into escala_previa (escala_id, mes, lancada_por) values ($1, $2::date, $3) on conflict (escala_id, mes) do nothing', [escalaId, mesParaData(mes), usuarioId]);
  } else {
    await tx.query('delete from escala_previa where escala_id = $1 and mes = $2::date', [escalaId, mesParaData(mes)]);
  }
}
