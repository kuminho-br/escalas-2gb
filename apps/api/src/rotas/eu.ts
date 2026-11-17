import { Hono } from 'hono';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';

export interface Eu {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  papeis: { papel: 'administrador' | 'chefe' | 'escalante'; unidadeId: string; unidadeSigla: string }[];
}

/** GET /api/eu: quem está logado, o militar e os papéis vigentes hoje (fuso de Recife). */
export function rotasEu(banco: Banco, auth: Auth): Hono {
  const r = new Hono();
  r.get('/', async (c) => {
    const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!sessao) return c.json({ erro: 'Não autenticado' }, 401);
    const { rows } = await banco.query<{ id: string; nome: string; email: string; matricula: string; posto: string; nome_guerra: string }>(
      `select u.id, u.nome, u.email, m.matricula, p.sigla as posto, m.nome_guerra
         from usuario u join militar m on m.id = u.militar_id join posto_grad p on p.id = m.posto_grad_id
        where u.id = $1 and u.ativo`,
      [sessao.user.id],
    );
    const u = rows[0];
    if (!u) return c.json({ erro: 'Não autenticado' }, 401);
    const hoje = hojeRecife();
    const papeis = await banco.query<{ papel: Eu['papeis'][number]['papel']; unidade_id: string; sigla: string }>(
      `select pu.papel, pu.unidade_id, un.sigla
         from papel_usuario pu join unidade un on un.id = pu.unidade_id
        where pu.usuario_id = $1 and pu.desde <= $2 and (pu.ate is null or pu.ate >= $2)
        order by pu.papel, un.sigla`,
      [u.id, hoje],
    );
    const eu: Eu = {
      usuario: { id: u.id, nome: u.nome, email: u.email },
      militar: { matricula: u.matricula, postoGrad: u.posto, nomeGuerra: u.nome_guerra },
      papeis: papeis.rows.map((p) => ({ papel: p.papel, unidadeId: p.unidade_id, unidadeSigla: p.sigla })),
    };
    return c.json(eu);
  });
  return r;
}
