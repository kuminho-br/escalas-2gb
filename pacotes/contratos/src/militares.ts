// Militares: identificação, dados do Pecúlio (nascimento, contato, comportamento), rastreio (lotação, equipe e jornada no tempo), CNH e afastamentos.
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

/** Nome completo; para militar novo é obrigatório. */
export const NomeCompleto = Nome;
export const Sexo = z.enum(['M', 'F']);
const DIAS_DE_CADA_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ehBissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
/**
 * Nascimento: dia e mês, e o ano (opcional). Sem o ano, 29 de fevereiro vale (não há como saber se ele é bissexto); com o ano, a data precisa existir.
 */
export const Nascimento = z
  .object({
    dia: z.number().int('Use um número inteiro.').min(1, 'Use um dia de 1 a 31.').max(31, 'Use um dia de 1 a 31.'),
    mes: z.number().int('Use um número inteiro.').min(1, 'Use um mês de 1 a 12.').max(12, 'Use um mês de 1 a 12.'),
    ano: z.number().int('Use um número inteiro.').min(1900, 'Use um ano a partir de 1900.').max(2100, 'Use um ano até 2100.').nullable().optional(),
  })
  .refine((n) => n.dia <= DIAS_DE_CADA_MES[n.mes - 1]!, { path: ['dia'], message: 'Esse dia não existe nesse mês.' })
  .refine((n) => n.ano == null || n.mes !== 2 || n.dia <= (ehBissexto(n.ano) ? 29 : 28), { path: ['dia'], message: 'Esse dia não existe nesse mês.' });
export type Nascimento = z.infer<typeof Nascimento>;
export const Telefone = z.string().trim().min(1, 'Preencha este campo.').max(20, 'Use no máximo 20 caracteres.');
/** E-mail institucional: só do domínio do Corpo de Bombeiros, em qualquer caixa. */
export const EmailInstitucional = z
  .string()
  .trim()
  .max(120, 'Use no máximo 120 caracteres.')
  .regex(/^[^@ ]+@bombeiros[.]pe[.]gov[.]br$/i, 'Use o e-mail institucional (@bombeiros.pe.gov.br).');
export const COMPORTAMENTOS = ['Excepcional', 'Ótimo', 'Bom', 'Insuficiente', 'Mau'] as const;
export const Comportamento = z.enum(COMPORTAMENTOS);
export type Comportamento = z.infer<typeof Comportamento>;
/** Boletim em que o comportamento foi publicado: texto livre e curto. */
export const BoletimDoComportamento = z.string().trim().min(1, 'Preencha este campo.').max(60, 'Use no máximo 60 caracteres.');
/** Motivo do afastamento (não escreva diagnóstico) e o boletim que o publicou. */
export const MotivoDoAfastamento = z.string().trim().min(1, 'Preencha este campo.').max(200, 'Use no máximo 200 caracteres.');
export const BoletimDoAfastamento = z.string().trim().min(1, 'Preencha este campo.').max(60, 'Use no máximo 60 caracteres.');

const digitos = (v: string) => v.replace(/\D/g, '');
/** Os dígitos verificadores do CPF (rejeita também os 11 dígitos iguais). */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, peso: number) => {
    let soma = 0;
    for (const c of base) soma += Number(c) * peso--;
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}
export const MSG_CPF = 'CPF inválido: confira os 11 dígitos.';
/** CPF: aceita com ou sem pontuação; vira os 11 dígitos. */
export const Cpf = z.string().trim().transform(digitos).refine(cpfValido, MSG_CPF);
export const MSG_CEP = 'O CEP tem 8 dígitos.';
export const Cep = z.string().trim().transform(digitos).refine((v) => /^\d{8}$/.test(v), MSG_CEP);
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;
export const MSG_UF = 'Use a sigla do estado (ex.: PE).';
export const Uf = z.string().trim().toUpperCase().refine((v): v is (typeof UFS)[number] => (UFS as readonly string[]).includes(v), MSG_UF);
const TextoDoEndereco = z.string().trim().min(1, 'Preencha este campo.').max(120, 'Use no máximo 120 caracteres.');
/** O endereço, campo a campo: o que não vem no pedido fica como está; `null` limpa. */
export const EdicaoDeEndereco = z.object({
  cep: Cep.nullable().optional(),
  logradouro: TextoDoEndereco.nullable().optional(),
  numero: TextoDoEndereco.nullable().optional(),
  complemento: TextoDoEndereco.nullable().optional(),
  bairro: TextoDoEndereco.nullable().optional(),
  cidade: TextoDoEndereco.nullable().optional(),
  uf: Uf.nullable().optional(),
});
export type EdicaoDeEndereco = z.infer<typeof EdicaoDeEndereco>;
export type Endereco = { cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null };

