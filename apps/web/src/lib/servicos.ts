import { CORES_SERVICO, COR_PADRAO_SERVICO, type TipoServico } from 'contratos';
import { normalizar } from 'dominio';

export const NOME_TIPO: Record<TipoServico, string> = { ordinario: 'Ordinário', pjes: 'PJES', diaria: 'Diária' };

/** Cor da especificação para o nome (sem caixa nem acento); senão a cor padrão. */
export function corSugerida(nome: string): string {
  const k = Object.keys(CORES_SERVICO).find((n) => normalizar(n) === normalizar(nome));
  return k ? CORES_SERVICO[k]! : COR_PADRAO_SERVICO;
}
