import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { FaixaDeDisponibilidade, RegistroDeAlteracao, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { pedir } from './cliente';

export const consultaVoluntariadoDoMes = (unidadeId: string, mes: string) =>
  queryOptions({ queryKey: ['voluntariado', unidadeId, mes], queryFn: () => pedir<VoluntariadoDoMes>('GET', `/api/unidades/${unidadeId}/voluntariado/${mes}`) });

export const consultaVoluntariadoDoMilitar = (militarId: string, mes: string) =>
  queryOptions({ queryKey: ['voluntariado-militar', militarId, mes], queryFn: () => pedir<VoluntariadoDoMilitar>('GET', `/api/militares/${militarId}/voluntariado/${mes}`) });

/** Lança o mês do militar (substitui o que havia). A API devolve a lista do mês, que entra no lugar da que estava; a lista "Escolher militar" passa a refletir o lançamento. */
export async function lancarVoluntariado(queryClient: QueryClient, unidadeId: string, militarId: string, mes: string, faixas: FaixaDeDisponibilidade[]): Promise<VoluntariadoDoMes> {
  try {
    const lista = await pedir<VoluntariadoDoMes>('PUT', `/api/militares/${militarId}/voluntariado/${mes}`, { faixas });
    queryClient.setQueryData(['voluntariado', unidadeId, mes], lista);
    void queryClient.invalidateQueries({ queryKey: ['voluntariado-militar', militarId, mes] });
    // a correção que acabou de entrar no registro aparece na seção "Correções"
    void queryClient.invalidateQueries({ queryKey: ['voluntariado-registro', militarId] });
    void queryClient.invalidateQueries({ queryKey: ['candidatos'] });
    return lista;
  } catch (e) {
    void queryClient.invalidateQueries({ queryKey: ['voluntariado'] });
    throw e;
  }
}

/** As correções que o escalante fez no que o militar marcou, da mais nova para a mais velha. */
export const consultaRegistroDoVoluntariado = (militarId: string, mes: string) =>
  queryOptions({ queryKey: ['voluntariado-registro', militarId, mes], queryFn: () => pedir<RegistroDeAlteracao[]>('GET', `/api/militares/${militarId}/voluntariado/${mes}/registro`) });

/** O gestor abre (true) ou fecha (false) a coleta do mês na unidade. A API devolve a lista do mês, que entra no lugar da que estava. */
export async function alterarColeta(queryClient: QueryClient, unidadeId: string, mes: string, aberta: boolean): Promise<VoluntariadoDoMes> {
  try {
    const lista = await pedir<VoluntariadoDoMes>('PUT', `/api/unidades/${unidadeId}/voluntariado/${mes}/coleta`, { aberta });
    queryClient.setQueryData(['voluntariado', unidadeId, mes], lista);
    void queryClient.invalidateQueries({ queryKey: ['eu'] });
    return lista;
  } catch (e) {
    void queryClient.invalidateQueries({ queryKey: ['voluntariado', unidadeId, mes] });
    throw e;
  }
}
