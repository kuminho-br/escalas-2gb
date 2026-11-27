import type { QueryClient } from '@tanstack/react-query';
import { esquecerUnidadeDaAba } from '@/lib/unidade-de-trabalho';
import { entrarNoModo, sairDoModo } from './modo';

/**
 * Entra no Laboratório ou volta ao real (6.59): liga ou desliga o modo da aba, esquece a unidade em que as telas trabalhavam (as unidades do espelho são outras) e
 * limpa tudo o que o site tinha guardado das consultas (nada do outro mundo aparece). Quem chama leva a pessoa à tela inicial.
 */
export function trocarDeMundo(ligar: boolean, queryClient: QueryClient): void {
  if (ligar) entrarNoModo();
  else sairDoModo();
  esquecerUnidadeDaAba();
  queryClient.clear();
}
