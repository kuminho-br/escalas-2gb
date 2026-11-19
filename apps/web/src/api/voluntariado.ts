import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { MarcaDeVoluntariado, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { pedir } from './cliente';

export const consultaVoluntariadoDoMes = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['voluntariado', unidadeId, mes], queryFn: () => pedir<VoluntariadoDoMes>('GET', `/api/unidades/${unidadeId}/voluntariado/${mes}`) });

export const consultaVoluntariadoDoMilitar = (militarId: string, mes: string) =>
  queryOptions({ queryKey: ['voluntariado-militar', militarId, mes], queryFn: () => pedir<VoluntariadoDoMilitar>('GET', `/api/militares/${militarId}/voluntariado/${mes}`) });

/** Lança o mês do militar (substitui o que havia). A API devolve a lista do mês, que entra no lugar da que estava; a lista "Escolher militar" passa a refletir o lançamento. */
export async function lancarVoluntariado(queryClient: QueryClient, unidadeId: string, militarId: string, mes: string, marcas: MarcaDeVoluntariado[]): Promise<VoluntariadoDoMes> {
  try {
    const lista = await pedir<VoluntariadoDoMes>('PUT', `/api/militares/${militarId}/voluntariado/${mes}`, { marcas });
    queryClient.setQueryData(['voluntariado', unidadeId, mes], lista);
    void queryClient.invalidateQueries({ queryKey: ['voluntariado-militar', militarId, mes] });
    void queryClient.invalidateQueries({ queryKey: ['candidatos'] });
    return lista;
  } catch (e) {
    void queryClient.invalidateQueries({ queryKey: ['voluntariado'] });
    throw e;
  }
}
