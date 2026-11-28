// O agrupamento do painel "Selecionados" (6.63): vale só para o painel; a lista de resultados segue em ordem de nome de guerra e matrícula. Função pura.
import type { LinhaDaBusca } from 'contratos';

export type AgruparPor = 'nenhum' | 'unidade' | 'equipe' | 'posto';
export type Grupo = { titulo: string | null; linhas: LinhaDaBusca[] };

const COLACAO = new Intl.Collator('pt-BR', { numeric: true });
const porNome = (a: LinhaDaBusca, b: LinhaDaBusca) => COLACAO.compare(a.nomeGuerra, b.nomeGuerra) || COLACAO.compare(a.matricula, b.matricula);

/**
 * Os grupos saem em ordem: unidade pela ordem da árvore (`ordem.unidades`, os ids na ordem em que a árvore os mostra; a que não está nela vai depois, pelo nome), equipe em
 * ordem alfabética e posto pela ordem dos postos (`ordem.postos`, as siglas do mais alto ao mais baixo). Dentro do grupo, nome de guerra e matrícula. "Sem lotação" e "Sem equipe" vão por último.
 */
export function agruparSelecionados(linhas: LinhaDaBusca[], por: AgruparPor, ordem: { unidades?: string[]; postos?: string[] } = {}): Grupo[] {
  if (por === 'nenhum') return [{ titulo: null, linhas: [...linhas].sort(porNome) }];
  const chaveDe = (l: LinhaDaBusca): string => {
    if (por === 'unidade') return l.unidadeId ?? '';
    if (por === 'equipe') return l.equipe ?? '';
    return l.postoGrad;
  };
  const tituloDe = (l: LinhaDaBusca): string => {
    if (por === 'unidade') return l.unidadeId ? (l.lotacaoCaminho ?? l.lotacao ?? 'Sem lotação') : 'Sem lotação';
    if (por === 'equipe') return l.equipe ? `Equipe ${l.equipe}` : 'Sem equipe';
    return l.postoGrad;
  };
  const grupos = new Map<string, Grupo>();
  for (const l of linhas) {
    const k = chaveDe(l);
    const g = grupos.get(k) ?? { titulo: tituloDe(l), linhas: [] };
    g.linhas.push(l);
    grupos.set(k, g);
  }
  const posicao = (lista: string[] | undefined, k: string) => { const i = lista?.indexOf(k) ?? -1; return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  const chaves = [...grupos.keys()].sort((a, b) => {
    // quem não tem o dado (chave vazia) vai por último
    if (a === '' || b === '') return a === b ? 0 : a === '' ? 1 : -1;
    if (por === 'unidade') return posicao(ordem.unidades, a) - posicao(ordem.unidades, b) || COLACAO.compare(grupos.get(a)!.titulo ?? '', grupos.get(b)!.titulo ?? '');
    if (por === 'posto') return posicao(ordem.postos, a) - posicao(ordem.postos, b) || COLACAO.compare(a, b);
    return COLACAO.compare(a, b);
  });
  return chaves.map((k) => ({ titulo: grupos.get(k)!.titulo, linhas: grupos.get(k)!.linhas.sort(porNome) }));
}
