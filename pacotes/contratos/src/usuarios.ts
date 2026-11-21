// Contas e papéis: o acesso de um militar ao sistema (fase 6). A ficha mostra a situação da conta e quem pode dar papel.
import { z } from 'zod';
import { Data } from './comum.ts';

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

export const NovoPapel = z.object({ papel: Papel, unidadeId: z.string().uuid('Escolha a unidade.'), desde: Data });
export type NovoPapel = z.infer<typeof NovoPapel>;
export const EncerrarPapel = z.object({ ate: Data });
export type EncerrarPapel = z.infer<typeof EncerrarPapel>;
