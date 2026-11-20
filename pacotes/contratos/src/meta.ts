// Meta de ativação: a lista ordenada de modelos de guarnição que a seção quer ativar num dia. Há a meta padrão (vale de uma data em
// diante) e os dias diferentes (lista própria, que pode ser vazia).
import { z } from 'zod';
import { Data, Id } from './comum.ts';

const semRepetidos = (o: { guarnicoes: string[] }): boolean => new Set(o.guarnicoes).size === o.guarnicoes.length;
const REPETIDO = { message: 'Este modelo aparece duas vezes na meta.', path: ['guarnicoes'] };

/** Grava a meta padrão que vale de `desde` em diante (a lista de um mesmo `desde` é substituída). A ordem da lista é a ordem de ativação. */
export const NovaMetaPadrao = z.object({ desde: Data, guarnicoes: z.array(Id).max(100) }).refine(semRepetidos, REPETIDO);
export type NovaMetaPadrao = z.infer<typeof NovaMetaPadrao>;

/** Grava a lista própria de um dia, ou de um intervalo (do dia da rota até `ate`, no máximo 31 dias). Lista vazia = dia sem meta. */
export const NovaMetaDoDia = z.object({ ate: Data.optional(), guarnicoes: z.array(Id).max(100) }).refine(semRepetidos, REPETIDO);
export type NovaMetaDoDia = z.infer<typeof NovaMetaDoDia>;

export type ItemDaMeta = { guarnicaoId: string; nome: string };
export type VersaoDaMetaPadrao = { desde: string; guarnicoes: ItemDaMeta[] };
/** A meta que vale num dia; `origem: 'dia'` quando o dia tem lista própria. */
export type MetaDoDia = { data: string; origem: 'padrao' | 'dia'; guarnicoes: ItemDaMeta[] };
