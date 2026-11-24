import { queryOptions } from '@tanstack/react-query';
import type { FichaDeConsulta, ResultadoDaConsulta, UnidadeDaConsulta } from 'contratos';
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

/** A ficha de consulta: só os blocos que a pessoa vê. */
/** `unidadeId`: a unidade de trabalho, para a ficha dizer se o gestor pode trazer o militar para a escala dela (o militar externo). */
export const consultaDaFicha = (id: string, unidadeId?: string) =>
  queryOptions({
    queryKey: ['consulta', 'militar', id, unidadeId ?? null],
    queryFn: () => pedir<FichaDeConsulta>('GET', `/api/consulta/militares/${id}${unidadeId ? `?unidade=${unidadeId}` : ''}`),
  });
