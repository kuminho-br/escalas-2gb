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
  /** a equipe do dia 1 do Pronto já gravado neste mês (vale antes da detectada); gerar com outra é recusado */
  equipeNoMes: { id: string; nome: string } | null;
  /** a escolhida ou, sem escolha, a detectada */
  equipeUsada: { id: string; nome: string } | null;
  /** militares da equipe do dia que a gravação poria no turno do Pronto (sem guarnição: o escalante põe cada um numa vaga depois, à mão) */
  entramNoTurno: number;
  /** militares do Adm que a gravação poria no expediente (dias úteis; fora fim de semana, feriado, afastamento e dia com Saldo no horário); sem escala */
  entramNoExpediente: number;
  /** a unidade não tem o serviço Expediente: o expediente não foi gerado (a frase também vai em `avisos`) */
  semExpediente?: string;
  /** militares (do Pronto ou do expediente) que o escalante removeu e que a geração não devolve */
  removidosQueNaoVoltam: number;
  avisos: string[];
};
