import { useContext } from 'react';
import { ContextoDeResposta, type PedidoDeConfirmacao } from './contexto';

/** A confirmação: `await confirmar({ titulo, texto?, verbo, perigoso?, digitar? })` responde true (o verbo) ou false (Cancelar e Esc). */
export function useConfirmar(): (c: PedidoDeConfirmacao) => Promise<boolean> {
  const r = useContext(ContextoDeResposta);
  if (!r) throw new Error('useConfirmar fora do ProvedorDeResposta.');
  return r.confirmar;
}
