// A leitura das telas de escala para quem não edita a unidade (entrega 6.12). Fica fora de acesso.ts para não criar um import circular com visao.ts.
import type { Context } from 'hono';
import { CADASTRO, exigirPapel, type AmbienteApi } from '../acesso.ts';
import { hojeRecife } from '../datas.ts';
import { blocosDaUnidade } from './visao.ts';

/**
 * null se pode LER a escala da unidade (Grade geral, Escala do mês, Efetivo por dia, Cotas e Voluntariado): quem tem nível de acesso na unidade ou acima,
 * como antes, ou quem vê o bloco "Escala em montagem" dela pelas camadas de visão. Senão, o mesmo 403 (ou 404, se a unidade não existe) de antes.
 * Só os GET dessas telas usam este conferidor: toda rota que grava continua com `exigirPapel`, e a visão nunca dá permissão de gravar.
 */
export async function exigirLeituraDaEscala(c: Context<AmbienteApi>, unidadeId: string): Promise<Response | null> {
  const negado = await exigirPapel(c, unidadeId, CADASTRO);
  if (!negado || negado.status === 404) return negado;
  const blocos = await blocosDaUnidade(c.get('banco'), c.get('usuarioId'), unidadeId, hojeRecife());
  return blocos.has('escala_em_montagem') ? null : negado;
}
