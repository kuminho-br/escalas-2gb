// A árvore de unidades como lista: cada unidade com a cadeia de siglas até a raiz, e a ordem da árvore (o pai antes dos filhos, e os irmãos pela
// sigla). O /api/eu e a consulta de militares usam a mesma ordem.
import type { UnidadeDeTrabalho } from 'contratos';

const ORDEM = new Intl.Collator('pt-BR', { numeric: true });
/** A ordem da árvore: o pai antes dos filhos, e os irmãos pela sigla. */
export const porCaminho = (a: UnidadeDeTrabalho, b: UnidadeDeTrabalho) => {
  for (let i = 0; i < Math.min(a.caminho.length, b.caminho.length); i++) {
    const c = ORDEM.compare(a.caminho[i]!, b.caminho[i]!);
    if (c) return c;
  }
  return a.caminho.length - b.caminho.length;
};

export const COM_CAMINHO = `select u.id, u.sigla, u.tipo, u.mae_id, array(select a.sigla from unidade a where a.caminho @> u.caminho order by nlevel(a.caminho)) as caminho from unidade u`;
export type LinhaDaUnidade = { id: string; sigla: string; tipo: string; mae_id: string | null; caminho: string[] };
export const paraUnidade = (r: LinhaDaUnidade): UnidadeDeTrabalho => ({ id: r.id, sigla: r.sigla, caminho: r.caminho, nivel: r.caminho.length - 1, tipo: r.tipo, maeId: r.mae_id });

