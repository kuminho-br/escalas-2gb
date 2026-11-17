import type { Previa } from 'contratos';
import type { Papel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import type { Aba } from './planilha.ts';

export interface Contexto {
  tx: Consulta;
  unidadeId: string;
  /** 'aaaa-mm-dd', fuso de Recife */
  hoje: string;
}

/** Uma coluna do modelo; o `rotulo` é exatamente o que a leitura procura (`coluna(aba, rotulo)`). */
export type ColunaModelo = {
  rotulo: string;
  obrigatoria: boolean;
  /** o que escrever na coluna, em linguagem do escalante */
  ajuda: string;
  /** só para valor fechado e curto: vira lista de opções na célula */
  opcoes?: string[];
};
export type AbaModelo = { nome: string; colunas: ColunaModelo[] };
/** Valores que valem de verdade naquela unidade, listados na aba AJUDA. */
export type ValoresDaUnidade = { titulo: string; itens: string[] };
export interface ModeloImportacao {
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
  /** Planilha em branco que o escalante baixa na tela de importação. */
  modelo: ModeloImportacao;
  planejar(abas: Record<string, Aba>, ctx: Contexto): Promise<{ previa: Previa; plano: P }>;
  aplicar(plano: P, ctx: Contexto): Promise<number>;
}
