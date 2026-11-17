// Servidor local de desenvolvimento (porta 8787). Sem DATABASE_URL, usa o PGlite em apps/api/.dados.
import { serve } from '@hono/node-server';
import { criarApp } from './app.ts';
import { bancoPg, bancoPglite } from './banco/banco.ts';
import { PASTA_DADOS_LOCAL } from './banco/local.ts';
import { migrar } from './banco/migrar.ts';

const url = process.env.DATABASE_URL;
const banco = url ? bancoPg(url) : await bancoPglite(PASTA_DADOS_LOCAL);
if (!url) await migrar(banco);

const app = criarApp({ banco, cronSecret: process.env.CRON_SECRET });
const porta = Number(process.env.PORTA ?? 8787);
serve({ fetch: app.fetch, port: porta }, () => console.log(`API em http://localhost:${porta}`));
