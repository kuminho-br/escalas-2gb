// A unidade de trabalho em degraus (6.61): as regras puras, sobre os nós de `montarArvore`. Um degrau por nível do caminho da unidade; cada nível mostra só as
// unidades de dentro do degrau de cima.
import type { No } from './arvore-de-unidades';

export type Degrau = { no: No; opcoes: No[] };

/** O caminho do alto até a unidade, um degrau por nível, cada um com as opções que ficam dentro do degrau anterior (as do alto, no primeiro). Vazio se a unidade não está na árvore. */
export function degrausDoCaminho(arvore: No[], unidadeId: string): Degrau[] {
  const achar = (lista: No[]): No[] | null => {
    for (const n of lista) {
      if (n.id === unidadeId) return [n];
      const dentro = achar(n.filhos);
      if (dentro) return [n, ...dentro];
    }
    return null;
  };
  const caminho = achar(arvore) ?? [];
  return caminho.map((no, i) => ({ no, opcoes: i === 0 ? arvore : caminho[i - 1]!.filhos }));
}

/**
 * O próximo nível, o que vem tracejado depois do último degrau: o nome do tipo das unidades de baixo (do cadastro; "Unidade" se forem de tipos diferentes ou o tipo
 * ainda não chegou) e se a escolha é obrigatória (o último degrau é uma "passagem", que não vira a unidade de trabalho). Sem unidades de baixo, null.
 */
export function proximoNivel(no: No): { rotulo: string; obrigatorio: boolean } | null {
  if (no.filhos.length === 0) return null;
  const tipos = new Set(no.filhos.map((f) => f.tipoNome ?? ''));
  const [unico] = [...tipos];
  return { rotulo: tipos.size === 1 && unico ? unico : 'Unidade', obrigatorio: no.passagem };
}
