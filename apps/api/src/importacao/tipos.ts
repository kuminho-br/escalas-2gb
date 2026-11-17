import type { Previa } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import type { Aba } from './planilha.ts';

export interface Contexto {
  tx: Consulta;
  unidadeId: string;
  /** 'aaaa-mm-dd', fuso de Recife */
  hoje: string;
}

/**
 * Um cadastro importável. planejar só lê o banco e devolve a prévia e o que gravar;
 * aplicar grava o plano (na mesma transação) e devolve quantos registros gravou.
 */
export interface Importador<P> {
  abas: string[];
  planejar(abas: Record<string, Aba>, ctx: Contexto): Promise<{ previa: Previa; plano: P }>;
  aplicar(plano: P, ctx: Contexto): Promise<number>;
}
