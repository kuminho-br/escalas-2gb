import type { Consulta } from '../banco/banco.ts';

export const MSG_POSTO_FORA_DO_QUADRO = 'Este posto-graduação não existe nesse quadro.';

/**
 * O quadro que vale para o militar com este posto-graduação.
 * - `pedido` com id: precisa conter o posto, senão `{ erro }`;
 * - `pedido` null: o quadro é limpo (a ficha mostra a pendência "Sem quadro");
 * - `pedido` ausente: o quadro atual fica se contém o posto; senão, o do posto, se ele só existe em um quadro; senão, nenhum.
 */
export async function quadroParaOPosto(
  c: Consulta,
  postoGradId: string,
  pedido: string | null | undefined,
  atual: string | null,
): Promise<{ quadroId: string | null } | { erro: string }> {
  if (pedido === null) return { quadroId: null };
  const { rows } = await c.query<{ quadro_id: string }>('select quadro_id from quadro_posto_grad where posto_grad_id = $1', [postoGradId]);
  const doPosto = rows.map((r) => r.quadro_id);
  if (pedido !== undefined) return doPosto.includes(pedido) ? { quadroId: pedido } : { erro: MSG_POSTO_FORA_DO_QUADRO };
  if (atual && doPosto.includes(atual)) return { quadroId: atual };
  return { quadroId: doPosto.length === 1 ? doPosto[0]! : null };
}
