import type { Consulta } from './banco/banco.ts';

// Na fase de teste, a unidade é fixa (especificação de telas, "Navegação").
const SIGLA_DA_FASE_DE_TESTE = '1ª SB';

/** A unidade em que as telas trabalham, com o caminho de siglas desde a raiz. */
export async function unidadeAtual(c: Consulta): Promise<{ id: string; sigla: string; caminho: string[] }> {
  const { rows } = await c.query<{ id: string; sigla: string; alvo: boolean }>(
    `select a.id, a.sigla, a.id = u.id as alvo
       from unidade u join unidade a on a.caminho @> u.caminho
      where u.sigla = $1
      order by nlevel(a.caminho)`,
    [SIGLA_DA_FASE_DE_TESTE],
  );
  const alvo = rows.find((r) => r.alvo);
  if (!alvo) throw new Error(`Unidade ${SIGLA_DA_FASE_DE_TESTE} não cadastrada.`);
  return { id: alvo.id, sigla: alvo.sigla, caminho: rows.map((r) => r.sigla) };
}
