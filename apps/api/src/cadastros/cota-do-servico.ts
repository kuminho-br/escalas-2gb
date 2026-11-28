// A cota de um serviço PJES ou diária num mês, lida do banco para conferir se cabe mais um militar (6.72). A regra em si é `conferirCota`, do motor; aqui só se
// contam os escalados (as alocações do serviço no mês, em escalas da unidade: a mesma contagem das "distribuídas" da tela Cotas) e se escrevem as frases.
import { mesParaData, mesPorExtenso, type DiaDaCota } from 'contratos';
import { conferirCota } from 'dominio';
import type { Consulta } from '../banco/banco.ts';

export type CotaDoServico = { id: string; quantidade: number; dias: DiaDaCota[] };

/** Os dias de cada cota, em ordem de data. */
export async function diasDasCotas(c: Consulta, cotaIds: string[]): Promise<Map<string, DiaDaCota[]>> {
  const porCota = new Map<string, DiaDaCota[]>();
  if (!cotaIds.length) return porCota;
  const { rows } = await c.query<{ cota_id: string; data: string; minimo: number; maximo: number | null }>(
    "select cota_id, to_char(data, 'YYYY-MM-DD') as data, minimo, maximo from cota_dia where cota_id = any($1::uuid[]) order by data",
    [cotaIds],
  );
  for (const r of rows) porCota.set(r.cota_id, [...(porCota.get(r.cota_id) ?? []), { data: r.data, minimo: r.minimo, maximo: r.maximo }]);
  return porCota;
}

/** A cota do serviço no mês (uma só por unidade, mês e serviço), com os dias; null se não há. */
export async function cotaDoServico(c: Consulta, unidadeId: string, servicoId: string, mes: string): Promise<CotaDoServico | null> {
  const cota = (await c.query<{ id: string; quantidade: number }>('select id, quantidade from cota where unidade_id = $1 and servico_id = $2 and mes = $3::date', [unidadeId, servicoId, mesParaData(mes)])).rows[0];
  if (!cota) return null;
  return { ...cota, dias: (await diasDasCotas(c, [cota.id])).get(cota.id) ?? [] };
}

/** Quantos já estão escalados em cada serviço no mês, e em cada dia (alocações em escalas da unidade). */
export async function escaladosDosServicos(c: Consulta, unidadeId: string, servicoIds: string[], mes: string): Promise<Map<string, { total: number; porDia: Record<string, number> }>> {
  const resultado = new Map<string, { total: number; porDia: Record<string, number> }>();
  if (!servicoIds.length) return resultado;
  const { rows } = await c.query<{ servico_id: string; data: string; n: number }>(
    `select a.servico_id, to_char(a.data, 'YYYY-MM-DD') as data, count(*)::int as n
       from alocacao a join escala e on e.id = a.escala_id
      where e.unidade_id = $1 and a.servico_id = any($2::uuid[]) and a.data >= $3::date and a.data < ($3::date + interval '1 month')
      group by a.servico_id, a.data`,
    [unidadeId, servicoIds, mesParaData(mes)],
  );
  for (const r of rows) {
    const x = resultado.get(r.servico_id) ?? { total: 0, porDia: {} };
    x.total += r.n;
    x.porDia[r.data] = r.n;
    resultado.set(r.servico_id, x);
  }
  return resultado;
}

const ddmm = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/**
 * A frase da recusa de pôr mais um militar neste serviço neste dia, ou null se cabe. Sem cota do serviço no mês, a cota não limita nada (a tela "Adicionar serviço"
 * é quem só mostra o serviço PJES ou diária que tem cota). `nomeDoServico` entra nas frases.
 */
export async function recusaDaCota(c: Consulta, d: { unidadeId: string; servicoId: string; nomeDoServico: string; data: string }): Promise<string | null> {
  const mes = d.data.slice(0, 7);
  const cota = await cotaDoServico(c, d.unidadeId, d.servicoId, mes);
  if (!cota) return null;
  const escalados = (await escaladosDosServicos(c, d.unidadeId, [d.servicoId], mes)).get(d.servicoId) ?? { total: 0, porDia: {} };
  const recusa = conferirCota({ quantidade: cota.quantidade, dias: cota.dias, escaladosNoMes: escalados.total, escaladosPorDia: escalados.porDia, data: d.data });
  if (recusa === 'esgotada') return `A cota de ${d.nomeDoServico} em ${mesPorExtenso(mes)} acabou. Para escalar mais, aumente a cota na tela Cotas.`;
  if (recusa === 'maximo_do_dia') return `${d.nomeDoServico} já tem o máximo da cota em ${ddmm(d.data)}.`;
  if (recusa === 'reservada') return `O que resta da cota de ${d.nomeDoServico} está reservado para os dias com meta. Para escalar mais, aumente a cota na tela Cotas.`;
  return null;
}
