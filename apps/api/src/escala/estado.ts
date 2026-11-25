// Os estados da escala num mês (fase 7.3.1): rascunho (sem linha), prévia, publicada, retificada e remessada. A prévia só é vista pela unidade da escala e pelas de baixo, a publicada por toda a
// corporação; mexer numa escala publicada acende sozinho "Escala em retificação" até o gestor republicar; a remessada só o administrador altera (a remessa em si é da fase 9).
import { mesParaData, type EstadoDoMes } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import { Recusa } from './alocacoes.ts';

export const MSG_JA_PUBLICADA = 'Esta escala já foi publicada.';
export const MSG_AINDA_NAO_PUBLICADA = 'Esta escala ainda não foi publicada.';
export const MSG_NAO_ESTA_EM_RETIFICACAO = 'Esta escala não está em retificação.';
export const MSG_JA_REMESSADA = 'Esta escala já foi remessada.';
export const MSG_SO_GESTOR_PUBLICA = 'Só o gestor publica a escala.';

/** O estado da escala no mês, com quando e por quem passou para ele (`por`: "SD FULANO", ISO em UTC); sem linha é rascunho. */
export async function estadoDoMes(c: Consulta, escalaId: string, mes: string): Promise<EstadoDoMes> {
  const { rows } = await c.query<{ estado: EstadoDoMes['estado']; em_retificacao: boolean; em: string; patente: string | null; nome_guerra: string | null }>(
    `select k.estado, k.em_retificacao, to_char(k.mudou_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as em, p.sigla as patente, m.nome_guerra
       from escala_estado k
       left join usuario u on u.id = k.mudou_por left join militar m on m.id = u.militar_id left join posto_grad p on p.id = m.posto_grad_id
      where k.escala_id = $1 and k.mes = $2::date`,
    [escalaId, mesParaData(mes)],
  );
  const r = rows[0];
  if (!r) return { estado: 'rascunho', emRetificacao: false, em: null, por: null };
  return { estado: r.estado, emRetificacao: r.em_retificacao, em: r.em, por: r.patente && r.nome_guerra ? `${r.patente} ${r.nome_guerra}` : null };
}

/**
 * A passagem de estado: lançar a prévia (do rascunho), publicar (do rascunho ou da prévia) e republicar (de uma escala em retificação). Repetir a mesma passagem não é erro
 * (lançar a prévia de uma prévia, publicar uma publicada); a que volta ou pula a regra lança `Recusa` (409) com a frase fixa. Duas passagens ao mesmo tempo na mesma escala e mês esperam uma pela outra.
 */
/** A chave da trava do estado de uma escala num mês: a passagem a toma exclusiva; quem altera a escala, compartilhada. */
export const chaveDoEstado = (escalaId: string, mes: string) => `estado|${escalaId}|${mesParaData(mes)}`;

/**
 * Lê o estado para decidir uma alteração (a trava do passado, a retificação): antes, toma a trava COMPARTILHADA da chave da passagem de estado, que dura até o fim da transação. Assim uma passagem
 * (publicar, republicar) em curso espera as alterações que já leram o estado, e uma alteração espera a passagem: ninguém grava contra um estado que já mudou.
 */
export async function estadoParaAlterar(tx: Consulta, escalaId: string, mes: string): Promise<EstadoDoMes> {
  await tx.query('select pg_advisory_xact_lock_shared(hashtext($1))', [chaveDoEstado(escalaId, mes)]);
  return estadoDoMes(tx, escalaId, mes);
}

export async function mudarEstado(tx: Consulta, escalaId: string, mes: string, para: 'previa' | 'publicada' | 'republicar', usuarioId: string): Promise<void> {
  const data = mesParaData(mes);
  await tx.query('select pg_advisory_xact_lock(hashtext($1))', [chaveDoEstado(escalaId, mes)]);
  const atual = (await tx.query<{ estado: EstadoDoMes['estado']; em_retificacao: boolean }>('select estado, em_retificacao from escala_estado where escala_id = $1 and mes = $2::date', [escalaId, data])).rows[0];
  const grava = (estado: 'previa' | 'publicada' | 'retificada') =>
    tx.query(
      `insert into escala_estado (escala_id, mes, estado, em_retificacao, mudou_por) values ($1, $2::date, $3, false, $4)
       on conflict (escala_id, mes) do update set estado = excluded.estado, em_retificacao = false, mudou_por = excluded.mudou_por, mudou_em = now()`,
      [escalaId, data, estado, usuarioId],
    );
  if (para === 'previa') {
    if (!atual) return void (await grava('previa'));
    if (atual.estado === 'previa') return;
    throw new Recusa(MSG_JA_PUBLICADA);
  }
  if (para === 'publicada') {
    if (atual?.estado === 'remessada') throw new Recusa(MSG_JA_REMESSADA);
    if (atual?.estado === 'publicada' || atual?.estado === 'retificada') return;
    return void (await grava('publicada'));
  }
  if (!atual || atual.estado === 'previa') throw new Recusa(MSG_AINDA_NAO_PUBLICADA);
  if (atual.estado === 'remessada') throw new Recusa(MSG_JA_REMESSADA);
  if (!atual.em_retificacao) throw new Recusa(MSG_NAO_ESTA_EM_RETIFICACAO);
  await grava('retificada');
}

/** A primeira mudança numa escala publicada ou retificada acende "Escala em retificação" (na mesma transação da mudança). Em rascunho, prévia e remessada, não faz nada. */
export async function marcarRetificacao(tx: Consulta, escalas: { escalaId: string; mes: string }[]): Promise<void> {
  for (const e of escalas) {
    await tx.query("update escala_estado set em_retificacao = true where escala_id = $1 and mes = $2::date and estado in ('publicada', 'retificada') and not em_retificacao", [e.escalaId, mesParaData(e.mes)]);
  }
}
