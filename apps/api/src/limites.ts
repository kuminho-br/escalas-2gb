// Limite de tamanho do envio: 1 MB nas rotas comuns e 4 MB nas importações (a planilha da sandbox inteira
// já chegou corrompida por ser grande demais; o modelo com só as abas cabe com folga). Os 4 MB ficam abaixo dos
// 4,5 MB que a hospedagem aceita: acima disso ela recusa antes de a API ser chamada.
import type { MiddlewareHandler } from 'hono';
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

/** Aplica o limite da importação nas rotas de importação e o comum nas demais. */
export const limiteDeEnvio: MiddlewareHandler = (c, next) => (c.req.path.includes('/importacao/') ? importacao(c, next) : comum(c, next));
