// O sistema sobre o espelho (6.59): `/api/lab/*` monta as MESMAS rotas de negócio do real (`montarRotasDoSistema`), mas sobre `bancoDoEspelho` (o papel `laboratorio_app`,
// sem acesso ao `public`) e agindo como o perfil de teste da sessão no Laboratório, não como a conta real. Não entram: login, contas e senhas (404).
import { Hono } from 'hono';
import type { Auth } from '../auth.ts';
import { conferirSessao } from '../acesso.ts';
import type { Banco } from '../banco/banco.ts';
import { rotasEu } from '../rotas/eu.ts';
import { montarRotasDoSistema } from '../rotas-do-sistema.ts';
import { bancoDoEspelho } from './banco-do-espelho.ts';
import { EM_MANUTENCAO, espelhoExiste, perfilDoLaboratorio } from './sessao.ts';

export const CABECALHO_DO_LABORATORIO = 'x-laboratorio';
export const FORA_DO_LABORATORIO = 'Este pedido não é do Laboratório.';
export const SO_NO_LABORATORIO = 'Este pedido é do Laboratório.';
export const ESCOLHA_UM_PERFIL = 'Escolha um perfil de teste.';

/**
 * O "login" do Laboratório: a sessão é a da conta real (o cookie de sempre), mas quem age é o perfil de teste que ela escolheu. As rotas leem só
 * `auth.api.getSession`, então basta devolver o perfil como usuário. Sem sessão real ou sem perfil escolhido: nenhuma sessão.
 */
function authDoLaboratorio(real: Banco, auth: Auth): Auth {
  const getSession = async ({ headers }: { headers: Headers }) => {
    const sessao = await auth.api.getSession({ headers });
    if (!sessao) return null;
    const perfil = await perfilDoLaboratorio(real, sessao.user.id);
    return perfil ? { user: { id: perfil.perfilId } } : null;
  };
  return { api: { getSession } } as unknown as Auth;
}

export function rotasDoLaboratorioSobreOEspelho(dep: { banco: Banco; auth: Auth; agora?: () => Date; limiteDeBuscas?: number }): Hono {
  const lab = new Hono();
  const espelho = bancoDoEspelho(dep.banco);

  // o guarda: o pedido é do Laboratório (cabeçalho), de uma conta real válida, com um perfil de teste escolhido
  lab.use('*', async (c, next) => {
    if (!c.req.header(CABECALHO_DO_LABORATORIO)) return c.json({ erro: FORA_DO_LABORATORIO }, 409);
    if (!(await espelhoExiste(dep.banco))) return c.json({ erro: EM_MANUTENCAO }, 503);
    const conta = await conferirSessao(dep.banco, dep.auth, c.req.raw.headers);
    if (!conta.ok) return c.json({ erro: conta.erro }, conta.status);
    if (!(await perfilDoLaboratorio(dep.banco, conta.usuarioId))) return c.json({ erro: ESCOLHA_UM_PERFIL }, 409);
    return next();
  });

  const comAuth = { banco: espelho, auth: authDoLaboratorio(dep.banco, dep.auth) };
  // quem é o perfil em uso (o site pergunta como no real); a troca de senha não existe no Laboratório
  lab.all('/eu/senha', (c) => c.json({ erro: 'Não encontrado.' }, 404));
  lab.route('/eu', rotasEu(comAuth.banco, comAuth.auth));
  montarRotasDoSistema(lab, comAuth, { agora: dep.agora, limiteDeBuscas: dep.limiteDeBuscas, comContas: false }, '/');
  return lab;
}
