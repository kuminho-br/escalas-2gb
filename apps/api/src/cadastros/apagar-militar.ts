// Apagar um militar com tudo o que é dele (entrega 6.13). As tabelas vêm do catálogo do banco (as chaves estrangeiras), para a exclusão não
// envelhecer quando nascer uma tabela nova: a linha que aponta para o que sai é apagada antes (filhos primeiro); onde a coluna aceita vazio
// (o turno dos oficiais, o "quem registrou" das linhas de outros militares), a linha fica e só a referência sai. A conta (o usuário) vai junto.
import type { OQueVaiJunto } from 'contratos';
import type { Consulta } from '../banco/banco.ts';

type Ligacao = { tabela: string; coluna: string; alvo: string; alvoColuna: string; aceitaVazio: boolean };

async function ligacoes(tx: Consulta): Promise<Ligacao[]> {
  const { rows } = await tx.query<{ tabela: string; coluna: string; alvo: string; alvo_coluna: string; aceita_vazio: boolean }>(
    `select c.conrelid::regclass::text as tabela, a.attname as coluna, c.confrelid::regclass::text as alvo, fa.attname as alvo_coluna, not a.attnotnull as aceita_vazio
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = c.confkey[1]
      where c.contype = 'f' and array_length(c.conkey, 1) = 1`,
  );
  return rows.map((r) => ({ tabela: r.tabela, coluna: r.coluna, alvo: r.alvo, alvoColuna: r.alvo_coluna, aceitaVazio: r.aceita_vazio }));
}

/** Os nomes vêm do catálogo do próprio banco; ainda assim, só passam identificadores simples. */
const nome = (n: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(n)) throw new Error(`Nome inesperado no catálogo: ${n}`);
  return n;
};

/**
 * Percorre o que sai junto com as linhas de `tabela` em que `coluna` está em `valores`: devolve quantas linhas de cada tabela seriam apagadas e,
 * com `apagar`, apaga (e esvazia as referências que aceitam vazio). Tudo na transação de quem chama.
 */
async function percorrer(tx: Consulta, todas: Ligacao[], tabela: string, coluna: string, valores: unknown[], apagar: boolean, contas: Map<string, Set<string>>, visitadas: Set<string>) {
  if (!valores.length) return;
  const chave = `${tabela}.${coluna}:${valores.join(',')}`;
  if (visitadas.has(chave)) return;
  visitadas.add(chave);
  for (const l of todas.filter((x) => x.alvo === tabela)) {
    const alvos = (await tx.query<{ v: unknown }>(`select ${nome(l.alvoColuna)} as v from ${nome(tabela)} where ${nome(coluna)} = any($1)`, [valores])).rows.map((r) => r.v);
    if (!alvos.length) continue;
    if (l.aceitaVazio) {
      if (apagar) await tx.query(`update ${nome(l.tabela)} set ${nome(l.coluna)} = null where ${nome(l.coluna)} = any($1)`, [alvos]);
      continue;
    }
    await percorrer(tx, todas, l.tabela, l.coluna, alvos, apagar, contas, visitadas);
  }
  // cada linha conta uma vez, mesmo alcançada por dois caminhos (as mesmas contagens no GET e no DELETE)
  const linhas = (await tx.query<{ l: string }>(`select ctid::text as l from ${nome(tabela)} where ${nome(coluna)} = any($1)`, [valores])).rows.map((r) => r.l);
  const ja = contas.get(tabela) ?? new Set<string>();
  for (const l of linhas) ja.add(l);
  contas.set(tabela, ja);
  if (apagar && linhas.length) await tx.query(`delete from ${nome(tabela)} where ${nome(coluna)} = any($1)`, [valores]);
}

async function rodar(tx: Consulta, militarIds: string[], apagar: boolean): Promise<Map<string, number>> {
  const contas = new Map<string, Set<string>>();
  const todas = await ligacoes(tx);
  const visitadas = new Set<string>();
  // a permuta precisa de exatamente 2 itens: a que tem um item dele sai inteira (os dois itens), e a alocação do outro militar fica
  const permutas = (
    await tx.query<{ permuta_id: string }>(
      'select distinct permuta_id from permuta_item where militar_original_id = any($1) or alocacao_id in (select id from alocacao where militar_id = any($1))',
      [militarIds],
    )
  ).rows.map((r) => r.permuta_id);
  await percorrer(tx, todas, 'permuta', 'id', permutas, apagar, contas, visitadas);
  await percorrer(tx, todas, 'militar', 'id', militarIds, apagar, contas, visitadas);
  // as contagens saem na ordem em que as tabelas foram esvaziadas: o que depende vem antes do que é dependido
  return new Map([...contas].map(([t, l]) => [t, l.size]));
}

/**
 * O que sai (ou, com `apagar`, o que é apagado) com vários militares de uma vez, na ordem da exclusão: cada linha conta uma vez, mesmo alcançada por
 * dois deles (a permuta entre dois militares, por exemplo). É o que a separação dos dados de teste (6.58) usa.
 */
export async function contagemParaVarios(tx: Consulta, militarIds: string[], apagar: boolean): Promise<Map<string, number>> {
  return militarIds.length ? rodar(tx, militarIds, apagar) : new Map();
}

/** O que sai junto: as mesmas contagens que `apagarMilitar` apaga. */
export async function oQueVaiJunto(tx: Consulta, militarId: string): Promise<OQueVaiJunto> {
  const c = await rodar(tx, [militarId], false);
  const de = (t: string) => c.get(t) ?? 0;
  // a sessão e a senha fazem parte da conta (temConta): não entram em "outros"
  const contados = ['militar', 'alocacao', 'afastamento', 'rastreio', 'usuario', 'papel_usuario', 'sessao', 'conta'];
  return {
    alocacoes: de('alocacao'),
    afastamentos: de('afastamento'),
    periodosDoRastreio: de('rastreio'),
    temConta: de('usuario') > 0,
    niveisDeAcesso: de('papel_usuario'),
    outros: [...c].filter(([t]) => !contados.includes(t)).reduce((s, [, n]) => s + n, 0),
  };
}

export async function apagarMilitar(tx: Consulta, militarId: string): Promise<void> {
  await rodar(tx, [militarId], true);
}
