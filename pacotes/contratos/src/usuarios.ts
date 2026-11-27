// Contas e papéis: o acesso de um militar ao sistema (fase 6). A ficha mostra a situação da conta e quem pode dar papel.
import { z } from 'zod';
import { Data } from './comum.ts';
import { Telefone, type Endereco, type Nascimento } from './militares.ts';

export const Papel = z.enum(['administrador', 'gestor', 'gestor_lateral', 'escalante']);
export type Papel = z.infer<typeof Papel>;

/** Sem acesso (ainda não há senha), senha provisória no prazo ou vencida, acesso ativo ou desativado. */
export const SituacaoDoAcesso = z.enum(['sem-acesso', 'provisoria', 'provisoria-vencida', 'ativo', 'desativado']);
export type SituacaoDoAcesso = z.infer<typeof SituacaoDoAcesso>;

/** Um papel do militar com a unidade e o período (`ate` null = em aberto). Datas 'aaaa-mm-dd'. */
export type PapelDoMilitar = {
  id: string;
  papel: Papel;
  unidadeId: string;
  unidadeSigla: string;
  desde: string;
  ate: string | null;
  /** Quem olha pode encerrar este nível (a regra da rota de encerrar); sem poder, o botão não aparece. */
  podeEncerrar: boolean;
  /** Gestor vigente que é o último da unidade e tem "até" marcado: a data em que o nível termina (aviso, não bloqueia). null nos demais. */
  ultimoGestorAte: string | null;
};

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
  /** Quem olha pode desativar o acesso (a regra da rota); sem poder, o botão não aparece. */
  podeDesativar: boolean;
  papeisQuePodeDar: Papel[];
  /**
   * `tipo` é só o nome do tipo da unidade. `maeSigla` é a sigla da unidade de cima (as siglas se repetem entre unidades de cima diferentes).
   * `aceitaLateral`: quem olha pode dar o quinto nível (`gestor_lateral`) nesta unidade (não é a raiz e, fora o administrador, ele é gestor de uma unidade acima).
   */
  unidadesParaPapel: { id: string; sigla: string; nivel: number; tipo: string; maeId: string | null; maeSigla: string | null; aceitaLateral: boolean }[];
};

/** A senha provisória, que aparece uma vez, e até quando vale (instante ISO). */
export type SenhaProvisoria = { senha: string; validaAte: string };

export const NovaSenha = z.object({ novaSenha: z.string().min(10, 'Use pelo menos 10 caracteres.') });
export type NovaSenha = z.infer<typeof NovaSenha>;

/** O pedido do código de acesso (primeiro acesso e "Esqueci minha senha"): o e-mail institucional da ficha. */
export const PedidoDeCodigo = z.object({ email: z.string().trim().email('Digite o e-mail institucional completo.') });
export type PedidoDeCodigo = z.infer<typeof PedidoDeCodigo>;
/** A resposta do pedido é sempre esta, exista o e-mail ou não: a tela não revela quem tem ficha. */
export const FRASE_DO_PEDIDO = 'Se este e-mail estiver na ficha de um militar, enviamos um código para ele. Confira também a caixa de spam.';
export const MSG_MUITOS_PEDIDOS = 'Muitos pedidos de código. Tente de novo daqui a uma hora.';
export const MSG_MUITAS_TENTATIVAS = 'Muitas tentativas. Tente de novo daqui a uma hora.';
export const MSG_ENVIO_FORA_DO_AR = 'O envio de códigos está fora do ar agora. Procure a Seção de Pessoal.';
/** O aviso das duas telas, sempre à vista depois do pedido. */
export const AVISO_DO_CODIGO = 'Se o código não chegar em 5 minutos, procure no spam. Se ainda assim não chegar, procure a Seção de Pessoal.';

export const MSG_CODIGO_INVALIDO = 'Código inválido ou vencido. Peça outro.';
/** Criar a senha com o código que chegou por e-mail. O código é de 6 números; a senha segue as regras da `NovaSenha`. */
export const SenhaPeloCodigo = z.object({
  email: z.string().trim().email('Digite o e-mail institucional completo.'),
  codigo: z.string().trim().regex(/^\d{6}$/, MSG_CODIGO_INVALIDO),
  novaSenha: NovaSenha.shape.novaSenha,
});
export type SenhaPeloCodigo = z.infer<typeof SenhaPeloCodigo>;

/** Trocar a senha estando logado (Minha ficha): a senha atual e a nova. */
export const TrocarSenha = z.object({ senhaAtual: z.string().min(1, 'Digite a senha atual.'), novaSenha: z.string().min(10, 'Use pelo menos 10 caracteres.') });
export type TrocarSenha = z.infer<typeof TrocarSenha>;
export const MSG_SENHA_ATUAL_ERRADA = 'A senha atual não confere.';
export const MSG_SENHA_TROCADA = 'Senha trocada. As outras sessões abertas foram encerradas.';

export const NovoPapel = z.object({ papel: Papel, unidadeId: z.string().uuid('Escolha a unidade.'), desde: Data, ate: Data.nullable().optional() });
export type NovoPapel = z.infer<typeof NovoPapel>;
export const EncerrarPapel = z.object({ ate: Data });
export type EncerrarPapel = z.infer<typeof EncerrarPapel>;

/** Uma unidade em que a pessoa trabalha: as siglas desde a raiz e o nível (0 = raiz). */
/** `tipo` é o tipo da unidade (`grupamento`, `divisao`, `secao`…). */
/** `maeId` é a unidade de cima (null na raiz): com ela o site monta a árvore para a pessoa escolher nó a nó (6.45). */
export type UnidadeDeTrabalho = { id: string; sigla: string; caminho: string[]; nivel: number; tipo: string; maeId: string | null };

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
  /** O e-mail pessoal, só para leitura. */
  emailPessoal?: string | null;
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
  /** A função do militar, pelo nome (só para leitura); null sem função. */
  funcao: string | null;
  abonoPermanencia: boolean;
};
