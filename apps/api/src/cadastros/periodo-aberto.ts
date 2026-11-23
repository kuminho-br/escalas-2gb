// O período aberto do rastreio de um militar: o quadro e a situação valem por período, como a lotação. Mudar um deles fecha o período e abre outro.
import type { Consulta } from '../banco/banco.ts';

export type PeriodoAberto = { id: string; desde: string; unidade_id: string; equipe_id: string | null; jornada: 'pronto' | 'adm'; quadro_id: string | null; situacao_id: string };

/** O período aberto (sem fim) do militar, com a linha travada para a transação; undefined se ele não tem. */
export async function periodoAberto(tx: Consulta, militarId: string): Promise<PeriodoAberto | undefined> {
  return (
    await tx.query<PeriodoAberto>(
      `select id, to_char(desde, 'YYYY-MM-DD') as desde, unidade_id, equipe_id, jornada, quadro_id, situacao_id
         from rastreio where militar_id = $1 and ate is null for update`,
      [militarId],
    )
  ).rows[0];
}

/**
 * Muda o quadro e/ou a situação do período aberto a partir de `hoje`: se o período começou hoje (ou depois), ele é ajustado no lugar; senão, termina
 * na véspera e outro, igual a ele, abre hoje com a mudança. Devolve se mudou alguma coisa.
 */
export async function mudarPeriodoAberto(tx: Consulta, militarId: string, hoje: string, mudanca: { quadroId?: string | null; situacaoId?: string }): Promise<boolean> {
  const aberto = await periodoAberto(tx, militarId);
  if (!aberto) return false;
  const quadroId = mudanca.quadroId === undefined ? aberto.quadro_id : mudanca.quadroId;
  const situacaoId = mudanca.situacaoId ?? aberto.situacao_id;
  if (quadroId === aberto.quadro_id && situacaoId === aberto.situacao_id) return false;
  if (aberto.desde >= hoje) {
    await tx.query('update rastreio set quadro_id = $2, situacao_id = $3 where id = $1', [aberto.id, quadroId, situacaoId]);
    return true;
  }
  await tx.query("update rastreio set ate = $2::date - interval '1 day' where id = $1", [aberto.id, hoje]);
  await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, quadro_id, situacao_id) values ($1, $2, $3, $4, $5, $6, $7)', [
    militarId, aberto.unidade_id, aberto.equipe_id, aberto.jornada, hoje, quadroId, situacaoId,
  ]);
  return true;
}
