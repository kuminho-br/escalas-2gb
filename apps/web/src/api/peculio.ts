import { queryOptions } from '@tanstack/react-query';
import type { ListaDoPeculio } from 'contratos';
import { pedir } from './cliente';
import type { Eu } from './eu';

/** O módulo Pecúlio: os militares lotados na unidade e nas de baixo no mês, e os aniversariantes do mês. */
export const consultaPeculio = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['peculio', unidadeId, mes], queryFn: () => pedir<ListaDoPeculio>('GET', `/api/unidades/${unidadeId}/peculio?mes=${mes}`) });

/**
 * A unidade do módulo: a mais alta em que a pessoa tem papel (o 2º GB para quem cuida do pessoal, a 1ª SB para o escalante da seção),
 * pela posição da sigla no caminho da unidade em que as telas trabalham; sem nenhuma, a própria unidade das telas.
 */
export function unidadeDoPeculio(eu: Eu): { id: string; sigla: string } {
  const posicao = (sigla: string) => eu.unidade.caminho.indexOf(sigla);
  const dele = eu.papeis.filter((p) => posicao(p.unidadeSigla) >= 0).sort((a, b) => posicao(a.unidadeSigla) - posicao(b.unidadeSigla))[0];
  return dele ? { id: dele.unidadeId, sigla: dele.unidadeSigla } : { id: eu.unidade.id, sigla: eu.unidade.sigla };
}

/** Depois de gravar (importação do Pecúlio, ficha): a lista volta a buscar. */
export const atualizarPeculio = (queryClient: { invalidateQueries: (o: { queryKey: unknown[] }) => unknown }) => void queryClient.invalidateQueries({ queryKey: ['peculio'] });
