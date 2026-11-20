import { Hono } from 'hono';
import type { Auth } from './auth.ts';
import type { Banco } from './banco/banco.ts';
import { rotasConfiguracoes } from './cadastros/configuracoes.ts';
import { rotasCotas } from './cadastros/cotas.ts';
import { rotasFeriados } from './cadastros/feriados.ts';
import { rotasGuarnicoes } from './cadastros/guarnicoes.ts';
import { rotasEscalas } from './cadastros/escalas.ts';
import { rotasMilitares } from './cadastros/militares.ts';
import { rotasServicos } from './cadastros/servicos.ts';
import { exigirMigracoesEmDia } from './migracoes-pendentes.ts';
import { IMPORTADORES } from './importacao/registro.ts';
import { limiteDeEnvio } from './limites.ts';
import { rotasImportacao } from './importacao/rotas.ts';
import { rotasEfetivo } from './efetivo/rotas.ts';
import { rotasEscalaDoMes } from './escala/rotas.ts';
import { rotasGrade } from './grade/rotas.ts';
import { rotasVoluntariado } from './voluntariado/rotas.ts';
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
  app.use('/api/*', limiteDeEnvio);
  // com a lista de migrações esperadas (o build da Vercel a embute), a API responde 503 enquanto falta alguma; sem a lista, não confere
  if (dep.migracoesEsperadas) app.use('/api/*', exigirMigracoesEmDia(dep.banco, dep.migracoesEsperadas, { intervaloMs: dep.intervaloMs }));
  app.route('/api/saude', rotasSaude(dep.banco, dep.cronSecret));
  if (dep.auth) {
    const auth = dep.auth;
    const comAuth = { banco: dep.banco, auth };
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
    app.route('/api/eu', rotasEu(dep.banco, auth));
    app.route('/api', rotasConfiguracoes(comAuth));
    app.route('/api', rotasGuarnicoes(comAuth));
    app.route('/api', rotasMilitares(comAuth));
    app.route('/api', rotasServicos(comAuth));
    app.route('/api', rotasCotas(comAuth));
    app.route('/api', rotasFeriados(comAuth));
    app.route('/api', rotasEscalas(comAuth));
    app.route('/api', rotasEscalaDoMes(comAuth));
    app.route('/api', rotasEfetivo(comAuth));
    app.route('/api', rotasGrade(comAuth));
    app.route('/api', rotasVoluntariado(comAuth));
    app.route('/api', rotasImportacao(comAuth, IMPORTADORES));
  }
  return app;
}