/** Uma situação do militar (Ativa, Reserva, Agregado, Adido…): `escalavel` diz se quem está nela pode ser escalado. */
export type SituacaoDoMilitar = { id: string; nome: string; escalavel: boolean; ativo: boolean };
export const NovaSituacaoDoMilitar = z.object({ nome: Nome, escalavel: z.boolean() });
export type NovaSituacaoDoMilitar = z.infer<typeof NovaSituacaoDoMilitar>;
export const EdicaoDaSituacaoDoMilitar = z.object({ nome: Nome.optional(), escalavel: z.boolean().optional(), ativo: z.boolean().optional() });
export type EdicaoDaSituacaoDoMilitar = z.infer<typeof EdicaoDaSituacaoDoMilitar>;

/**
 * "Alterar situação": a lotação (unidade), a equipe, a jornada, o quadro e a situação do militar a partir de um dia. Sem `quadroId` e sem
 * `situacaoId`, o período novo fica com o quadro e a situação de agora.
 */
export const AlteracaoDeSituacao = z.object({ unidadeId: Id, equipeId: Id.nullable(), jornada: Jornada, desde: Data, quadroId: Id.nullable().optional(), situacaoId: Id.optional() });
export type AlteracaoDeSituacao = z.infer<typeof AlteracaoDeSituacao>;

/** As categorias da carteira entram sem repetir e em ordem (A a E): "B, B, D" vira "B, D". */
const CnhSemRepetir = z.array(CategoriaCnh).transform((categorias) => [...new Set(categorias)].sort());

/** A CNH é do militar; só vale para a escala com ele no quadro de motoristas, mas pode estar gravada sem o quadro. */
export const NovoMilitar = z.object({
  matricula: Matricula,
  postoGradId: Id,
  /** sem o quadro, o sistema escolhe: o do posto, quando ele só existe em um; senão, fica sem quadro (pendência "Sem quadro") */
  quadroId: Id.nullable().optional(),
  nomeCompleto: NomeCompleto,
  nomeGuerra: Nome,
  antiguidade: Antiguidade,
  motorista: z.boolean(),
  cnh: CnhSemRepetir,
  voluntarioJes: z.boolean(),
  lotacao: z.object({ equipeId: Id.nullable(), jornada: Jornada, desde: Data }),
});
export type NovoMilitar = z.infer<typeof NovoMilitar>;

export const EdicaoMilitar = z.object({
  postoGradId: Id.optional(),
  nomeCompleto: NomeCompleto.optional(),
  nomeGuerra: Nome.optional(),
  sexo: Sexo.nullable().optional(),
  nascimento: Nascimento.nullable().optional(),
  cpf: Cpf.nullable().optional(),
  endereco: EdicaoDeEndereco.optional(),
  telefone: Telefone.nullable().optional(),
  email: EmailInstitucional.nullable().optional(),
  comportamento: Comportamento.nullable().optional(),
  comportamentoBoletim: BoletimDoComportamento.nullable().optional(),
  antiguidade: Antiguidade.optional(),
  motorista: z.boolean().optional(),
  cnh: CnhSemRepetir.optional(),
  voluntarioJes: z.boolean().optional(),
});
export type EdicaoMilitar = z.infer<typeof EdicaoMilitar>;

const MSG_FIM = 'O fim precisa ser no mesmo dia do início ou depois.';
export const NovoAfastamento = z
  .object({ tipoAfastamentoId: Id, inicio: Data, fim: Data, motivo: MotivoDoAfastamento.nullable().optional(), boletim: BoletimDoAfastamento.nullable().optional() })
  .refine((a) => a.fim >= a.inicio, { path: ['fim'], message: MSG_FIM });
