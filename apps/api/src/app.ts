import { Hono } from 'hono';
import type { Auth } from './auth.ts';
import type { Banco } from './banco/banco.ts';
import { rotasConfiguracoes } from './cadastros/configuracoes.ts';
import { exigirMigracoesEmDia } from './migracoes-pendentes.ts';
import { IMPORTADORES } from './importacao/registro.ts';
import { rotasImportacao } from './importacao/rotas.ts';
import { rotasEu } from './rotas/eu.ts';
import { rotasSaude } from './rotas/saude.ts';

export interface Dependencias {
  banco: Banco;
  cronSecret?: string;
  auth?: Auth;
  /** Nomes dos .sql que o código espera ver aplicados; sem a lista, não confere. */
  migracoesEsperadas?: string[];
  /** Intervalo da reconferência enquanto falta migração (ms). */
  intervaloMs?: number;
}

export function criarApp(dep: Dependencias): Hono {
  const app = new Hono();
  if (dep.migracoesEsperadas) app.use('/api/*', exigirMigracoesEmDia(dep.banco, dep.migracoesEsperadas, { intervaloMs: dep.intervaloMs }));
  app.route('/api/saude', rotasSaude(dep.banco, dep.cronSecret));
  if (dep.auth) {
    const auth = dep.auth;
    const comAuth = { banco: dep.banco, auth };
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
    app.route('/api/eu', rotasEu(dep.banco, auth));
    app.route('/api', rotasConfiguracoes(comAuth));
    app.route('/api', rotasImportacao(comAuth, IMPORTADORES));
  }
  return app;
}
