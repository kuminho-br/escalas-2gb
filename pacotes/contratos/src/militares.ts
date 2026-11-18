// Militares: identificação, lotação com histórico, CNH e afastamentos.
import { z } from 'zod';
import { Data, Id, Matricula, Mes, Nome } from './comum.ts';

export const Jornada = z.enum(['pronto', 'adm']);
export const CategoriaCnh = z.enum(['A', 'B', 'C', 'D', 'E']);
const Antiguidade = z.number().int().min(1, 'Use um número a partir de 1.').nullable();
const MSG_CNH_SEM_MOTORISTA = 'Marque o quadro de motoristas antes de escolher a CNH.';

export const NovaLotacao = z.object({ unidadeId: Id, equipeId: Id.nullable(), jornada: Jornada, desde: Mes });
export type NovaLotacao = z.infer<typeof NovaLotacao>;

export const NovoMilitar = z
  .object({
    matricula: Matricula,
    postoGradId: Id,
    nomeGuerra: Nome,
    antiguidade: Antiguidade,
    motorista: z.boolean(),
    cnh: z.array(CategoriaCnh),
    voluntarioJes: z.boolean(),
    lotacao: z.object({ equipeId: Id.nullable(), jornada: Jornada, desde: Mes }),
  })
  .refine((m) => m.motorista || m.cnh.length === 0, { path: ['cnh'], message: MSG_CNH_SEM_MOTORISTA });
export type NovoMilitar = z.infer<typeof NovoMilitar>;

export const EdicaoMilitar = z.object({
  postoGradId: Id.optional(),
  nomeGuerra: Nome.optional(),
  antiguidade: Antiguidade.optional(),
  motorista: z.boolean().optional(),
  cnh: z.array(CategoriaCnh).optional(),
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
export const MENSAGEM_CNH_SEM_MOTORISTA = MSG_CNH_SEM_MOTORISTA;

export type Posto = { id: string; sigla: string; nome: string; ordem: number };
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
  lotacoes: { id: string; unidadeSigla: string; equipe: string | null; jornada: 'pronto' | 'adm'; desde: string; ate: string | null }[];
  afastamentos: { id: string; tipo: string; tipoAfastamentoId: string; inicio: string; fim: string }[];
};
