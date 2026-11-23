import type { Previa } from 'contratos';
import type { Papel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import type { Aba } from './planilha.ts';

export interface Contexto {
  tx: Consulta;
  unidadeId: string;
  /** 'aaaa-mm-dd', fuso de Recife */
  hoje: string;
  /** quem importa (a rota informa): o importador do Pecúlio confere o papel de cima, linha a linha */
  usuarioId?: string;
}

/** Uma coluna do modelo; o `rotulo` é exatamente o que a leitura procura (`coluna(aba, rotulo)`). */
export type ColunaModelo = {
  rotulo: string;
  obrigatoria: boolean;
  /** o que escrever na coluna, em linguagem do escalante */
  ajuda: string;
  /** só para valor fechado e curto: vira lista de opções na célula */
  opcoes?: string[];
  /** a coluna é de texto no modelo: o Excel não converte "15/03" em data */
  texto?: boolean;
};
export type AbaModelo = { nome: string; colunas: ColunaModelo[] };
/** Valores que valem de verdade naquela unidade, listados na aba AJUDA. */
export type ValoresDaUnidade = { titulo: string; itens: string[] };
export interface ModeloImportacao {
  /** A planilha sandbox não tem a aba deste cadastro: a ajuda não manda enviá-la. */
  semSandbox?: boolean;
  /** os mesmos nomes de `Importador.abas`, na mesma ordem */
  abas: AbaModelo[];
  valores?(ctx: Contexto): Promise<ValoresDaUnidade[]>;
}

/**
 * Um cadastro importável. planejar só lê o banco e devolve a prévia e o que gravar;
 * aplicar grava o plano (na mesma transação) e devolve quantos registros gravou.
 */
export interface Importador<P> {
  abas: string[];
  /** Papéis exigidos na unidade; sem dizer, os de cadastro (escalante, gestor, administrador). */
  papeis?: Papel[];
  /** Só quem tem papel numa unidade acima das seções da unidade importada (o dono dos blocos do Pecúlio): a rota recusa os outros com 403. */
  exigeDonoDoPeculio?: boolean;
  /** Planilha em branco que o escalante baixa na tela de importação. */
  modelo: ModeloImportacao;
  /** A prévia; `ignoradas` pode faltar (a rota completa com a lista vazia). */
  planejar(abas: Record<string, Aba>, ctx: Contexto): Promise<{ previa: Omit<Previa, 'ignoradas'> & { ignoradas?: Previa['ignoradas'] }; plano: P }>;
  aplicar(plano: P, ctx: Contexto): Promise<number>;
}
