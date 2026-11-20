// Ordem de escalação: a vez de cada vaga (guarnição + função + número da vaga) na pré-escala e na tela "Ordem de escalação".
import { z } from 'zod';
import { Id } from './comum.ts';

/** Uma vaga: a 1ª, 2ª… vaga de uma função numa guarnição (uma função de máximo 4 tem 4 vagas). */
export const VagaDaOrdem = z.object({ guarnicaoId: Id, funcaoId: Id, vaga: z.number().int().min(1) });
export type VagaDaOrdem = z.infer<typeof VagaDaOrdem>;

/** A ordem inteira, da primeira vez para a última (posição = índice + 1). Lista vazia é aceita. */
export const OrdemDeEscalacaoEntrada = z
  .object({ itens: z.array(VagaDaOrdem) })
  .refine((o) => new Set(o.itens.map((i) => `${i.guarnicaoId}|${i.funcaoId}|${i.vaga}`)).size === o.itens.length, {
    message: 'Esta vaga aparece duas vezes na ordem.',
    path: ['itens'],
  });
export type OrdemDeEscalacaoEntrada = z.infer<typeof OrdemDeEscalacaoEntrada>;

export type VagaNaTela = {
  guarnicaoId: string;
  guarnicao: string;
  funcaoId: string;
  funcao: string;
  vaga: number;
  /** até o mínimo da função */
  obrigatoria: boolean;
  /** a vez dela na ordem; null = ainda fora da ordem */
  posicao: number | null;
};

export type OrdemDeEscalacao = {
  escalaId: string;
  mes: string;
  /** mês da versão em vigor; null = nenhuma ordem cadastrada (vale a sugestão pela prioridade antiga) */
  vigencia: string | null;
  /** na ordem de exibição: guarnições pela ordem dos cards, funções pela composição, vaga 1, 2… */
  vagas: VagaNaTela[];
};
