import type { FichaMilitar } from 'contratos';
import { NOME_JORNADA } from '@/lib/militares';
import { somarDias } from '@/lib/meses';

type Periodo = FichaMilitar['rastreio'][number];
type Afastamento = FichaMilitar['afastamentos'][number];

/** `quando` é a data de começo ('aaaa-mm-dd'): o período do rastreio e o afastamento, no dia em que começam. */
export type ItemDaLinhaDoTempo = { quando: string; tipo: 'situacao' | 'intervalo' | 'afastamento'; texto: string; /** "por MAJ BARRETO em 23/11/2026 às 09:15", quando a auditoria sabe quem fez */ autor?: string };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const ddmmaaaa = (d: string) => `${ddmm(d)}/${d.slice(0, 4)}`;

/** Quem mexeu no período e quando: "por MAJ BARRETO em 23/11/2026 às 09:15"; sem autor, nada. */
export function textoDoAutor(p: Pick<Periodo, 'alteradoPor' | 'alteradoEm'>): string | undefined {
  if (!p.alteradoPor || !p.alteradoEm) return undefined;
  return `por ${p.alteradoPor.patente} ${p.alteradoPor.nomeGuerra} em ${ddmmaaaa(p.alteradoEm.slice(0, 10))} às ${p.alteradoEm.slice(11, 16)}`;
}

/** A situação inteira de um período, como no primeiro item da linha do tempo: "1ª SB · Equipe Alfa · Pronto · QBMG · Ativa". */
export const situacaoInteira = (p: Pick<Periodo, 'unidadeSigla' | 'equipe' | 'jornada' | 'quadro' | 'situacao'>): string =>
  [p.unidadeSigla, p.equipe ? `Equipe ${p.equipe}` : null, NOME_JORNADA[p.jornada], p.quadro, p.situacao].filter(Boolean).join(' · ');

/** Só o que mudou do período anterior para este: "Equipe Alfa → Bravo", "Lotação 2ª SB → 1ª SB · Jornada Adm → Pronto". */
function oQueMudou(antes: Periodo, depois: Periodo): string {
  const partes: string[] = [];
  if (antes.unidadeSigla !== depois.unidadeSigla) partes.push(`Lotação ${antes.unidadeSigla} → ${depois.unidadeSigla}`);
  if (antes.equipe !== depois.equipe) partes.push(`Equipe ${antes.equipe ?? 'nenhuma'} → ${depois.equipe ?? 'nenhuma'}`);
  if (antes.jornada !== depois.jornada) partes.push(`Jornada ${NOME_JORNADA[antes.jornada]} → ${NOME_JORNADA[depois.jornada]}`);
  if (antes.quadro !== depois.quadro) partes.push(`Quadro ${antes.quadro ?? 'nenhum'} → ${depois.quadro ?? 'nenhum'}`);
  if (antes.situacao !== depois.situacao) partes.push(`Situação ${antes.situacao} → ${depois.situacao}`);
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
  const situacoes = periodos.map((p, i): ItemDaLinhaDoTempo => ({ quando: p.desde, tipo: 'situacao', texto: i === 0 ? situacaoInteira(p) : oQueMudou(periodos[i - 1]!, p), autor: textoDoAutor(p) }));
  // o intervalo entre um período que terminou e o seguinte: a pessoa ficou sem lotação nesses dias
  const intervalos = periodos.flatMap((p, i): ItemDaLinhaDoTempo[] => {
    const proximo = periodos[i + 1];
    if (!p.ate || !proximo || somarDias(p.ate, 1) >= proximo.desde) return [];
    const de = somarDias(p.ate, 1);
    const ate = somarDias(proximo.desde, -1);
    const mesmoAno = de.slice(0, 4) === ate.slice(0, 4);
    return [{ quando: de, tipo: 'intervalo', texto: `Sem lotação de ${mesmoAno ? ddmm(de) : ddmmaaaa(de)} a ${mesmoAno ? ddmm(ate) : ddmmaaaa(ate)}` }];
  });
  const afastados = afastamentos.map((a): ItemDaLinhaDoTempo => ({ quando: a.inicio, tipo: 'afastamento', texto: textoDoAfastamento(a) }));
  const ordemDoTipo = { situacao: 0, intervalo: 1, afastamento: 2 };
  return [...situacoes, ...intervalos, ...afastados].sort((a, b) => (a.quando !== b.quando ? (a.quando < b.quando ? 1 : -1) : ordemDoTipo[a.tipo] - ordemDoTipo[b.tipo]));
}
