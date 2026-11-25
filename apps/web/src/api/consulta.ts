import { queryOptions } from '@tanstack/react-query';
import type { FichaDeConsulta, FiltrosDaBusca, ResultadoDaBusca, ResultadoDaConsulta, UnidadeDaConsulta } from 'contratos';
import { deveTentarDeNovoNaBusca } from '@/lib/consultas';
import { pedir } from './cliente';

/** As unidades da corporação, na ordem da árvore, para escolher onde buscar. */
export const consultaUnidadesDaBusca = queryOptions({
  queryKey: ['consulta', 'unidades'],
  queryFn: () => pedir<UnidadeDaConsulta[]>('GET', '/api/consulta/unidades'),
  staleTime: 300_000,
});

/** A busca de militares da corporação: o texto (3 letras ou mais) e/ou a unidade. Sem nenhum dos dois, não há o que buscar. */
export const consultaDaBusca = (texto: string, unidadeId: string) => {
  const params = new URLSearchParams();
  if (texto) params.set('texto', texto);
  if (unidadeId) params.set('unidadeId', unidadeId);
  return queryOptions({
    queryKey: ['consulta', 'militares', texto, unidadeId],
    queryFn: () => pedir<ResultadoDaConsulta>('GET', `/api/consulta/militares?${params}`),
    retry: deveTentarDeNovoNaBusca,
  });
};

/** A busca com filtros (6.51): vai no corpo, porque as unidades e as matrículas do arquivo não cabem no endereço. Mesmo limite de buscas por minuto. */
export const consultaDaBuscaComFiltros = (filtros: FiltrosDaBusca) =>
  queryOptions({
    queryKey: ['consulta', 'militares', 'filtros', filtros],
    queryFn: () => pedir<ResultadoDaBusca>('POST', '/api/consulta/militares/buscar', filtros),
    retry: deveTentarDeNovoNaBusca,
  });

/** A ficha de consulta: só os blocos que a pessoa vê. */
export const consultaDaFicha = (id: string) =>
  queryOptions({
    queryKey: ['consulta', 'militar', id],
    queryFn: () => pedir<FichaDeConsulta>('GET', `/api/consulta/militares/${id}`),
  });

/**
 * A busca de quem trazer para a escala da unidade de trabalho (Configurações da escala, 6.36): a mesma busca da Consulta, e cada linha diz se o
 * militar já é da unidade (`daUnidade`). Com menos de 3 letras não há o que buscar.
 */
export const consultaParaTrazer = (texto: string, unidadeDeTrabalho: string) =>
  queryOptions({
    queryKey: ['consulta', 'militares', 'para-trazer', texto, unidadeDeTrabalho],
    queryFn: () => pedir<ResultadoDaConsulta>('GET', `/api/consulta/militares?${new URLSearchParams({ texto, unidadeDeTrabalho })}`),
    retry: deveTentarDeNovoNaBusca,
  });