export type NovoAfastamento = z.infer<typeof NovoAfastamento>;
export const EdicaoAfastamento = z.object({
  tipoAfastamentoId: Id.optional(),
  inicio: Data.optional(),
  fim: Data.optional(),
  motivo: MotivoDoAfastamento.nullable().optional(),
  boletim: BoletimDoAfastamento.nullable().optional(),
});
export type EdicaoAfastamento = z.infer<typeof EdicaoAfastamento>;
export const MENSAGEM_FIM_ANTES_DO_INICIO = MSG_FIM;

export type Posto = { id: string; sigla: string; nome: string; ordem: number };
/** QOC, QOA ou QBMG, com os postos-graduações que pertencem a ele (o mesmo posto pode estar em mais de um quadro). */
export type Quadro = { id: string; sigla: string; nome: string; postoGradIds: string[] };
/** Seção em que o usuário pode lotar um militar (as que ele pode cadastrar). */
export type SecaoDeLotacao = { id: string; sigla: string; nome: string };
export type Equipe = { id: string; nome: string; ordemCiclo: number };

export type LinhaMilitar = {
  id: string;
  matricula: string;
  posto: string;
  quadro: { id: string; sigla: string } | null;
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

/** Uma linha do módulo Pecúlio: o militar lotado na unidade (ou numa de baixo) com os dados de contato e as pendências do cadastro. */
export type ItemDoPeculio = {
  militarId: string;
  matricula: string;
  posto: string;
  nomeGuerra: string;
  nomeCompleto: string | null;
  /** a sigla da unidade em que ele está lotado no mês */
  lotacao: string;
  telefone: string | null;
  email: string | null;
  pendencias: string[];
};
export type AniversarianteDoMes = { militarId: string; posto: string; nomeGuerra: string; dia: number; lotacao: string };
/** GET /api/unidades/:u/peculio?mes=aaaa-mm: os militares lotados em :u e nas de baixo, e os que fazem aniversário no mês (em ordem de dia). */
export type ListaDoPeculio = { militares: ItemDoPeculio[]; aniversariantes: AniversarianteDoMes[] };

export type FichaMilitar = LinhaMilitar & {
  postoGradId: string;
  nomeCompleto: string | null;
  sexo: 'M' | 'F' | null;
  nascimento: Nascimento | null;
  /** 11 dígitos, sem pontuação; a tela mostra 000.000.000-00 */
  cpf: string | null;
  endereco: Endereco;
  /** A situação do período que vale (Ativa, Reserva…); null quando o militar não tem período. */
  situacaoDoMilitar: { id: string; nome: string; escalavel: boolean } | null;
  telefone: string | null;
  email: string | null;
  comportamento: Comportamento | null;
  comportamentoBoletim: string | null;
  antiguidade: number | null;
  /** Nomes de guerra dos outros militares da mesma seção com esta antiguidade. */
  antiguidadeRepetidaCom: string[];
  noQuadroDeMotoristas: boolean;
  cnh: string[];
  /** Categorias que vêm pela hierarquia (com D: C e B), além das da carteira. */
  cnhPorHierarquia: string[];
  /**
   * O que quem pede pode editar: `peculio` (identificação, dados pessoais, contato, comportamento, afastamentos e a lotação) é de quem tem papel numa
   * unidade acima da lotação do militar; `escala` (equipe, jornada, motorista, CNH, voluntário) é de quem tem papel na lotação ou acima.
   * `unidadeDeCima` é a sigla da unidade mãe da lotação, para a tela dizer com quem falar.
   */
  podeEditar: { peculio: boolean; escala: boolean; unidadeDeCima: string | null };
  /** Os períodos de lotação + equipe + jornada, do mais novo para o mais velho. */
  rastreio: { id: string; unidadeSigla: string; equipe: string | null; jornada: 'pronto' | 'adm'; quadro: string | null; situacao: string; desde: string; ate: string | null }[];
  afastamentos: { id: string; tipo: string; tipoAfastamentoId: string; inicio: string; fim: string; motivo: string | null; boletim: string | null }[];
};
