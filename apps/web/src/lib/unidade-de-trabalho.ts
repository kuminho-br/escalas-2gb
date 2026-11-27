import type { UnidadeDeTrabalho } from 'contratos';
import type { EuDaApi } from '@/api/eu';
import { emLaboratorio } from '@/laboratorio/modo';

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
  // as unidades do Laboratório são as do espelho: a escolha vale só nesta aba e nunca vai para o navegador, onde está a preferência do real
  if (emLaboratorio()) return;
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    // sem armazenamento: fica só nesta aba
  }
}

/**
 * A unidade escolhida só para consulta (a pessoa a vê e não a altera): vale enquanto a página fica aberta (recarregar a tela volta à última unidade de trabalho) e NUNCA vai para o navegador. Na próxima entrada o
 * sistema abre na última unidade de trabalho, e não numa unidade em que a pessoa não pode alterar nada.
 */
let consultaDaAba: string | null = null;

export function lerUnidadeDeConsulta(): string | null {
  return consultaDaAba;
}

export function guardarUnidadeDeConsulta(id: string | null): void {
  consultaDaAba = id;
}

/** Só para os testes: volta a ler do navegador na próxima vez, e esquece a unidade de consulta. */
export function esquecerUnidadeDaAba(): void {
  daAba = undefined;
  consultaDaAba = null;
}

/**
 * A unidade em que as telas trabalham: a unidade de consulta que a pessoa escolheu nesta aba, se ainda é só de consulta para ela; senão a última escolhida
 * neste navegador, se ainda tem acesso a ela; senão a do papel mais baixo na árvore (maior nível; empate pela sigla). O militar comum fica na lotação. Quem
 * não trabalha em unidade nenhuma mas tem unidades de consulta abre na primeira delas. null se não há nenhuma unidade.
 */
export function escolherUnidade(
  eu: Pick<EuDaApi, 'papeis' | 'unidades' | 'lotacao'> & { unidadesSoConsulta?: UnidadeDeTrabalho[] },
  guardada: string | null,
  consulta: string | null = null,
): UnidadeDeTrabalho | null {
  const soConsulta = eu.unidadesSoConsulta ?? [];
  const daConsulta = consulta ? soConsulta.find((u) => u.id === consulta) : undefined;
  if (daConsulta) return daConsulta;
  if (eu.unidades.length === 0) return soConsulta[0] ?? null;
  if (eu.papeis.length === 0) return eu.lotacao ?? eu.unidades[0]!;
  const guardadaAindaVale = guardada ? eu.unidades.find((u) => u.id === guardada) : undefined;
  if (guardadaAindaVale) return guardadaAindaVale;
  const dosPapeis = eu.papeis.flatMap((p) => eu.unidades.filter((u) => u.id === p.unidadeId));
  const maisBaixa = dosPapeis.sort((a, b) => b.nivel - a.nivel || a.sigla.localeCompare(b.sigla, 'pt-BR', { numeric: true }))[0];
  return maisBaixa ?? eu.unidades[0]!;
}
