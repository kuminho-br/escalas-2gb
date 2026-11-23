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

/** A unidade `u` está abaixo de alguma unidade em que a pessoa tem nível de acesso? (nunca a própria unidade do nível de acesso) */
function abaixoDeUmNivelDeAcesso(eu: Pick<Eu, 'papeis'>, u: { id: string; caminho: string[] }): boolean {
  return eu.papeis.some((p) => p.unidadeId !== u.id && u.caminho.includes(p.unidadeSigla));
}

/**
 * Quem cadastra militar novo: quem tem nível de acesso numa unidade ACIMA de alguma seção (o cadastro é do Pecúlio, de quem cuida do pessoal).
 * O auxiliar só da seção não vê o botão. É a mesma regra da API, olhando as unidades que a pessoa alcança (a árvore, não o nível dela).
 */
export function podeCadastrarMilitar(eu: Pick<Eu, 'papeis' | 'unidades'>): boolean {
  return eu.unidades.some((u) => abaixoDeUmNivelDeAcesso(eu, u));
}

/** As seções em que a pessoa pode cadastrar: as que estão abaixo de um nível de acesso dela. */
export function secoesDoCadastro<S extends { id: string }>(eu: Pick<Eu, 'papeis' | 'unidades'>, secoes: S[]): S[] {
  return secoes.filter((s) => {
    const u = eu.unidades.find((x) => x.id === s.id);
    return !!u && abaixoDeUmNivelDeAcesso(eu, u);
  });
}

/** Depois de gravar (importação do Pecúlio, ficha): a lista volta a buscar. */
export const atualizarPeculio = (queryClient: { invalidateQueries: (o: { queryKey: unknown[] }) => unknown }) => void queryClient.invalidateQueries({ queryKey: ['peculio'] });
