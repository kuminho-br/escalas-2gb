// O militar externo (6.33): de outra unidade, trazido pelo gestor para tirar serviço extra na escala daqui. Guardado em `vinculo_externo`.
import { z } from 'zod';
import { Id } from './comum.ts';

/** Trazer um militar para a escala da unidade (a unidade vem na rota). */
export const NovoExterno = z.object({ militarId: Id });
export type NovoExterno = z.infer<typeof NovoExterno>;

/** Um militar externo vigente na unidade: o vínculo, quem é, de onde ele é e desde quando está na escala daqui. */
export type MilitarExterno = { vinculoId: string; militarId: string; posto: string; nomeGuerra: string; matricula: string; lotacaoSigla: string; desde: string };
