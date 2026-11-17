import { bancoPglite, type Banco, type Consulta } from '../src/banco/banco.ts';
import { migrar } from '../src/banco/migrar.ts';

/** Banco novo em memória, com todas as migrações aplicadas. */
export async function bancoDeTeste(): Promise<Banco> {
  const banco = await bancoPglite();
  await migrar(banco);
  return banco;
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
