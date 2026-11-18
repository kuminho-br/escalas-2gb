import { CORES_SERVICO, COR_PADRAO_SERVICO, type Servico, type TipoServico } from 'contratos';
import { normalizar } from 'dominio';

export const NOME_TIPO: Record<TipoServico, string> = { ordinario: 'Ordinário', pjes: 'PJES', diaria: 'Diária' };

/** Cor da especificação para o nome (sem caixa nem acento); senão a cor padrão. */
export function corSugerida(nome: string): string {
  const k = Object.keys(CORES_SERVICO).find((n) => normalizar(n) === normalizar(nome));
  return k ? CORES_SERVICO[k]! : COR_PADRAO_SERVICO;
}

/** "Diária da operação Guardiões do Bioma, 3 turnos." */
export function resumoDoServico(s: Pick<Servico, 'tipo' | 'operacao' | 'turnos'>): string {
  const n = s.turnos.length;
  const turnos = n === 0 ? 'sem turnos' : n === 1 ? '1 turno' : `${n} turnos`;
  const operacao = s.tipo === 'diaria' && s.operacao ? ` da operação ${s.operacao}` : '';
  return `${NOME_TIPO[s.tipo]}${operacao}, ${turnos}.`;
}
