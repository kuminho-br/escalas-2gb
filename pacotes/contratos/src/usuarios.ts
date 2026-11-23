// Contas e papéis: o acesso de um militar ao sistema (fase 6). A ficha mostra a situação da conta e quem pode dar papel.
import { z } from 'zod';
import { Data } from './comum.ts';
import { Telefone, type Endereco, type Nascimento } from './militares.ts';

export const Papel = z.enum(['administrador', 'gestor', 'escalante']);
export type Papel = z.infer<typeof Papel>;

/** Sem acesso (ainda não há senha), senha provisória no prazo ou vencida, acesso ativo ou desativado. */
export const SituacaoDoAcesso = z.enum(['sem-acesso', 'provisoria', 'provisoria-vencida', 'ativo', 'desativado']);
export type SituacaoDoAcesso = z.infer<typeof SituacaoDoAcesso>;

/** Um papel do militar com a unidade e o período (`ate` null = em aberto). Datas 'aaaa-mm-dd'. */
export type PapelDoMilitar = { id: string; papel: Papel; unidadeId: string; unidadeSigla: string; desde: string; ate: string | null };

/** O bloco "Acesso ao sistema" da ficha. `papeisQuePodeDar` e `unidadesParaPapel` são o que quem olha pode dar (vazio: não dá papel). */
export type AcessoDoMilitar = {
  situacao: SituacaoDoAcesso;
  /** O e-mail da ficha, que é o de entrada. */
  email: string | null;
  /** Até quando vale a senha provisória (instante ISO); null se não há uma pendente. */
  senhaProvisoriaAte: string | null;
  papeis: PapelDoMilitar[];
  /** Sem e-mail na ficha não há como dar acesso. */
  podeGerarSenha: boolean;
  papeisQuePodeDar: Papel[];
  unidadesParaPapel: { id: string; sigla: string; nivel: number }[];
};

/** A senha provisória, que aparece uma vez, e até quando vale (instante ISO). */
export type SenhaProvisoria = { senha: string; validaAte: string };

export const NovaSenha = z.object({ novaSenha: z.string().min(10, 'Use pelo menos 10 caracteres.') });
export type NovaSenha = z.infer<typeof NovaSenha>;

export const NovoPapel = z.object({ papel: Papel, unidadeId: z.string().uuid('Escolha a unidade.'), desde: Data, ate: Data.nullable().optional() });
export type NovoPapel = z.infer<typeof NovoPapel>;
export const EncerrarPapel = z.object({ ate: Data });
export type EncerrarPapel = z.infer<typeof EncerrarPapel>;

/** Uma unidade em que a pessoa trabalha: as siglas desde a raiz e o nível (0 = raiz). */
export type UnidadeDeTrabalho = { id: string; sigla: string; caminho: string[]; nivel: number };

/** Só o telefone se altera na Minha ficha; qualquer outro campo no corpo é recusado. */
export const NovoTelefone = z.object({ telefone: Telefone.nullable() }).strict();
export type NovoTelefone = z.infer<typeof NovoTelefone>;

/** A Minha ficha: os dados do próprio militar, só para leitura, menos o telefone. */
export type MinhaFicha = {
  postoGrad: string;
  nomeGuerra: string;
  nomeCompleto: string | null;
  matricula: string;
  telefone: string | null;
  email: string | null;
  sexo: 'M' | 'F' | null;
  nascimento: Nascimento | null;
  /** Só os 11 dígitos; a tela põe a máscara. */
  cpf: string | null;
  endereco: Endereco;
  comportamento: string | null;
  comportamentoBoletim: string | null;
  /** A situação de hoje; null sem lotação. */
  situacao: { lotacao: string; equipe: string | null; jornada: 'pronto' | 'adm'; quadro: string | null; situacaoDoMilitar: string } | null;
  motorista: boolean;
  cnh: string[];
  cnhPorHierarquia: string[];
  voluntarioJes: boolean;
};
