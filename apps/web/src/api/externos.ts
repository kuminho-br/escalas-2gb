import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { MilitarExterno } from 'contratos';
import { pedir } from './cliente';

/** Os militares de outras unidades vigentes na escala da unidade (6.36: a lista das Configurações da escala). */
export const consultaExternos = (unidadeId: string) =>
  queryOptions({ queryKey: ['externos', unidadeId], queryFn: () => pedir<MilitarExterno[]>('GET', `/api/unidades/${unidadeId}/externos`) });

/** Depois de trazer ou tirar um externo: a lista dos externos, a lista de Militares e as escolhas de militar de uma vaga voltam a buscar. */
function atualizarExternos(queryClient: QueryClient) {
  for (const queryKey of [['externos'], ['militares'], ['candidatos']]) void queryClient.invalidateQueries({ queryKey });
}

/** O gestor traz um militar de outra unidade para a escala de `unidadeId`: ele passa a poder ser escalado à mão em qualquer serviço daqui, até alguém tirar. */
export async function trazerExterno(queryClient: QueryClient, unidadeId: string, militarId: string): Promise<MilitarExterno> {
  const externo = await pedir<MilitarExterno>('POST', `/api/unidades/${unidadeId}/externos`, { militarId });
  atualizarExternos(queryClient);
  return externo;
}

/** Tira o vínculo: os serviços já lançados ficam. */
export async function tirarExterno(queryClient: QueryClient, unidadeId: string, vinculoId: string): Promise<void> {
  await pedir<null>('DELETE', `/api/unidades/${unidadeId}/externos/${vinculoId}`);
  atualizarExternos(queryClient);
}
