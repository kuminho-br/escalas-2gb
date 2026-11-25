// As prévias lançadas das escalas (fase 7.3): o que qualquer conta da corporação lê, e a escala do próprio militar.

/** Uma escala com a prévia lançada num mês. `unidadeId` serve para escolher a unidade pela árvore; `dosOficiais`: é a escala de rodada de cotas dos oficiais. */
export type PreviaDaLista = { escalaId: string; nome: string; unidadeId: string; unidadeSigla: string; mes: string; lancadaEm: string; dosOficiais: boolean };

/** Um serviço do militar numa prévia lançada. `composicao` é a guarnição daquele turno (vazia quando ele está sem guarnição); `eu` marca o próprio militar. */
export type MeuServico = {
  alocacaoId: string;
  data: string;
  inicio: string;
  fim: string;
  servico: string;
  escala: string;
  unidadeSigla: string;
  guarnicao: string | null;
  funcao: string | null;
  composicao: { patente: string; nomeGuerra: string; funcao: string | null; eu: boolean }[];
};

export type MinhaEscala = { mes: string; servicos: MeuServico[] };
