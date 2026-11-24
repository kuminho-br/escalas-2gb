// Limite de tamanho do envio: 1 MB nas rotas comuns e 4 MB nas importações (a planilha da sandbox inteira
// já chegou corrompida por ser grande demais; o modelo com só as abas cabe com folga). Os 4 MB ficam abaixo dos
// 4,5 MB que a hospedagem aceita: acima disso ela recusa antes de a API ser chamada.
import type { MiddlewareHandler } from 'hono';
import type { AmbienteApi } from './acesso.ts';
import { LIMITE_DA_IMPORTACAO_MB, MENSAGEM_ARQUIVO_GRANDE } from 'contratos';
import { bodyLimit } from 'hono/body-limit';

const MB = 1024 * 1024;

const comum = bodyLimit({
  maxSize: 1 * MB,
  onError: (c) => c.json({ erro: 'O envio é grande demais. Confira os dados e tente de novo.' }, 413),
});

const importacao = bodyLimit({
  maxSize: LIMITE_DA_IMPORTACAO_MB * MB,
  onError: (c) => c.json({ erro: MENSAGEM_ARQUIVO_GRANDE }, 413),
});

/**
 * No máximo `max` pedidos por conta (usuário da sessão) a cada `janelaMs`; acima disso, 429 com a `mensagem`. A contagem fica na memória desta instância do servidor
 * (basta para frear quem varre a lista: o limite é de cuidado, não de segurança forte) e usa `Date.now()` a cada pedido.
 */
export function limitarPorConta(opcoes: { max: number; janelaMs: number; mensagem: string }): MiddlewareHandler<AmbienteApi> {
  const pedidos = new Map<string, number[]>();
  return async (c, next) => {
    const agora = Date.now();
    const conta = c.get('usuarioId');
    const recentes = (pedidos.get(conta) ?? []).filter((t) => agora - t < opcoes.janelaMs);
    if (recentes.length >= opcoes.max) {
      pedidos.set(conta, recentes);
      return c.json({ erro: opcoes.mensagem }, 429);
    }
    recentes.push(agora);
    pedidos.set(conta, recentes);
    await next();
  };
}

/** Aplica o limite da importação nas rotas de importação e o comum nas demais. */
export const limiteDeEnvio: MiddlewareHandler = (c, next) => (c.req.path.includes('/importacao/') ? importacao(c, next) : comum(c, next));
