import type { Banco, Consulta } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';

/** As migrações só no real, para os testes de uma migração: eles olham o catálogo e partem de pastas parciais, e o espelho (que repete tudo) não é o assunto deles. */
export const migrarReal = (banco: Banco, pasta = PASTA_MIGRACOES) => migrar(banco, pasta, { espelho: false });

/** Banco novo em memória, com todas as migrações aplicadas no real (sem o espelho, que dobraria o tempo de cada banco; os testes do espelho o pedem à parte). */
export async function bancoDeTeste(): Promise<Banco> {
  const banco = await bancoPglite();
  await migrar(banco, PASTA_MIGRACOES, { espelho: false });
  return banco;
}

/** O id de uma situação do militar pelo nome (Ativa, Reserva, Desativado…). */
export async function situacaoDoMilitar(c: Consulta, nome: string): Promise<string> {
  return (await c.query<{ id: string }>('select id from situacao_militar where lower(nome) = lower($1)', [nome])).rows[0]!.id;
}

/** Insere e devolve o id (ou null, para tabelas sem coluna id). */
export async function inserir(c: Consulta, tabela: string, dados: Record<string, unknown>, retorno = 'id'): Promise<string> {
  const cols = Object.keys(dados);
  const marcas = cols.map((_, i) => '$' + (i + 1));
  const { rows } = await c.query<Record<string, string>>(
    `insert into ${tabela} (${cols.join(', ')}) values (${marcas.join(', ')}) returning ${retorno}`,
    Object.values(dados),
  );
  return rows[0]![retorno]!;
}

/**
 * O id de uma das equipes padrão da corporação (6.64) pelo nome: Alfa, Bravo, Charlie, Delta, ADM ou Externa. A migração as cria na unidade raiz; as telas e o motor leem as equipes do
 * Pronto por elas (pela posição), então os testes que dependem do ciclo usam estas, e não uma equipe própria da seção.
 */
export async function equipePadrao(c: Consulta, nome: string): Promise<string> {
  return (await c.query<{ id: string }>('select e.id from equipe e join unidade u on u.id = e.unidade_id where u.mae_id is null and lower(e.nome) = lower($1)', [nome])).rows[0]!.id;
}

/**
 * Deixa o ciclo do Pronto com a equipe Alfa só (tira as posições 2 a 4 das padrão): o cenário de testes que montam o Pronto à mão, com poucos militares, numa equipe só, onde as outras
 * posições não têm ninguém. Com as quatro, a pré-escala pesa o Pronto já gravado contra o ciclo inteiro (6.64).
 */
export async function soAlfaNoCiclo(c: Consulta): Promise<void> {
  await c.query("delete from equipe where tipo = 'pronto' and posicao_ciclo > 1");
}
