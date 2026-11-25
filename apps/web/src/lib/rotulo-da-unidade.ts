import type { UnidadeDaArvore } from '@/lib/arvore-de-unidades';

/**
 * O nome da unidade numa lista (7.5, 6.53): só a sigla, e, quando a mesma sigla aparece em mais de uma unidade da lista (a 1ª SB do 2º GB e a do 3º GB), a sigla com a unidade de cima
 * ("1ª SB, em DivOp"). `daLista`: as unidades que a lista mostra; `todas`: a árvore, de onde vem a unidade de cima (sem ela, só a sigla).
 */
export function rotuloDaUnidade(unidade: { id: string; sigla: string }, daLista: { id: string; sigla: string }[], todas: UnidadeDaArvore[] | undefined): string {
  const repetida = new Set(daLista.filter((u) => u.sigla === unidade.sigla).map((u) => u.id)).size > 1;
  if (!repetida) return unidade.sigla;
  const maeId = todas?.find((u) => u.id === unidade.id)?.maeId;
  const mae = maeId ? todas?.find((u) => u.id === maeId)?.sigla : undefined;
  return mae ? `${unidade.sigla}, em ${mae}` : unidade.sigla;
}
