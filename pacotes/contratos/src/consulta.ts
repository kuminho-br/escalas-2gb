// A consulta de militares (entrega 6.11): todo militar com conta busca qualquer militar da corporação e vê só os blocos que a borda das camadas de
// visão libera. CPF, nascimento e endereço nunca vêm aqui. Um bloco que a pessoa não vê não vem na resposta: a chave fica ausente.
import { z } from 'zod';
import { CategoriaCnh, Jornada } from './militares.ts';

/** A linha da busca: só a Identificação. */
export type LinhaDaConsulta = {
  id: string;
  postoGrad: string;
  nomeGuerra: string;
  nomeCompleto: string | null;
  matricula: string;
  /** A sigla da unidade do período de hoje; null sem lotação hoje. */
  lotacao: string | null;
  /** A sigla do quadro do período de hoje; null sem quadro. */
  quadro: string | null;
  /** Só vem quando a busca é pedida com a unidade de trabalho: o militar já é dela (lotado nela ou numa de baixo), então não há o que trazer. */
  daUnidade?: boolean;
};

/** No máximo 50 linhas; `haMais` diz que há mais (a pessoa refina a busca). */
export type ResultadoDaConsulta = { militares: LinhaDaConsulta[]; haMais: boolean };

/** Um período de lotação, do mais novo para o mais velho. */
export type PeriodoDaConsulta = { desde: string; ate: string | null; lotacao: string; equipe: string | null; jornada: 'pronto' | 'adm'; quadro: string | null; situacaoDoMilitar: string };

/**
 * A ficha de consulta: a identificação e só os blocos que a pessoa vê (cada um é uma chave que fica ausente quando ela não vê).
 * `motivo` e `boletim` do afastamento só vêm com o bloco `comportamento`. `podeAbrirFichaCompleta`: quem tem nível de acesso na lotação do
 * militar (ou acima) pode ir à ficha completa; para os outros o atalho não aparece.
 */
export type FichaDeConsulta = LinhaDaConsulta & {
  contato?: { telefone: string | null; email: string | null; emailPessoal?: string | null };
  /** A função do militar entra aqui, no bloco "Situação"; o abono de permanência nunca vem. */
  situacao?: { equipe: string | null; jornada: 'pronto' | 'adm'; situacaoDoMilitar: string; funcao: string | null; historico: PeriodoDaConsulta[] };
  afastamentos?: { tipo: string; inicio: string; fim: string; motivo?: string | null; boletim?: string | null }[];
  dadosDaEscala?: { motorista: boolean; cnh: string[]; voluntarioJes: boolean };
  comportamento?: { comportamento: string | null; boletim: string | null };
  podeAbrirFichaCompleta: boolean;
  /**
   * O botão do militar externo (6.33): só vem quando a ficha é pedida com a unidade de trabalho (`?unidade=`), quem pede é gestor nela ou acima e o militar não é
   * da unidade (nem de uma de baixo). `vinculoId` nulo = pode trazer para a escala de `unidadeSigla`; com id = já está, e o gestor pode tirar.
   */
  externo?: { unidadeSigla: string; vinculoId: string | null };
};

/** A unidade na lista de escolha da busca, na ordem da árvore. */
export type UnidadeDaConsulta = { id: string; sigla: string; nivel: number; maeId: string | null };

/** A busca com filtros devolve no máximo isto; com mais, `haMais` e a tela pede para afinar a busca (6.51). */
export const LIMITE_DA_BUSCA_COM_FILTROS = 500;
/** A busca sem corte (a lista inteira do filtro, para selecionar e exportar, 6.54) vai até isto; com mais, a pessoa afina a busca. */
export const LIMITE_DA_BUSCA_SEM_CORTE = 5000;

/**
 * Os filtros da busca de "Pesquisar militares" (6.51); somam-se. Só `texto` e `unidades` (a lotação, cada uma com ou sem as de baixo) valem para toda conta:
 * os outros só existem para quem tem nível de acesso em alguma unidade (para os demais a API os ignora, sem erro). `matriculas` vem do arquivo da tela.
 */
export const FiltrosDaBusca = z.object({
  texto: z.string().trim().max(80).optional(),
  unidades: z.array(z.object({ id: z.string().uuid(), comAsDeBaixo: z.boolean() })).max(200).optional(),
  matriculas: z.array(z.string().trim().min(1).max(20)).max(2000).optional(),
  postoGradIds: z.array(z.string().uuid()).max(100).optional(),
  quadroIds: z.array(z.string().uuid()).max(20).optional(),
  jornada: Jornada.optional(),
  equipe: z.string().trim().min(1).max(40).optional(),
  situacaoIds: z.array(z.string().uuid()).max(50).optional(),
  voluntarioJes: z.boolean().optional(),
  motorista: z.boolean().optional(),
  cnh: z.array(CategoriaCnh).max(5).optional(),
  funcaoIds: z.array(z.string().uuid()).max(100).optional(),
  afastadoHoje: z.boolean().optional(),
  cadastroIncompleto: z.boolean().optional(),
});
export type FiltrosDaBusca = z.infer<typeof FiltrosDaBusca>;

/**
 * A linha da busca com filtros: a identificação de sempre e, para quem tem nível de acesso sobre a lotação do militar, a situação dele. `podeAlterar`: quem pede tem nível de
 * acesso acima da lotação do militar (a atualização em lote, 6.52, só mexe nesses).
 */
export type LinhaDaBusca = LinhaDaConsulta & {
  equipe: string | null;
  jornada: 'pronto' | 'adm' | null;
  situacao: string | null;
  unidadeId: string | null;
  /** A unidade de hoje pelo menor caminho que a identifica na corporação inteira ("2º GB / 1ª SB"; "CBMPE" na raiz), como na exportação; null sem lotação (6.62). */
  lotacaoCaminho: string | null;
  podeAlterar: boolean;
};
/** `naoEncontradas`: as matrículas do arquivo que não são de nenhum militar (como vieram, sem repetir). */
export type ResultadoDaBusca = { militares: LinhaDaBusca[]; haMais: boolean; naoEncontradas: string[] };
