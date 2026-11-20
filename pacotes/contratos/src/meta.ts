// Meta de ativação: a lista ordenada de modelos de guarnição que a seção quer ativar num dia. Há a meta padrão (vale de uma data em
// diante) e os dias diferentes (lista própria, que pode ser vazia).
import { z } from 'zod';
import { Data, Id } from './comum.ts';

const semRepetidos = (o: { guarnicoes: string[] }): boolean => new Set(o.guarnicoes).size === o.guarnicoes.length;
const REPETIDO = { message: 'Este modelo aparece duas vezes na meta.', path: ['guarnicoes'] };

/** Grava a meta padrão que vale de `desde` em diante (a lista de um mesmo `desde` é substituída). A ordem da lista é a ordem de ativação. */
export const NovaMetaPadrao = z.object({ desde: Data, guarnicoes: z.array(Id).max(100) }).refine(semRepetidos, REPETIDO);
export type NovaMetaPadrao = z.infer<typeof NovaMetaPadrao>;

/** Grava a lista própria do dia da rota. Lista vazia = dia sem meta. */
export const NovaMetaDoDia = z.object({ guarnicoes: z.array(Id).max(100) }).refine(semRepetidos, REPETIDO);
export type NovaMetaDoDia = z.infer<typeof NovaMetaDoDia>;

/** Desativar uma guarnição no dia: sai da meta do dia e desescala quem está nela (alocações e acúmulos, com a marca de remoção). */
export const DesativarGuarnicao = z.object({ guarnicaoId: Id });
export type DesativarGuarnicao = z.infer<typeof DesativarGuarnicao>;

/** Uma alocação que a desativação tirou, para o "Desfazer" recriá-la (recriar a alocação apaga a marca de remoção: é um gatilho do banco). */
export const AlocacaoDesfeita = z.object({
  alocacaoId: Id,
  militarId: Id,
  escalaId: Id,
  servicoId: Id,
  turnoId: Id,
  data: Data,
  guarnicaoId: Id.nullable(),
  funcaoId: Id.nullable(),
  origem: z.enum(['pre_escala', 'distribuicao', 'manual', 'permuta']),
});
export type AlocacaoDesfeita = z.infer<typeof AlocacaoDesfeita>;

/** Um acúmulo que a desativação tirou; `alocacaoId` é o de antes (pode ser de uma alocação que também saiu). */
export const AcumuloDesfeito = z.object({ alocacaoId: Id, guarnicaoId: Id, funcaoId: Id });
export type AcumuloDesfeito = z.infer<typeof AcumuloDesfeito>;

/**
 * Uma alocação que estava na guarnição desativada e passou a ocupar a vaga de um acúmulo dela: o militar continua escalado, na outra guarnição.
 * `guarnicaoId` e `funcaoId` são a vaga de antes (a desativada); `acumuloGuarnicaoId` e `acumuloFuncaoId`, o acúmulo que virou a vaga dele.
 */
export const PromovidaDesfeita = z.object({ alocacaoId: Id, guarnicaoId: Id, funcaoId: Id, acumuloGuarnicaoId: Id, acumuloFuncaoId: Id });
export type PromovidaDesfeita = z.infer<typeof PromovidaDesfeita>;

/** O que a desativação tirou e a meta de antes: o "Desfazer" manda isto de volta. */
export const DesfazerDesativacao = z
  .object({
    guarnicaoId: Id,
    metaAntes: z.object({ origem: z.enum(['padrao', 'dia']), guarnicoes: z.array(Id).max(100) }),
    alocacoes: z.array(AlocacaoDesfeita).max(500),
    acumulos: z.array(AcumuloDesfeito).max(500),
    // um cliente que ainda não conhece as promovidas (a tela de antes da 4.4) manda sem elas: vale como nenhuma
    promovidas: z.array(PromovidaDesfeita).max(500).default([]),
  })
  .refine((d) => new Set(d.metaAntes.guarnicoes).size === d.metaAntes.guarnicoes.length, { message: REPETIDO.message, path: ['metaAntes', 'guarnicoes'] });
export type DesfazerDesativacao = z.infer<typeof DesfazerDesativacao>;

export type ItemDaMeta = { guarnicaoId: string; nome: string };
export type VersaoDaMetaPadrao = { desde: string; guarnicoes: ItemDaMeta[] };
/** A meta que vale num dia; `origem: 'dia'` quando o dia tem lista própria. */
export type MetaDoDia = { data: string; origem: 'padrao' | 'dia'; guarnicoes: ItemDaMeta[] };
