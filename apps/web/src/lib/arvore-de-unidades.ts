// A árvore de unidades montada no navegador (6.45): toda escolha de unidade é feita por ela, nó a nó. As listas da API trazem cada unidade com a
// unidade de cima (`maeId`); aqui elas viram nós, com as "passagens" (as unidades de cima que a pessoa não pode escolher, mas que dão lugar às de baixo).

export type UnidadeDaArvore = { id: string; sigla: string; maeId: string | null };

export interface No {
  id: string;
  sigla: string;
  /** A profundidade na árvore montada (0 no alto). */
  nivel: number;
  /** Está na árvore só para dar lugar às de baixo: aparece apagada e não é escolhível. */
  passagem: boolean;
  /** As siglas do alto até este nó. */
  caminho: string[];
  filhos: No[];
}

const ORDEM = new Intl.Collator('pt-BR', { numeric: true });

/**
 * Monta a árvore das unidades que a pessoa pode escolher. `todas` é a árvore inteira da corporação: com ela, a unidade permitida cuja mãe não é
 * permitida fica debaixo da mãe, que entra como passagem. Sem `todas` (ou enquanto ela não chega), a unidade de mãe desconhecida fica no alto:
 * nunca some. Os irmãos vêm pela sigla (a 2ª SB antes da 10ª SB).
 */
export function montarArvore(unidades: UnidadeDaArvore[], todas: UnidadeDaArvore[] = []): No[] {
  const conhecidas = new Map<string, UnidadeDaArvore>();
  for (const x of todas) conhecidas.set(x.id, x);
  for (const x of unidades) conhecidas.set(x.id, x);
  const permitidas = new Set(unidades.map((x) => x.id));
  // entram as permitidas e as de cima delas, até onde a árvore conhecida alcança
  const dentro = new Set<string>();
  for (const x of unidades) {
    for (let atual: UnidadeDaArvore | undefined = x; atual && !dentro.has(atual.id); atual = atual.maeId ? conhecidas.get(atual.maeId) : undefined) dentro.add(atual.id);
  }
  const filhosDe = new Map<string | null, UnidadeDaArvore[]>();
  for (const id of dentro) {
    const x = conhecidas.get(id)!;
    const mae = x.maeId && dentro.has(x.maeId) ? x.maeId : null;
    filhosDe.set(mae, [...(filhosDe.get(mae) ?? []), x]);
  }
  const montar = (mae: string | null, nivel: number, caminho: string[]): No[] =>
    (filhosDe.get(mae) ?? [])
      .sort((a, b) => ORDEM.compare(a.sigla, b.sigla))
      .map((x) => {
        const dele = [...caminho, x.sigla];
        return { id: x.id, sigla: x.sigla, nivel, passagem: !permitidas.has(x.id), caminho: dele, filhos: montar(x.id, nivel + 1, dele) };
      });
  return montar(null, 0, []);
}

/** Todos os nós, na ordem da árvore (a mãe antes das filhas). */
export function todosOsNos(nos: No[]): No[] {
  return nos.flatMap((n) => [n, ...todosOsNos(n.filhos)]);
}

/** Os ids dos nós de cima de `id` (do alto até a mãe); vazio se ele está no alto ou não está na árvore. */
export function acimaDe(nos: No[], id: string): string[] {
  const achar = (lista: No[]): string[] | null => {
    for (const n of lista) {
      if (n.id === id) return [];
      const dentro = achar(n.filhos);
      if (dentro) return [n.id, ...dentro];
    }
    return null;
  };
  return achar(nos) ?? [];
}

/** A unidade `id` e todas as de baixo dela: o filtro por um nó da árvore pega a subárvore. */
export function abaixoDe(unidades: UnidadeDaArvore[], id: string): Set<string> {
  const dentro = new Set([id]);
  for (let cresceu = true; cresceu; ) {
    cresceu = false;
    for (const x of unidades) {
      if (x.maeId && dentro.has(x.maeId) && !dentro.has(x.id)) {
        dentro.add(x.id);
        cresceu = true;
      }
    }
  }
  return dentro;
}

/** O nome do nó para o leitor de tela: a sigla e a unidade em que ela fica ("DA, em 1º GB"); o recuo é só visual. */
export const nomeDoNo = (n: Pick<No, 'sigla' | 'caminho'>) => (n.caminho.length > 1 ? `${n.sigla}, em ${n.caminho.at(-2)}` : n.sigla);

/** O texto curto da unidade escolhida: a de cima e ela ("DivOp / 2ª SB"), porque a mesma sigla existe em mais de um lugar. */
export const textoDoNo = (n: Pick<No, 'sigla' | 'caminho'>) => n.caminho.slice(-2).join(' / ');
