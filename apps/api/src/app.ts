import { Hono } from 'hono';
import type { Auth } from './auth.ts';
import type { Banco } from './banco/banco.ts';
import { rotasAcessoPorEmail } from './acesso-por-email/rotas.ts';
import type { EnviarEmail } from './acesso-por-email/enviar-email.ts';
import { exigirMigracoesEmDia } from './migracoes-pendentes.ts';
import { limiteDeEnvio } from './limites.ts';
import { rotasDoLaboratorio } from './laboratorio/rotas.ts';
import { CABECALHO_DO_LABORATORIO, SO_NO_LABORATORIO, rotasDoLaboratorioSobreOEspelho } from './laboratorio/rotas-lab.ts';
import { montarRotasDoSistema } from './rotas-do-sistema.ts';
import { rotasEu } from './rotas/eu.ts';
import { rotasSaude } from './rotas/saude.ts';
import { MSG_CRIE_A_SENHA } from './usuarios/mensagens.ts';

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
  /** A chave dos resumos (HMAC) do código de acesso por e-mail: o `BETTER_AUTH_SECRET`. Sem ela, as rotas do código não existem. */
  segredo?: string;
  /** O envio de e-mail (Brevo na Vercel). `null` ou ausente: o envio de códigos está fora do ar (503), e o resto do sistema funciona. */
  enviarEmail?: EnviarEmail | null;
}

export function criarApp(dep: Dependencias): Hono {
  const app = new Hono();
  app.use('/api/*', limiteDeEnvio);
  // o real recusa o pedido do Laboratório (o site em modo Laboratório manda o cabeçalho): nada do espelho vai parar no real por engano
  app.use('/api/*', async (c, next) => (!c.req.path.startsWith('/api/lab/') && c.req.header(CABECALHO_DO_LABORATORIO) ? c.json({ erro: SO_NO_LABORATORIO }, 409) : next()));
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
      await next();
      // quem trocou a senha não fica com um código por e-mail esquecido, ainda valendo
      // a senha já foi trocada: se apagar o código falhar, a pessoa não recebe um 500
      if (sessao && c.res.status === 200) {
        try {
          await dep.banco.query('delete from codigo_de_acesso where militar_id = (select militar_id from usuario where id = $1)', [sessao.user.id]);
        } catch {
          console.error('Não deu para apagar o código de acesso pendente depois de trocar a senha.');
        }
      }
    });
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
    if (dep.segredo) app.route('/api', rotasAcessoPorEmail({ banco: dep.banco, segredo: dep.segredo, enviarEmail: dep.enviarEmail ?? null, agora: dep.agora }));
    // o Laboratório vem antes das rotas do real: o prefixo /api/lab nunca cai numa rota do real
    app.route('/api/lab', rotasDoLaboratorioSobreOEspelho({ ...comAuth, agora: dep.agora, limiteDeBuscas: dep.limiteDeBuscas }));
    app.route('/api/eu', rotasEu(dep.banco, auth));
    montarRotasDoSistema(app, comAuth, { agora: dep.agora, limiteDeBuscas: dep.limiteDeBuscas, comContas: true });
    app.route('/api', rotasDoLaboratorio(comAuth));
  }
  return app;
}
