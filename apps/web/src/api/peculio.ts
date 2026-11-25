import { queryOptions } from '@tanstack/react-query';
import type { ListaDoPeculio } from 'contratos';
import { pedir } from './cliente';
import type { Eu } from './eu';

/**
 * O Pecúlio da unidade: os militares lotados na unidade e nas de baixo no mês (`incluirAsDeBaixo`, o padrão) ou só os lotados direto nela
 * (`abaixo=nao`), e os aniversariantes do mês.
 */
export const consultaPeculio = (unidadeId: string, mes: string, incluirAsDeBaixo = true) =>
  queryOptions({
    queryKey: ['peculio', unidadeId, mes, incluirAsDeBaixo],
    queryFn: () => pedir<ListaDoPeculio>('GET', `/api/unidades/${unidadeId}/peculio?mes=${mes}${incluirAsDeBaixo ? '' : '&abaixo=nao'}`),
  });

/**
 * A unidade do módulo: a mais alta em que a pessoa tem papel (o 2º GB para quem cuida do pessoal, a 1ª SB para o escalante da seção),
 * pela posição da sigla no caminho da unidade em que as telas trabalham; sem nenhuma, a própria unidade das telas. Numa unidade só de consulta (que não é
 * de nenhum nível de acesso da pessoa), vale o nível dela na unidade mais alta.
 */
export function unidadeDoPeculio(eu: Eu): { id: string; sigla: string } {
  const posicao = (sigla: string) => eu.unidade.caminho.indexOf(sigla);
  const dele = eu.papeis.filter((p) => posicao(p.unidadeSigla) >= 0).sort((a, b) => posicao(a.unidadeSigla) - posicao(b.unidadeSigla))[0];
  if (dele) return { id: dele.unidadeId, sigla: dele.unidadeSigla };
  if (eu.soConsulta && eu.papeis.length > 0) {
    const nivelDe = (id: string) => eu.unidades.find((u) => u.id === id)?.nivel ?? Number.MAX_SAFE_INTEGER;
    const maisAlto = [...eu.papeis].sort((a, b) => nivelDe(a.unidadeId) - nivelDe(b.unidadeId))[0]!;
    return { id: maisAlto.unidadeId, sigla: maisAlto.unidadeSigla };
  }
  return { id: eu.unidade.id, sigla: eu.unidade.sigla };
}

/**
 * A unidade `u` está abaixo de alguma unidade em que a pessoa tem nível de acesso? (nunca a própria unidade do nível de acesso, salvo a raiz: ela não tem
 * unidade de cima, e quem tem nível de acesso nela age sobre o Pecúlio dela mesma, como a API.)
 */
function abaixoDeUmNivelDeAcesso(eu: Pick<Eu, 'papeis'>, u: { id: string; caminho: string[] }): boolean {
  const ehRaiz = u.caminho.length === 1;
  return eu.papeis.some((p) => (p.unidadeId === u.id ? ehRaiz : u.caminho.includes(p.unidadeSigla)));
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
