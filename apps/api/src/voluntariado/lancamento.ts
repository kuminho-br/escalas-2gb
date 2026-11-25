// Lançar o voluntariado de um militar num mês (tela "Voluntariado" › "Lançar à mão"): o lançamento substitui o mês inteiro.
import { mesParaData, type FaixaDeDisponibilidade } from 'contratos';
import { unirFaixas, type Faixa } from 'dominio';
import type { Consulta } from '../banco/banco.ts';

/** "08:00" -> 480; "24:00" -> 1440. */
const minutosDe = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));

/**
 * Na mesma transação: apaga todas as faixas do militar no mês (de qualquer origem, inclusive importação), grava as novas com a origem dada — `manual`
 * (o escalante lançou) ou `militar` (ele mesmo marcou), as de um mesmo dia que se tocam viram uma só — e registra quem lançou e quando. Lista vazia vale:
 * o militar passa a "já lançado" com 0 horas. `pelo_militar` vira verdadeiro quando o militar marca e nunca volta a falso: quem corrige depois é o escalante,
 * e o registro da correção é de quem chama.
 */
export async function lancar(tx: Consulta, militarId: string, mes: string, faixas: FaixaDeDisponibilidade[], usuarioId: string, origem: 'manual' | 'militar' = 'manual'): Promise<void> {
  const inicio = mesParaData(mes);
  await tx.query(`delete from disponibilidade where militar_id = $1 and data >= $2::date and data < ($2::date + interval '1 month')`, [militarId, inicio]);
  const porDia = new Map<string, Faixa[]>();
  for (const f of faixas) porDia.set(f.data, [...(porDia.get(f.data) ?? []), { inicio: minutosDe(f.inicio), fim: minutosDe(f.fim) }]);
  const unidas = [...porDia.entries()].flatMap(([data, lista]) => unirFaixas(lista).map((f) => ({ data, ...f })));
  if (unidas.length) {
    await tx.query(
      `insert into disponibilidade (militar_id, data, inicio_min, fim_min, origem)
       select $1, x.d, x.i, x.f, $5 from unnest($2::date[], $3::int[], $4::int[]) as x(d, i, f)`,
      [militarId, unidas.map((u) => u.data), unidas.map((u) => u.inicio), unidas.map((u) => u.fim), origem],
    );
  }
  await tx.query(
    `insert into voluntariado_lancamento (militar_id, mes, lancado_por, pelo_militar) values ($1, $2::date, $3, $4)
       on conflict (militar_id, mes) do update set lancado_por = excluded.lancado_por, lancado_em = now(), pelo_militar = voluntariado_lancamento.pelo_militar or excluded.pelo_militar`,
    [militarId, inicio, usuarioId, origem === 'militar'],
  );
}
