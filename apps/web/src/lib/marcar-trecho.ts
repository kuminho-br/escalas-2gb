// O trecho achado fica marcado na linha da pesquisa (6.63): a mesma regra da busca, sem diferenciar maiúsculas nem acentos. Função pura.

/** O texto sem acento e em minúsculas, caractere a caractere (o tamanho de cada pedaço pode mudar, por isso o mapa de volta ao original). */
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Só letras e dígitos: a matrícula "100601-1" também é achada como "1006011". */
const alfanumerico = (c: string) => /[\p{L}\p{N}]/u.test(c);

type Projecao = { texto: string; origem: number[] };

/** O texto como a busca o enxerga (`aceita` tira os caracteres que ela ignora) e, para cada caractere dele, o índice do caractere de onde veio no original. */
function projetar(original: string, aceita: (c: string) => boolean): Projecao {
  let texto = '';
  const origem: number[] = [];
  for (let i = 0; i < original.length; i++) {
    for (const c of semAcento(original[i]!)) {
      if (!aceita(c)) continue;
      texto += c;
      origem.push(i);
    }
  }
  return { texto, origem };
}

/**
 * Divide `texto` em pedaços na grafia original; `marcado` é o pedaço em que alguma das `palavras` foi achada. Uma palavra só de dígitos também é achada sem o traço
 * da matrícula. Palavras vazias não marcam nada.
 */
export function marcarTrecho(texto: string, palavras: string[]): { texto: string; marcado: boolean }[] {
  const marcado = new Array<boolean>(texto.length).fill(false);
  const normal = projetar(texto, () => true);
  const soAlfanumerico = projetar(texto, alfanumerico);
  for (const bruta of palavras) {
    const palavra = semAcento(bruta.trim());
    if (!palavra) continue;
    const base = /^\d+$/.test(palavra) ? soAlfanumerico : normal;
    for (let i = base.texto.indexOf(palavra); i >= 0; i = base.texto.indexOf(palavra, i + 1)) {
      const de = base.origem[i]!;
      const ate = base.origem[i + palavra.length - 1]!;
      for (let k = de; k <= ate; k++) marcado[k] = true;
    }
  }
  const pedacos: { texto: string; marcado: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultimo = pedacos[pedacos.length - 1];
    if (ultimo && ultimo.marcado === marcado[i]) ultimo.texto += texto[i];
    else pedacos.push({ texto: texto[i]!, marcado: marcado[i]! });
  }
  return pedacos;
}

/** As palavras do campo de busca (separadas por espaço), como a API as procura. */
export const palavrasDoCampo = (campo: string): string[] => campo.trim().split(/\s+/).filter(Boolean);
