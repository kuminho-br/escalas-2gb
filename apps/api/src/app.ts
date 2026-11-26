import { Hono } from 'hono';
import type { Auth } from './auth.ts';
import type { Banco } from './banco/banco.ts';
import { rotasConfiguracoes } from './cadastros/configuracoes.ts';
import { rotasCotas } from './cadastros/cotas.ts';
import { rotasEstrutura } from './cadastros/estrutura.ts';
import { rotasTiposDeUnidade } from './cadastros/tipos-de-unidade.ts';
import { rotasExternos } from './cadastros/externos.ts';
import { rotasFeriados } from './cadastros/feriados.ts';
import { rotasFuncoesDoMilitar } from './cadastros/funcoes-do-militar.ts';
import { rotasGuarnicoes } from './cadastros/guarnicoes.ts';
import { rotasEscalas } from './cadastros/escalas.ts';
import { rotasDoLote } from './cadastros/lote.ts';
import { rotasMilitares } from './cadastros/militares.ts';
import { rotasServicos } from './cadastros/servicos.ts';
import { rotasSituacoes } from './cadastros/situacoes.ts';
import { exigirMigracoesEmDia } from './migracoes-pendentes.ts';
import { IMPORTADORES } from './importacao/registro.ts';
import { limiteDeEnvio } from './limites.ts';
import { rotasImportacao } from './importacao/rotas.ts';
import { rotasEfetivo } from './efetivo/rotas.ts';
import { rotasOficiais } from './oficiais/rotas.ts';
import { rotasEscalaDoMes } from './escala/rotas.ts';
import { rotasGrade } from './grade/rotas.ts';
import { rotasVisualizacao } from './escala/visualizacao-rotas.ts';
import { rotasVoluntariado } from './voluntariado/rotas.ts';
import { rotasVisao } from './visao/rotas.ts';
import { rotasEu } from './rotas/eu.ts';
import { rotasSaude } from './rotas/saude.ts';
import { MSG_CRIE_A_SENHA } from './usuarios/mensagens.ts';
import { rotasAcesso } from './usuarios/rotas.ts';

export interface Dependencias {
  banco: Banco;
  cronSecret?: string;
  auth?: Auth;
  /** Nomes dos .sql que o código espera ver aplicados; sem a lista, não confere. */
  migracoesEsperadas?: string[];
  /** Intervalo da reconferência enquanto falta migração (ms). */
  intervaloMs?: number;
  /** Buscas por minuto, por conta, na consulta de militares (padrão 30); os testes da consulta, que buscam mais que isso, sobem o limite. */
  limiteDeBuscas?: number;
  /** O relógio das rotas que dependem de "agora" (os próximos serviços); sem ele, a hora de verdade. Os testes o trocam. */
  agora?: () => Date;
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
    // a troca da senha provisória é só pela rota de criar a senha (/api/eu/senha); a do better-auth não vale enquanto ela está pendente
    app.post('/api/auth/change-password', async (c, next) => {
      const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
      if (sessao && (await dep.banco.query('select 1 from usuario where id = $1 and senha_provisoria_ate is not null', [sessao.user.id])).rows.length) {
        return c.json({ erro: MSG_CRIE_A_SENHA }, 403);
      }
      return next();
    });
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
    app.route('/api/eu', rotasEu(dep.banco, auth));
    app.route('/api', rotasConfiguracoes(comAuth));
    app.route('/api', rotasGuarnicoes(comAuth));
    app.route('/api', rotasMilitares(comAuth));
    app.route('/api', rotasDoLote(comAuth));
    app.route('/api', rotasAcesso(comAuth));
    app.route('/api', rotasServicos(comAuth));
    app.route('/api', rotasSituacoes(comAuth));
    app.route('/api', rotasFuncoesDoMilitar(comAuth));
    app.route('/api', rotasCotas(comAuth));
    app.route('/api', rotasFeriados(comAuth));
    app.route('/api', rotasExternos(comAuth));
    app.route('/api', rotasEstrutura(comAuth));
    app.route('/api', rotasTiposDeUnidade(comAuth));
    app.route('/api', rotasEscalas(comAuth));
    app.route('/api', rotasEscalaDoMes(comAuth));
    app.route('/api', rotasVisualizacao({ ...comAuth, agora: dep.agora }));
    app.route('/api', rotasEfetivo(comAuth));
    app.route('/api', rotasGrade(comAuth));
    app.route('/api', rotasOficiais(comAuth));
    app.route('/api', rotasVoluntariado(comAuth));
    app.route('/api', rotasVisao({ ...comAuth, limiteDeBuscas: dep.limiteDeBuscas }));
    app.route('/api', rotasImportacao(comAuth, IMPORTADORES));
  }
  return app;
}
