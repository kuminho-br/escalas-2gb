// A árvore de unidades (entrega 6.25): genérica e editável. O tipo da unidade (grupamento, divisão, seção…) é só um nome do cadastro de tipos;
// nenhuma regra depende dele. A tela "Estrutura" cria, renomeia, move, extingue e exclui unidades; "Tipos de unidade" cuida do cadastro de tipos.
import { z } from 'zod';
import { Data, Id } from './comum.ts';
import type { Papel } from './usuarios.ts';

/** Um tipo de unidade: só um nome (a `ordem` serve a ordenar listas). */
export type TipoDeUnidade = { codigo: string; nome: string; ordem: number };
/** Um tipo do cadastro, com o `id` (que as rotas de alterar e excluir usam) e quantas unidades, nem extintas, o usam. */
export type TipoDeUnidadeComUso = TipoDeUnidade & { id: string; unidades: number };

/**
 * O que está ligado a uma unidade: `unidades` são as que ainda valem abaixo dela, `militaresHoje` os lotados nela hoje, e `historico` diz, em
 * palavras, tudo o que um dia foi ligado a ela ("3 escalas", "2 níveis de acesso"); com algo no histórico, a unidade não se exclui, só se extingue.
 */
export type LigadosAUnidade = { unidades: number; militaresHoje: number; historico: string[] };

/** Um nó da árvore, com as filhas na ordem das siglas. */
export type NoDaArvore = {
  id: string;
  sigla: string;
  nome: string;
  tipo: TipoDeUnidade;
  desde: string;
  /** Último dia da unidade; null enquanto ela vale sem prazo. A unidade extinta há mais tempo não vem. */
  ate: string | null;
  filhas: NoDaArvore[];
  /** Quem olha renomeia esta unidade e cria unidades abaixo dela (nível de gestão nela ou acima). */
  podeEditar: boolean;
  /** Quem olha move, extingue e exclui esta unidade (nível de gestão numa unidade ACIMA dela; nunca a raiz). */
  podeReorganizar: boolean;
  ligados: LigadosAUnidade;
};

const Sigla = z.string().trim().min(1, 'Informe a sigla.').max(20, 'Use no máximo 20 caracteres.');
const NomeDaUnidade = z.string().trim().min(1, 'Informe o nome.').max(80, 'Use no máximo 80 caracteres.');

/** `tipo` é o `codigo` do tipo; `desde` cai no dia 1 do mês informado. */
export const NovaUnidade = z.object({ maeId: Id, tipo: z.string().min(1, 'Escolha o tipo.'), sigla: Sigla, nome: NomeDaUnidade, desde: Data });
export type NovaUnidade = z.infer<typeof NovaUnidade>;

/** Renomear (`sigla`, `nome`, `tipo`) e mover (`maeId`, a unidade de cima nova); só o que vier é mudado. */
export const AlteracaoDeUnidade = z
  .object({ sigla: Sigla, nome: NomeDaUnidade, tipo: z.string().min(1, 'Escolha o tipo.'), maeId: Id })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'Informe o que mudar.');
export type AlteracaoDeUnidade = z.infer<typeof AlteracaoDeUnidade>;

/** `ate` é o último dia da unidade. */
export const ExtinguirUnidade = z.object({ ate: Data });
export type ExtinguirUnidade = z.infer<typeof ExtinguirUnidade>;

export const NovoTipoDeUnidade = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(40, 'Use no máximo 40 caracteres.'),
  ordem: z.number().int('Use um número inteiro.').min(0, 'Use um número a partir de 0.').max(1000, 'Use um número até 1000.').optional(),
});
export type NovoTipoDeUnidade = z.infer<typeof NovoTipoDeUnidade>;
export const AlteracaoDeTipoDeUnidade = NovoTipoDeUnidade.partial().strict().refine((d) => Object.keys(d).length > 0, 'Informe o que mudar.');
export type AlteracaoDeTipoDeUnidade = z.infer<typeof AlteracaoDeTipoDeUnidade>;

/** Quem tem um nível de acesso que muda com o "mover". */
export type PessoaNoEfeito = { nome: string; papel: Papel; unidadeSigla: string };
/** O que uma unidade de cima cadastrou e a filha herda. */
export type HerancaDaUnidade = { unidadeSigla: string; parametros: number; feriados: number; funcoes: number };
/** O aviso antes de mover: o que muda quando a unidade troca de unidade de cima. */
export type EfeitoDeMover = {
  /** Quem passa a alcançar a unidade (nível de acesso na nova unidade de cima ou acima dela). */
  passamAAlcancar: PessoaNoEfeito[];
  /** Quem deixa de alcançá-la. */
  deixamDeAlcancar: PessoaNoEfeito[];
  /** Quem tem o quinto nível numa irmã nova (passa a ver a unidade, sem editar) e numa irmã antiga (deixa de ver). */
  passamAVer: PessoaNoEfeito[];
  deixamDeVer: PessoaNoEfeito[];
  /** O que ela deixa de herdar e o que passa a herdar. */
  deixaDeHerdar: HerancaDaUnidade[];
  passaAHerdar: HerancaDaUnidade[];
  /** As siglas das unidades que passam a ser irmãs dela. */
  irmasNovas: string[];
};
