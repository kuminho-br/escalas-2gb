import type { AplicarLote, LoteDeMilitares, PreviaDoLote, ResultadoDoLote } from 'contratos';
import { pedir } from './cliente';

/** A prévia do lote (6.52): quem muda e quem fica de fora, sem gravar. */
export const previaDoLote = (lote: LoteDeMilitares) => pedir<PreviaDoLote>('POST', '/api/peculio/lote/previa', lote);
/** Aplica o lote: tudo ou nada. `assinatura` é a da prévia; se a lista mudou desde então, 409. */
export const aplicarLote = (corpo: AplicarLote) => pedir<ResultadoDoLote>('POST', '/api/peculio/lote/aplicar', corpo);
