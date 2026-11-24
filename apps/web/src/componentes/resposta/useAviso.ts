import { useContext } from 'react';
import { ContextoDeResposta, type PedidoDeAviso } from './contexto';

/** O aviso de resultado: `avisar({ texto, desfazer?, erro?, tentarDeNovo? })`. Um aviso novo substitui o que estava no ar. */
export function useAviso(): (a: PedidoDeAviso) => void {
  const r = useContext(ContextoDeResposta);
  if (!r) throw new Error('useAviso fora do ProvedorDeResposta.');
  return r.avisar;
}
