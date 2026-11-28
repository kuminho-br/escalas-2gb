// As equipes como cadastro (6.64): o tipo de cada uma e a conferência com a jornada do militar. Funções puras.
import { CICLO_EQUIPES } from './pre-escala.ts';

/** Os tipos são fixos no código porque cada um tem comportamento no motor; o que se cadastra são as equipes. */
export const TIPOS_DE_EQUIPE = ['pronto', 'adm', 'externa'] as const;
export type TipoDeEquipe = (typeof TIPOS_DE_EQUIPE)[number];

/**
 * A frase do desencontro entre a equipe e a jornada, ou `null` se combinam: a equipe do Pronto só para quem é do Pronto, a do ADM só para quem é do ADM e a Externa nunca
 * (o militar externo entra nela pelo "Trazer", não pelo rastreio).
 */
export function conferirEquipeEJornada(tipo: TipoDeEquipe, jornada: 'pronto' | 'adm'): string | null {
  if (tipo === 'externa') return 'A Externa só se põe pelo botão Trazer.';
  if (tipo === 'pronto' && jornada !== 'pronto') return 'A equipe do Pronto só vale para quem é do Pronto.';
  if (tipo === 'adm' && jornada !== 'adm') return 'A equipe do ADM só vale para quem é do ADM.';
  return null;
}

/** O rótulo interno do motor para a posição da equipe no ciclo (1 a 4): o cálculo usa a posição, nunca o nome que se cadastrou. */
export function rotuloDoCiclo(posicao: number): string {
  const rotulo = CICLO_EQUIPES[posicao - 1];
  if (!Number.isInteger(posicao) || rotulo === undefined) throw new Error(`Posição do ciclo inválida: ${posicao}.`);
  return rotulo;
}
