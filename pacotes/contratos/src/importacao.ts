// Importação da planilha sandbox (adendo do design, "Importação inicial").
export type ItemPrevia = { chave: string; descricao: string; mudancas?: string[] };
export type ProblemaImportacao = { aba: string; linha: number; mensagem: string; solucao: string };
export type Previa = {
  novos: ItemPrevia[];
  alterados: ItemPrevia[];
  iguais: number;
  problemas: ProblemaImportacao[];
  avisos: string[];
};
export type ResultadoImportacao = Previa & { gravados: number };

/** Tamanho máximo do arquivo da importação: abaixo dos 4,5 MB que a hospedagem aceita num envio. */
export const LIMITE_DA_IMPORTACAO_MB = 4;
export const MENSAGEM_ARQUIVO_GRANDE = `O arquivo é grande demais (o limite é ${LIMITE_DA_IMPORTACAO_MB} MB). Baixe o modelo na tela de importação e cole só as abas nele.`;
