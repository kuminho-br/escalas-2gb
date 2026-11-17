import { Hono } from 'hono';
import type { Auth } from './auth.ts';
import type { Banco } from './banco/banco.ts';
import { IMPORTADORES } from './importacao/registro.ts';
import { rotasImportacao } from './importacao/rotas.ts';
import { rotasEu } from './rotas/eu.ts';
import { rotasSaude } from './rotas/saude.ts';

export interface Dependencias {
  banco: Banco;
  cronSecret?: string;
  auth?: Auth;
}

export function criarApp(dep: Dependencias): Hono {
  const app = new Hono();
  app.route('/api/saude', rotasSaude(dep.banco, dep.cronSecret));
  if (dep.auth) {
    const auth = dep.auth;
    const comAuth = { banco: dep.banco, auth };
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
    app.route('/api/eu', rotasEu(dep.banco, auth));
    app.route('/api', rotasImportacao(comAuth, IMPORTADORES));
  }
  return app;
}
