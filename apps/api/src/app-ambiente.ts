import { Hono } from 'hono';
import { enviarPeloBrevo } from './acesso-por-email/enviar-email.ts';
import { criarApp } from './app.ts';
import { criarAuth } from './auth.ts';
import { bancoPg } from './banco/banco.ts';

type Ambiente = Record<string, string | undefined>;

// Lista dos .sql da pasta de migrações, embutida pelo build da Vercel (scripts/build-vercel.mjs).
declare const __MIGRACOES_ESPERADAS__: string[] | undefined;

/**
 * App montado a partir das variáveis de ambiente (Vercel).
 * Sem DATABASE_URL (prévias de branch, D7): só /api/saude responde; o resto devolve 503.
 */
export function criarAppDoAmbiente(env: Ambiente): Hono {
  if (!env.DATABASE_URL) {
    const app = new Hono();
    app.get('/api/saude', (c) => c.json({ ok: true }));
    app.all('/api/*', (c) => c.json({ erro: 'Ambiente sem banco configurado' }, 503));
    return app;
  }
  if (!env.BETTER_AUTH_SECRET) throw new Error('Defina BETTER_AUTH_SECRET.');
  if (!env.BETTER_AUTH_URL) throw new Error('Defina BETTER_AUTH_URL.');
  const banco = bancoPg(env.DATABASE_URL);
  const auth = criarAuth({ banco, segredo: env.BETTER_AUTH_SECRET, urlBase: env.BETTER_AUTH_URL });
  const migracoesEsperadas = typeof __MIGRACOES_ESPERADAS__ === 'undefined' ? undefined : __MIGRACOES_ESPERADAS__;
  // sem BREVO_API_KEY e EMAIL_REMETENTE (postos no Vercel pelo usuário), o envio de códigos fica fora do ar e o resto funciona
  const enviarEmail = env.BREVO_API_KEY && env.EMAIL_REMETENTE ? enviarPeloBrevo({ chave: env.BREVO_API_KEY, remetente: env.EMAIL_REMETENTE }) : null;
  return criarApp({ banco, auth, cronSecret: env.CRON_SECRET, migracoesEsperadas, segredo: env.BETTER_AUTH_SECRET, enviarEmail });
}
