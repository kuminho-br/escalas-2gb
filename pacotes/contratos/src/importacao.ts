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
