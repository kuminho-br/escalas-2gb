// A cota de saldo do Adm à vista (6.38): quantos Saldos o militar tem no mês, em qualquer escala e unidade, contra o parâmetro "Saldos por militar do Adm".
import type { SaldosDoMes } from 'contratos';
import { diasDoMes } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { parametroEmVigor } from '../cadastros/configuracoes.ts';

/** Os saldos do mês de cada militar (os que não têm nenhum entram com 0) e o total do parâmetro em vigor na unidade. Passar do total é permitido: `feitos` pode ser maior. */
export async function cotasDeSaldo(c: Consulta, unidadeId: string, militarIds: string[], mes: string): Promise<Map<string, SaldosDoMes>> {
  const cotas = new Map<string, SaldosDoMes>();
  if (!militarIds.length) return cotas;
  const total = Number(await parametroEmVigor(c, unidadeId, 'SALDOS_ADM_POR_MILITAR', mes));
  const dias = diasDoMes(mes);
  const { rows } = await c.query<{ militar_id: string; n: number }>(
    `select a.militar_id, count(*)::int as n
       from alocacao a join servico s on s.id = a.servico_id
      where a.militar_id = any($1::uuid[]) and a.data between $2::date and $3::date and lower(btrim(s.nome)) = 'saldo'
      group by a.militar_id`,
    [[...new Set(militarIds)], dias[0]!, dias[dias.length - 1]!],
  );
  for (const id of militarIds) cotas.set(id, { feitos: rows.find((r) => r.militar_id === id)?.n ?? 0, total });
  return cotas;
}
