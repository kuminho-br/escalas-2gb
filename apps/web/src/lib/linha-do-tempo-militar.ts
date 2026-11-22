import type { FichaMilitar } from 'contratos';
import { NOME_JORNADA } from '@/lib/militares';

type Periodo = FichaMilitar['rastreio'][number];
type Afastamento = FichaMilitar['afastamentos'][number];

/** `quando` é a data de começo ('aaaa-mm-dd'): o período do rastreio e o afastamento, no dia em que começam. */
export type ItemDaLinhaDoTempo = { quando: string; tipo: 'situacao' | 'afastamento'; texto: string };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const ddmmaaaa = (d: string) => `${ddmm(d)}/${d.slice(0, 4)}`;

/** A situação inteira de um período, como no primeiro item da linha do tempo: "1ª SB · Equipe Alfa · Pronto". */
export const situacaoInteira = (p: Pick<Periodo, 'unidadeSigla' | 'equipe' | 'jornada'>): string =>
  [p.unidadeSigla, p.equipe ? `Equipe ${p.equipe}` : null, NOME_JORNADA[p.jornada]].filter(Boolean).join(' · ');

/** Só o que mudou do período anterior para este: "Equipe Alfa → Bravo", "Lotação 2ª SB → 1ª SB · Jornada Adm → Pronto". */
function oQueMudou(antes: Periodo, depois: Periodo): string {
  const partes: string[] = [];
  if (antes.unidadeSigla !== depois.unidadeSigla) partes.push(`Lotação ${antes.unidadeSigla} → ${depois.unidadeSigla}`);
  if (antes.equipe !== depois.equipe) partes.push(`Equipe ${antes.equipe ?? 'nenhuma'} → ${depois.equipe ?? 'nenhuma'}`);
  if (antes.jornada !== depois.jornada) partes.push(`Jornada ${NOME_JORNADA[antes.jornada]} → ${NOME_JORNADA[depois.jornada]}`);
  return partes.length ? partes.join(' · ') : 'Sem mudança na situação';
}

function textoDoAfastamento(a: Afastamento): string {
  const mesmoAno = a.inicio.slice(0, 4) === a.fim.slice(0, 4);
  return `Afastamento: ${a.tipo} (${mesmoAno ? `${ddmm(a.inicio)} a ${ddmm(a.fim)}` : `${ddmmaaaa(a.inicio)} a ${ddmmaaaa(a.fim)}`})`;
}

/**
 * O rastreio e os afastamentos numa lista só, do mais novo para o mais velho. Cada período vira um item (o primeiro diz a situação inteira, os
 * outros só o que mudou) e cada afastamento vira um item no dia em que começa: um afastamento que atravessa uma mudança de equipe aparece uma vez.
 * No mesmo dia, a mudança de situação vem antes do afastamento.
 */
export function linhaDoTempoDoMilitar(rastreio: Periodo[], afastamentos: Afastamento[]): ItemDaLinhaDoTempo[] {
  const periodos = [...rastreio].sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  const situacoes = periodos.map((p, i): ItemDaLinhaDoTempo => ({ quando: p.desde, tipo: 'situacao', texto: i === 0 ? situacaoInteira(p) : oQueMudou(periodos[i - 1]!, p) }));
  const afastados = afastamentos.map((a): ItemDaLinhaDoTempo => ({ quando: a.inicio, tipo: 'afastamento', texto: textoDoAfastamento(a) }));
  const ordemDoTipo = { situacao: 0, afastamento: 1 };
  return [...situacoes, ...afastados].sort((a, b) => (a.quando !== b.quando ? (a.quando < b.quando ? 1 : -1) : ordemDoTipo[a.tipo] - ordemDoTipo[b.tipo]));
}
