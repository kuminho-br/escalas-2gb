import type { UnidadeDeTrabalho } from 'contratos';
import type { EuDaApi } from '@/api/eu';

const CHAVE = 'unidade-de-trabalho';
// Cada aba lê a escolha do navegador uma vez e depois vale a dela: a escolha de outra aba não troca a unidade desta no meio do trabalho
// (a escala aberta aqui seria gravada na unidade da outra). Também serve de reserva com o armazenamento bloqueado (janela privada).
let daAba: string | null | undefined;

export function lerUnidadeGuardada(): string | null {
  if (daAba === undefined) {
    try {
      daAba = localStorage.getItem(CHAVE);
    } catch {
      daAba = null;
    }
  }
  return daAba;
}

export function guardarUnidade(id: string): void {
  daAba = id;
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    // sem armazenamento: fica só nesta aba
  }
}

/** Só para os testes: volta a ler do navegador na próxima vez. */
export function esquecerUnidadeDaAba(): void {
  daAba = undefined;
}

/**
 * A unidade em que as telas trabalham: a última escolhida neste navegador, se a pessoa ainda tem acesso a ela; senão a do papel mais baixo na
 * árvore (maior nível; empate pela sigla). O militar comum fica na lotação. null se não há nenhuma unidade.
 */
export function escolherUnidade(eu: Pick<EuDaApi, 'papeis' | 'unidades' | 'lotacao'>, guardada: string | null): UnidadeDeTrabalho | null {
  if (eu.unidades.length === 0) return null;
  if (eu.papeis.length === 0) return eu.lotacao ?? eu.unidades[0]!;
  const guardadaAindaVale = guardada ? eu.unidades.find((u) => u.id === guardada) : undefined;
  if (guardadaAindaVale) return guardadaAindaVale;
  const dosPapeis = eu.papeis.flatMap((p) => eu.unidades.filter((u) => u.id === p.unidadeId));
  const maisBaixa = dosPapeis.sort((a, b) => b.nivel - a.nivel || a.sigla.localeCompare(b.sigla, 'pt-BR', { numeric: true }))[0];
  return maisBaixa ?? eu.unidades[0]!;
}
