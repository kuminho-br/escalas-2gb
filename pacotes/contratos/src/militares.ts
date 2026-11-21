// Militares: identificação, rastreio (lotação, equipe e jornada no tempo), CNH e afastamentos.
import { z } from 'zod';
import { Data, Id, Matricula, Mes, Nome } from './comum.ts';

export const Jornada = z.enum(['pronto', 'adm']);
export const CategoriaCnh = z.enum(['A', 'B', 'C', 'D', 'E']);
/** Ordem do militar na seção: de 1 a 99999 (a coluna é inteira de 32 bits; um número enorme colado por engano não pode chegar ao banco). */
export const Antiguidade = z
  .number()
  .int('Use um número inteiro.')
  .min(1, 'Use um número a partir de 1.')
  .max(99999, 'Use um número de 1 a 99999.')
  .nullable();

/** "Alterar situação": a lotação (unidade), a equipe e a jornada do militar a partir de um mês (o dia 1). */
export const AlteracaoDeSituacao = z.object({ unidadeId: Id, equipeId: Id.nullable(), jornada: Jornada, desde: Mes });
export type AlteracaoDeSituacao = z.infer<typeof AlteracaoDeSituacao>;

/** As categorias da carteira entram sem repetir e em ordem (A a E): "B, B, D" vira "B, D". */
const CnhSemRepetir = z.array(CategoriaCnh).transform((categorias) => [...new Set(categorias)].sort());

/** A CNH é do militar; só vale para a escala com ele no quadro de motoristas, mas pode estar gravada sem o quadro. */
export const NovoMilitar = z.object({
  matricula: Matricula,
  postoGradId: Id,
  nomeGuerra: Nome,
  antiguidade: Antiguidade,
  motorista: z.boolean(),
  cnh: CnhSemRepetir,
  voluntarioJes: z.boolean(),
  lotacao: z.object({ equipeId: Id.nullable(), jornada: Jornada, desde: Mes }),
});
export type NovoMilitar = z.infer<typeof NovoMilitar>;

export const EdicaoMilitar = z.object({
  postoGradId: Id.optional(),
  nomeGuerra: Nome.optional(),
  antiguidade: Antiguidade.optional(),
  motorista: z.boolean().optional(),
  cnh: CnhSemRepetir.optional(),
  voluntarioJes: z.boolean().optional(),
  ativo: z.boolean().optional(),
});
export type EdicaoMilitar = z.infer<typeof EdicaoMilitar>;

const MSG_FIM = 'O fim precisa ser no mesmo dia do início ou depois.';
export const NovoAfastamento = z
  .object({ tipoAfastamentoId: Id, inicio: Data, fim: Data })
  .refine((a) => a.fim >= a.inicio, { path: ['fim'], message: MSG_FIM });
export type NovoAfastamento = z.infer<typeof NovoAfastamento>;
export const EdicaoAfastamento = z.object({ tipoAfastamentoId: Id.optional(), inicio: Data.optional(), fim: Data.optional() });
export type EdicaoAfastamento = z.infer<typeof EdicaoAfastamento>;
export const MENSAGEM_FIM_ANTES_DO_INICIO = MSG_FIM;

export type Posto = { id: string; sigla: string; nome: string; ordem: number };
/** Seção em que o usuário pode lotar um militar (as que ele pode cadastrar). */
export type SecaoDeLotacao = { id: string; sigla: string; nome: string };
export type Equipe = { id: string; nome: string; ordemCiclo: number };

export type LinhaMilitar = {
  id: string;
  matricula: string;
  posto: string;
  nomeGuerra: string;
  equipe: string | null;
  jornada: 'pronto' | 'adm' | null;
  /** Categoria mais alta da carteira, se está no quadro de motoristas. */
  motorista: string | null;
  voluntarioJes: boolean;
  ativo: boolean;
  situacao: string;
  pendencias: string[];
};

export type FichaMilitar = LinhaMilitar & {
  postoGradId: string;
  antiguidade: number | null;
  /** Nomes de guerra dos outros militares da mesma seção com esta antiguidade. */
  antiguidadeRepetidaCom: string[];
  noQuadroDeMotoristas: boolean;
  cnh: string[];
  /** Categorias que vêm pela hierarquia (com D: C e B), além das da carteira. */
  cnhPorHierarquia: string[];
  /** Os períodos de lotação + equipe + jornada, do mais novo para o mais velho. */
  rastreio: { id: string; unidadeSigla: string; equipe: string | null; jornada: 'pronto' | 'adm'; desde: string; ate: string | null }[];
  afastamentos: { id: string; tipo: string; tipoAfastamentoId: string; inicio: string; fim: string }[];
};
