import { Hono } from 'hono';
import type { Banco } from './banco/banco.ts';
import { rotasSaude } from './rotas/saude.ts';

export interface Dependencias {
  banco: Banco;
  cronSecret?: string;
}

export function criarApp(dep: Dependencias): Hono {
  const app = new Hono();
  app.route('/api/saude', rotasSaude(dep.banco, dep.cronSecret));
  return app;
}
