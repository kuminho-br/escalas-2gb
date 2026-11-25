import type { FichaMilitar } from 'contratos';
import { NOME_JORNADA } from '@/lib/militares';
import { somarDias } from '@/lib/meses';

type Periodo = FichaMilitar['rastreio'][number];

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const ddmmaaaa = (d: string) => `${ddmm(d)}/${d.slice(0, 4)}`;

/** Quem mexeu no período e quando: "por MAJ BARRETO em 23/11/2026 às 09:15"; sem autor, nada. */
export function textoDoAutor(p: Pick<Periodo, 'alteradoPor' | 'alteradoEm'>): string | undefined {
  if (!p.alteradoPor || !p.alteradoEm) return undefined;
  return `por ${p.alteradoPor.patente} ${p.alteradoPor.nomeGuerra} em ${ddmmaaaa(p.alteradoEm.slice(0, 10))} às ${p.alteradoEm.slice(11, 16)}`;
}

/** A situação inteira de um período numa frase: "1ª SB · Equipe Alfa · Pronto · QBMG · Ativa". */
export const situacaoInteira = (p: Pick<Periodo, 'unidadeSigla' | 'equipe' | 'jornada' | 'quadro' | 'situacao'>): string =>
  [p.unidadeSigla, p.equipe ? `Equipe ${p.equipe}` : null, NOME_JORNADA[p.jornada], p.quadro, p.situacao].filter(Boolean).join(' · ');

/** Os campos da situação de um período, na ordem em que a tela os mostra. */
export type Campo = 'lotacao' | 'equipe' | 'jornada' | 'quadro' | 'situacao';
export const CAMPOS: Campo[] = ['lotacao', 'equipe', 'jornada', 'quadro', 'situacao'];
export const ROTULO_DO_CAMPO: Record<Campo, string> = { lotacao: 'Lotação', equipe: 'Equipe', jornada: 'Jornada', quadro: 'Quadro', situacao: 'Situação' };
/** O que a tela diz no lugar de um campo que falta (no meio da frase, em minúsculo). */
export const SEM_O_CAMPO: Partial<Record<Campo, string>> = { equipe: 'sem equipe', quadro: 'sem quadro' };

/** O período que cobre o dia (uma mudança marcada para depois ainda não vale, e um período já terminado também não); null se nenhum cobre. */
export function periodoAtual(rastreio: Periodo[], dia: string): Periodo | null {
  return rastreio.find((p) => p.desde <= dia && (!p.ate || p.ate >= dia)) ?? null;
}

/** O valor de um campo no período; null quando falta (equipe e quadro). A jornada vem pelo nome ("Pronto", "ADM"). */
export function valorDoCampo(p: Periodo, campo: Campo): string | null {
  switch (campo) {
    case 'lotacao': return p.unidadeSigla;
    case 'equipe': return p.equipe;
    case 'jornada': return NOME_JORNADA[p.jornada];
    case 'quadro': return p.quadro;
    case 'situacao': return p.situacao;
  }
}

const comoSeLe = (p: Periodo, campo: Campo) => valorDoCampo(p, campo) ?? SEM_O_CAMPO[campo] ?? '';

/** Um campo que mudou de um período para o seguinte; os valores já vêm como a tela os diz ("sem equipe"). */
export type Mudanca = { campo: Campo; antes: string; depois: string };

/**
 * Um item da linha do tempo. `vale`: `agora` é o período que cobre hoje (só um por histórico), `marcada` é o de data futura e `antes` o que já foi substituído.
 * `inicio` é o primeiro registro (a situação inteira, `inteira`, e nenhuma mudança); `mudanca` traz só os campos que mudaram do período anterior.
 * `vao` são os dias entre o fim de um período e o começo do seguinte, sem lotação.
 */
export type EventoDoRastreio =
  | { tipo: 'inicio' | 'mudanca'; desde: string; vale: 'agora' | 'antes' | 'marcada'; inteira: string; mudancas: Mudanca[]; autor?: string }
  | { tipo: 'vao'; de: string; ate: string; texto: string };

/** "Sem lotação de 01/03 a 09/03/2025" (o ano nas duas datas só quando o intervalo atravessa a virada). */
function textoDoVao(de: string, ate: string): string {
  const mesmoAno = de.slice(0, 4) === ate.slice(0, 4);
  return `Sem lotação de ${mesmoAno ? ddmm(de) : ddmmaaaa(de)} a ${ddmmaaaa(ate)}`;
}

/**
 * Os períodos do rastreio como eventos, do mais novo para o mais velho (os vãos sem lotação ficam entre os dois períodos que separam). Cada mudança diz só os campos
 * que mudaram em relação ao período anterior, na ordem Lotação, Equipe, Jornada, Quadro, Situação. `dia` é o dia de hoje (parâmetro para testar sem relógio).
 */
export function eventosDoRastreio(rastreio: Periodo[], dia: string): EventoDoRastreio[] {
  const periodos = [...rastreio].sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
  const agora = periodoAtual(periodos, dia);
  const eventos: EventoDoRastreio[] = [];
  periodos.forEach((p, i) => {
    const anterior = periodos[i - 1];
    eventos.push({
      tipo: anterior ? 'mudanca' : 'inicio',
      desde: p.desde,
      vale: p === agora ? 'agora' : p.desde > dia ? 'marcada' : 'antes',
      inteira: CAMPOS.map((c) => valorDoCampo(p, c)).filter(Boolean).join(' · '),
      mudancas: anterior ? CAMPOS.filter((c) => valorDoCampo(anterior, c) !== valorDoCampo(p, c)).map((campo) => ({ campo, antes: comoSeLe(anterior, campo), depois: comoSeLe(p, campo) })) : [],
      autor: textoDoAutor(p),
    });
    const seguinte = periodos[i + 1];
    // os dias entre o fim deste período e o começo do seguinte: a pessoa ficou sem lotação
    if (p.ate && seguinte && somarDias(p.ate, 1) < seguinte.desde) {
      const de = somarDias(p.ate, 1);
      const ate = somarDias(seguinte.desde, -1);
      eventos.push({ tipo: 'vao', de, ate, texto: textoDoVao(de, ate) });
    }
  });
  return eventos.reverse();
}
