// Lançar o voluntariado de um militar num mês (tela "Voluntariado" › "Lançar à mão"): o lançamento substitui o mês inteiro.
import { mesParaData, type MarcaDeVoluntariado } from 'contratos';
import type { Consulta } from '../banco/banco.ts';

/**
 * Na mesma transação: apaga todas as marcações do militar no mês (de qualquer origem, inclusive importação), grava as novas
 * como lançamento manual e registra quem lançou e quando. Lista vazia vale: o militar passa a "já lançado" com 0 dias.
 */
export async function lancar(tx: Consulta, militarId: string, mes: string, marcas: MarcaDeVoluntariado[], usuarioId: string): Promise<void> {
  const inicio = mesParaData(mes);
  await tx.query(`delete from voluntariado where militar_id = $1 and data >= $2::date and data < ($2::date + interval '1 month')`, [militarId, inicio]);
  if (marcas.length) {
    await tx.query(
      `insert into voluntariado (militar_id, data, turno_padrao, origem) select $1, x.d, x.t, 'manual' from unnest($2::date[], $3::text[]) as x(d, t)`,
      [militarId, marcas.map((m) => m.data), marcas.map((m) => m.turno)],
    );
  }
  await tx.query(
    `insert into voluntariado_lancamento (militar_id, mes, lancado_por) values ($1, $2::date, $3)
       on conflict (militar_id, mes) do update set lancado_por = excluded.lancado_por, lancado_em = now()`,
    [militarId, inicio, usuarioId],
  );
}
