import type { QueryClient } from '@tanstack/react-query';
import type { MilitarExterno } from 'contratos';
import { pedir } from './cliente';

/** Depois de trazer ou tirar um externo: a ficha da Consulta (o botão), a lista de Militares e as escolhas de militar de uma vaga voltam a buscar. */
function atualizarExternos(queryClient: QueryClient) {
  for (const queryKey of [['consulta', 'militar'], ['militares'], ['candidatos']]) void queryClient.invalidateQueries({ queryKey });
}

/** O gestor traz um militar de outra unidade para a escala de `unidadeId`: ele tira serviço extra (JES, Diária, PJES) aqui, até alguém tirar. */
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
