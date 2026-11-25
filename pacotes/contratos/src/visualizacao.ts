// A visualização de escalas para a corporação (fase 7.3.1): as escalas que a conta pode ver no mês, a escala em leitura (EscalaDoMes, com o estado), o registro das alterações no passado e a escala do
// próprio militar. Rascunho só quem monta a escala vê; a prévia, a unidade e as de baixo; a publicada, a retificada e a remessada, toda conta de militar.
import type { EstadoDaEscala } from './escala-do-mes.ts';

/** O que se vê de uma escala fora do rascunho. */
export type EstadoVisivel = Exclude<EstadoDaEscala, 'rascunho'>;

/** Uma escala que a conta pode ver num mês. `unidadeId` serve para escolher a unidade pela árvore; `dosOficiais`: é a escala de rodada de cotas dos oficiais; `em`: quando passou para o estado de agora (ISO em UTC). */
export type EscalaVisivel = { escalaId: string; nome: string; unidadeId: string; unidadeSigla: string; mes: string; estado: EstadoVisivel; emRetificacao: boolean; em: string; dosOficiais: boolean };

/** Um serviço do militar numa escala que não é rascunho. `composicao` é a guarnição daquele turno (vazia quando ele está sem guarnição); `eu` marca o próprio militar; `estado` e `emRetificacao` dizem em que pé está a escala. */
export type MeuServico = {
  alocacaoId: string;
  data: string;
  inicio: string;
  fim: string;
  servico: string;
  escala: string;
  unidadeSigla: string;
  estado: EstadoVisivel;
  emRetificacao: boolean;
  guarnicao: string | null;
  funcao: string | null;
  composicao: { patente: string; nomeGuerra: string; funcao: string | null; eu: boolean }[];
};

export type MinhaEscala = { mes: string; servicos: MeuServico[] };
