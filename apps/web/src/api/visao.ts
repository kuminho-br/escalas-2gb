import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { Borda, MarcaDeOficiais, Quadro } from 'contratos';
import { pedir } from './cliente';

/** A borda: quais blocos cada camada vê (só o administrador lê). */
export const consultaBorda = queryOptions({ queryKey: ['visao'], queryFn: () => pedir<Borda>('GET', '/api/visao'), staleTime: 0 });

export const salvarBorda = (borda: Borda) => pedir<Borda>('PUT', '/api/visao', borda);

/** Marca ou desmarca um quadro como "de oficiais": quem está nele tem a camada do oficial. */
export const marcarQuadro = (id: string, marca: MarcaDeOficiais) => pedir<Quadro>('PATCH', `/api/quadros/${id}`, marca);

/** Depois de gravar a borda ou a marca de um quadro, o que cada pessoa vê muda: as consultas já carregadas ficam velhas. */
export function atualizarVisao(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['visao'] });
  void queryClient.invalidateQueries({ queryKey: ['quadros'] });
  void queryClient.invalidateQueries({ queryKey: ['consulta'] });
}
