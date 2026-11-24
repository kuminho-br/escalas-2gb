// A consulta de militares (entrega 6.11): todo militar com conta busca qualquer militar da corporação e vê só os blocos que a borda das camadas de
// visão libera. CPF, nascimento e endereço nunca vêm aqui. Um bloco que a pessoa não vê não vem na resposta: a chave fica ausente.

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
export type UnidadeDaConsulta = { id: string; sigla: string; nivel: number };
