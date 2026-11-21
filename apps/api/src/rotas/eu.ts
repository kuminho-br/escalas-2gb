import { hashPassword } from 'better-auth/crypto';
import { NovaSenha } from 'contratos';
import { Hono } from 'hono';
import { papeisVigentes, type Papel } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo } from '../erros.ts';
import { MSG_SENHA_VENCIDA } from '../usuarios/mensagens.ts';
import { unidadeAtual } from '../unidade-atual.ts';

export interface Eu {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  /** Vazio = militar comum. */
  papeis: { papel: Papel; unidadeId: string; unidadeSigla: string }[];
  /** Unidade em que as telas trabalham (fixa na fase de teste). */
  unidade: { id: string; sigla: string; caminho: string[] };
  /** Entrou com a senha provisória: só a tela de criar a senha abre até a troca. */
  trocarSenha: boolean;
}

/** GET /api/eu: quem está logado, o militar, os papéis vigentes hoje (fuso de Recife) e a unidade. POST /api/eu/senha: a troca da senha provisória. */
export function rotasEu(banco: Banco, auth: Auth): Hono {
  const r = new Hono();
  r.get('/', async (c) => {
    const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!sessao) return c.json({ erro: 'Não autenticado' }, 401);
    const { rows } = await banco.query<{ id: string; nome: string; email: string; matricula: string; posto: string; nome_guerra: string; trocar_senha: boolean }>(
      `select u.id, u.nome, u.email, m.matricula, p.sigla as posto, m.nome_guerra, u.senha_provisoria_ate is not null as trocar_senha
         from usuario u join militar m on m.id = u.militar_id join posto_grad p on p.id = m.posto_grad_id
        where u.id = $1 and u.ativo`,
      [sessao.user.id],
    );
    const u = rows[0];
    if (!u) return c.json({ erro: 'Não autenticado' }, 401);
    const papeis = await papeisVigentes(banco, u.id, hojeRecife());
    const eu: Eu = {
      usuario: { id: u.id, nome: u.nome, email: u.email },
      militar: { matricula: u.matricula, postoGrad: u.posto, nomeGuerra: u.nome_guerra },
      papeis: papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidade_id, unidadeSigla: p.sigla })),
      unidade: await unidadeAtual(banco),
      trocarSenha: u.trocar_senha,
    };
    return c.json(eu);
  });

  // a troca da senha provisória pela definitiva. Fica fora do `exigirSessao` (que barra quem ainda não trocou), então confere a sessão aqui
  r.post('/senha', async (c) => {
    const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!sessao) return c.json({ erro: 'Não autenticado' }, 401);
    const corpo = await lerCorpo(c, NovaSenha);
    if (!corpo.ok) return corpo.resposta;
    const hash = await hashPassword(corpo.dados.novaSenha);
    const resultado = await comUsuario(banco, sessao.user.id, async (tx) => {
      const u = (await tx.query<{ ativo: boolean; provisoria: boolean; vencida: boolean }>(
        'select ativo, senha_provisoria_ate is not null as provisoria, coalesce(senha_provisoria_ate < now(), false) as vencida from usuario where id = $1 for update',
        [sessao.user.id],
      )).rows[0];
      if (!u?.ativo) return 'sem-sessao' as const;
      if (!u.provisoria) return 'sem-pendencia' as const;
      // a sessão abriu antes de vencer, mas a senha provisória não serve mais para nada
      if (u.vencida) return 'vencida' as const;
      await tx.query("update conta set senha = $2, atualizado_em = now() where usuario_id = $1 and provedor_id = 'credential'", [sessao.user.id, hash]);
      await tx.query('update usuario set senha_provisoria_ate = null, atualizado_em = now() where id = $1', [sessao.user.id]);
      // quem entrou com a senha provisória e guardou a sessão não fica com o acesso de quem criou a senha: só esta sessão continua
      await tx.query('delete from sessao where usuario_id = $1 and token <> $2', [sessao.user.id, sessao.session.token]);
      return 'ok' as const;
    });
    if (resultado === 'sem-sessao') return c.json({ erro: 'Não autenticado' }, 401);
    if (resultado === 'sem-pendencia') return c.json({ erro: 'Sua senha já foi criada.' }, 409);
    if (resultado === 'vencida') return c.json({ erro: MSG_SENHA_VENCIDA }, 403);
    return c.body(null, 204);
  });
  return r;
}
