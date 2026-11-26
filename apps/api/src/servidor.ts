// Servidor local de desenvolvimento (porta 8787). Sem DATABASE_URL, usa o PGlite em apps/api/.dados.
import { serve } from '@hono/node-server';
import { enviarNoTerminal } from './acesso-por-email/enviar-email.ts';
import { criarApp } from './app.ts';
import { criarAuth } from './auth.ts';
import { bancoPg } from './banco/banco.ts';
import { bancoPglite } from './banco/pglite.ts';
import { PASTA_DADOS_LOCAL } from './banco/local.ts';
import { migrar } from './banco/migrar.ts';

const url = process.env.DATABASE_URL;
const banco = url ? bancoPg(url) : await bancoPglite(PASTA_DADOS_LOCAL);
if (!url) await migrar(banco);

const porta = Number(process.env.PORTA ?? 8787);
// No PGlite local, um segredo fixo de desenvolvimento basta; com banco de verdade, ele é obrigatório.
const segredo = process.env.BETTER_AUTH_SECRET ?? (url ? undefined : 'segredo-local-de-desenvolvimento-nao-usar-fora');
if (!segredo) throw new Error('Defina BETTER_AUTH_SECRET.');
const auth = criarAuth({ banco, segredo, urlBase: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173' });
// Este servidor só roda no computador de quem desenvolve (na Vercel é o app-ambiente.ts). Com ENVIO_DE_TESTE=terminal, o código vai para o terminal, para conferir o fluxo com e-mails fictícios; sem ela, o envio fica fora do ar.
const enviarEmail = process.env.ENVIO_DE_TESTE === 'terminal' ? enviarNoTerminal() : null;
const app = criarApp({ banco, auth, cronSecret: process.env.CRON_SECRET, segredo, enviarEmail });
serve({ fetch: app.fetch, port: porta }, () => console.log(`API em http://localhost:${porta}`));
