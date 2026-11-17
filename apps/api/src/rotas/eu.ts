import { Hono } from 'hono';
import { papeisVigentes, type Papel } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { unidadeAtual } from '../unidade-atual.ts';

export interface Eu {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  /** Vazio = militar comum. */
  papeis: { papel: Papel; unidadeId: string; unidadeSigla: string }[];
  /** Unidade em que as telas trabalham (fixa na fase de teste). */
  unidade: { id: string; sigla: string; caminho: string[] };
}

/** GET /api/eu: quem está logado, o militar, os papéis vigentes hoje (fuso de Recife) e a unidade. */
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
    const papeis = await papeisVigentes(banco, u.id, hojeRecife());
    const eu: Eu = {
      usuario: { id: u.id, nome: u.nome, email: u.email },
      militar: { matricula: u.matricula, postoGrad: u.posto, nomeGuerra: u.nome_guerra },
      papeis: papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidade_id, unidadeSigla: p.sigla })),
      unidade: await unidadeAtual(banco),
    };
    return c.json(eu);
  });
  return r;
}
