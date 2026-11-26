// A unidade pelo caminho de siglas nas planilhas (6.57): "2º GB / 1ª SB". Uma peça só para as duas pontas (a importação lê, a exportação, o modelo e a AJUDA escrevem), para a leitura
// e a escrita nunca se desencontrarem. O banco garante que duas irmãs em vigor não têm a mesma sigla, então o caminho de siglas desde a raiz é único.
import { normalizar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import type { Leitura } from './peculio-colunas.ts';

/** Uma unidade com as siglas da raiz até ela (a última é a dela). */
export type UnidadeDoCaminho = { id: string; siglas: string[] };

/** As unidades em vigor da corporação, cada uma com o caminho de siglas desde a raiz. */
export async function unidadesDoCaminho(c: Consulta, hoje: string): Promise<UnidadeDoCaminho[]> {
  const { rows } = await c.query<UnidadeDoCaminho>(
    `select u.id, array(select a.sigla from unidade a where a.caminho @> u.caminho order by nlevel(a.caminho)) as siglas
       from unidade u where u.ate is null or u.ate >= $1::date order by nlevel(u.caminho), u.sigla`,
    [hoje],
  );
  return rows;
}

/** A barra só separa unidades quando tem espaço de pelo menos um lado: "DInter/1" é uma sigla só, "2º GB / 1ª SB" e "2º GB/ 1ª SB" são duas. */
const SEPARADOR = /\s+\/\s*|\s*\/\s+/;
export const separarCaminho = (texto: string): string[] => texto.split(SEPARADOR).map((s) => s.trim()).filter(Boolean);

const mesmas = (a: string, b: string) => normalizar(a) === normalizar(b);
/** O caminho da unidade termina com estes pedaços (sem diferenciar maiúsculas nem acentos)? */
const terminaCom = (u: UnidadeDoCaminho, pedacos: string[]) => pedacos.length <= u.siglas.length && pedacos.every((p, i) => mesmas(p, u.siglas[u.siglas.length - pedacos.length + i]!));

/**
 * Como a unidade sai na planilha: o menor pedaço final do caminho que é único entre as unidades em vigor da corporação inteira ("1ª SB" quando a sigla é única, "2º GB / 1ª SB" quando
 * se repete). Assim o mesmo arquivo é reconhecido por qualquer importação que alcance a unidade.
 */
export function menorCaminhoUnico(u: UnidadeDoCaminho, todas: UnidadeDoCaminho[]): string {
  for (let k = 1; k <= u.siglas.length; k++) {
    const pedacos = u.siglas.slice(-k);
    if (todas.filter((o) => terminaCom(o, pedacos)).length === 1) return pedacos.join(' / ');
  }
  return u.siglas.join(' / ');
}

/**
 * O `menorCaminhoUnico` de todas as unidades de uma vez (a busca escreve a unidade de vários militares): normaliza as siglas uma só vez e agrupa as unidades pela última sigla, então só
 * compara entre as que podem se confundir. O resultado é, unidade por unidade, o mesmo de `menorCaminhoUnico`.
 */
export function rotulosDasUnidades(todas: UnidadeDoCaminho[]): Map<string, string> {
  const normalizadas = new Map(todas.map((u) => [u.id, u.siglas.map(normalizar)]));
  const porUltima = new Map<string, UnidadeDoCaminho[]>();
  for (const u of todas) {
    const ultima = normalizadas.get(u.id)!.at(-1)!;
    porUltima.set(ultima, [...(porUltima.get(ultima) ?? []), u]);
  }
  const rotulos = new Map<string, string>();
  for (const u of todas) {
    const minhas = normalizadas.get(u.id)!;
    const grupo = porUltima.get(minhas.at(-1)!)!;
    let rotulo = u.siglas.join(' / ');
    for (let k = 1; k <= minhas.length; k++) {
      const pedacos = minhas.slice(-k);
      const iguais = grupo.filter((o) => {
        const dela = normalizadas.get(o.id)!;
        return pedacos.length <= dela.length && pedacos.every((p, i) => p === dela[dela.length - pedacos.length + i]);
      });
      if (iguais.length === 1) {
        rotulo = u.siglas.slice(-k).join(' / ');
        break;
      }
    }
    rotulos.set(u.id, rotulo);
  }
  return rotulos;
}

/**
 * Lê a unidade de uma célula: vale qualquer pedaço final do caminho que aponte uma unidade só entre as do `alcance` (a unidade da importação e as de baixo); o caminho inteiro também.
 * O formato antigo "SIGLA (MÃE)" não vale (a importação é contrato). `todas` serve para escrever os caminhos na mensagem de unidade ambígua.
 */
export function acharPeloCaminho<T extends UnidadeDoCaminho>(texto: string, alcance: T[], todas: UnidadeDoCaminho[]): Leitura<T> {
  const pedacos = separarCaminho(texto);
  if (!pedacos.length) return { vazio: true };
  const candidatas = alcance.filter((u) => terminaCom(u, pedacos));
  if (candidatas.length === 1) return { valor: candidatas[0]! };
  const escrito = texto.trim();
  if (candidatas.length === 0) return { motivo: `Lotação "${escrito}" não é desta importação. A lista está na aba AJUDA do modelo.` };
  return { motivo: `Há mais de uma "${escrito}". Escreva com a unidade de cima: ${candidatas.map((u) => menorCaminhoUnico(u, todas)).join(', ')}.` };
}
