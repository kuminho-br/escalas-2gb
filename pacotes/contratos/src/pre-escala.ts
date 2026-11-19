// Pré-escala do Pronto (entrega 3.1): a prévia do que a geração criaria e o corpo da gravação.
import { z } from 'zod';
import { Id } from './comum.ts';

export const NovaPreEscala = z.object({ equipeDia1Id: Id });
export type NovaPreEscala = z.infer<typeof NovaPreEscala>;

export type PreviaDaPreEscala = {
  mes: string;
  /** as equipes do ciclo da seção, por ordem do ciclo */
  equipes: { id: string; nome: string }[];
  /** a equipe do dia 1 descoberta pelo mês anterior; `motivo` diz por que não deu para saber (vazio quando deu) */
  equipeDetectada: { equipeId: string | null; motivo: string };
  /** a escolhida ou, sem escolha, a detectada */
  equipeUsada: { id: string; nome: string } | null;
  /** serviços de Pronto que a gravação criaria */
  entram: number;
  /** vagas que ficariam sem ninguém, na ordem do mês (ex.: "08h–20h", "Combatente ABT") */
  vazias: { data: string; faixa: string; vaga: string }[];
  /** da equipe do dia e sem vaga de guarnição: entram no Pronto sem guarnição */
  semGuarnicao: { data: string; faixa: string; nomeGuerra: string }[];
  /** militares da equipe do dia que o escalante removeu e que a geração não devolve */
  removidosQueNaoVoltam: number;
  avisos: string[];
};
