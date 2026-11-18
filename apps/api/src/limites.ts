// Limite de tamanho do envio: 1 MB nas rotas comuns e 10 MB nas importações (a planilha da sandbox inteira
// já chegou corrompida por ser grande demais; o modelo com só as abas cabe com folga).
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

const MB = 1024 * 1024;

const comum = bodyLimit({
  maxSize: 1 * MB,
  onError: (c) => c.json({ erro: 'O envio é grande demais. Confira os dados e tente de novo.' }, 413),
});

const importacao = bodyLimit({
  maxSize: 10 * MB,
  onError: (c) => c.json({ erro: 'O arquivo é grande demais (o limite é 10 MB). Baixe o modelo na tela de importação e cole só as abas nele.' }, 413),
});

/** Aplica o limite da importação nas rotas de importação e o comum nas demais. */
export const limiteDeEnvio: MiddlewareHandler = (c, next) => (c.req.path.includes('/importacao/') ? importacao(c, next) : comum(c, next));
