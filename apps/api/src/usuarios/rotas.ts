// O acesso de um militar ao sistema (fase 6): a senha provisória, desativar e a situação da conta. Quem pode: quem tem papel de cadastro
// (auxiliar administrativo, gestor ou administrador) na lotação do militar ou acima, a mesma regra do GET da ficha.
import { hashPassword } from 'better-auth/crypto';
import type { AcessoDoMilitar, PapelDoMilitar, SenhaProvisoria, SituacaoDoAcesso } from 'contratos';
import { Hono } from 'hono';
import { exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { exigirPapelNoRegistro } from '../cadastros/militares.ts';
import { MSG_SEM_EMAIL } from './mensagens.ts';
import { gerarSenhaProvisoria } from './senha-provisoria.ts';

const MSG_SEM_ACESSO = 'Este militar ainda não tem acesso ao sistema.';

/**
 * O usuário do militar, criado se faltar (nome = "posto nome de guerra", e-mail = o da ficha). null se a ficha não tem e-mail: sem e-mail,
 * não há como entrar.
 */
export async function garantirUsuario(tx: Consulta, militarId: string): Promise<string | null> {
  const m = (await tx.query<{ email: string | null; nome: string }>(
    `select m.email, p.sigla || ' ' || m.nome_guerra as nome from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = $1`,
    [militarId],
  )).rows[0];
  if (!m?.email) return null;
  const existente = (await tx.query<{ id: string }>('select id from usuario where militar_id = $1 for update', [militarId])).rows[0];
  if (existente) return existente.id;
  return (await tx.query<{ id: string }>('insert into usuario (nome, email, militar_id) values ($1, lower($2), $3) returning id', [m.nome, m.email, militarId])).rows[0]!.id;
}

/** A situação da conta, o e-mail da ficha e os papéis do militar. As listas do que quem olha pode dar vêm da rota que as preenche. */
export async function montarAcesso(c: Consulta, militarId: string): Promise<AcessoDoMilitar> {
  const m = (await c.query<{ email: string | null; usuario_id: string | null; ativo: boolean | null; tem_senha: boolean; provisoria: boolean; vencida: boolean }>(
    `select m.email, u.id as usuario_id, u.ativo,
            exists (select 1 from conta k where k.usuario_id = u.id and k.provedor_id = 'credential' and k.senha is not null) as tem_senha,
            u.senha_provisoria_ate is not null as provisoria,
            coalesce(u.senha_provisoria_ate < now(), false) as vencida
       from militar m left join usuario u on u.militar_id = m.id
      where m.id = $1`,
    [militarId],
  )).rows[0]!;
  const situacao: SituacaoDoAcesso = !m.usuario_id || !m.tem_senha ? 'sem-acesso' : !m.ativo ? 'desativado' : m.vencida ? 'provisoria-vencida' : m.provisoria ? 'provisoria' : 'ativo';
  const papeis = m.usuario_id
    ? (await c.query<{ id: string; papel: PapelDoMilitar['papel']; unidade_id: string; sigla: string; desde: string; ate: string | null }>(
        `select pu.id, pu.papel, pu.unidade_id, un.sigla, to_char(pu.desde, 'YYYY-MM-DD') as desde, to_char(pu.ate, 'YYYY-MM-DD') as ate
           from papel_usuario pu join unidade un on un.id = pu.unidade_id
          where pu.usuario_id = $1 order by pu.desde desc, un.sigla, pu.papel`,
        [m.usuario_id],
      )).rows.map((p): PapelDoMilitar => ({ id: p.id, papel: p.papel, unidadeId: p.unidade_id, unidadeSigla: p.sigla, desde: p.desde, ate: p.ate }))
    : [];
  return { situacao, email: m.email, papeis, podeGerarSenha: m.email !== null, papeisQuePodeDar: [], unidadesParaPapel: [] };
}

export function rotasAcesso(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const { banco } = dep;
  r.use('/militares/*', exigirSessao(banco, dep.auth));

  r.get('/militares/:id/acesso', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    return c.json(await montarAcesso(banco, id));
  });

  // gera a senha provisória (vale 7 dias, aparece só nesta resposta). Gerar de novo invalida a anterior e derruba as sessões abertas;
  // numa conta desativada, reativa.
  r.post('/militares/:id/senha-provisoria', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const senha = gerarSenhaProvisoria();
    const hash = await hashPassword(senha);
    const validaAte = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
      const usuarioId = await garantirUsuario(tx, id);
      if (!usuarioId) return null;
      const conta = (await tx.query<{ id: string }>("select id from conta where usuario_id = $1 and provedor_id = 'credential'", [usuarioId])).rows[0];
      if (conta) await tx.query('update conta set senha = $2, atualizado_em = now() where id = $1', [conta.id, hash]);
      else await tx.query("insert into conta (usuario_id, conta_id, provedor_id, senha) values ($1, $2, 'credential', $3)", [usuarioId, usuarioId, hash]);
      const prazo = (await tx.query<{ ate: Date | string }>(
        "update usuario set senha_provisoria_ate = now() + interval '7 days', ativo = true, atualizado_em = now() where id = $1 returning senha_provisoria_ate as ate",
        [usuarioId],
      )).rows[0]!.ate;
      await tx.query('delete from sessao where usuario_id = $1', [usuarioId]);
      return new Date(prazo).toISOString();
    });
    if (!validaAte) return c.json({ erro: MSG_SEM_EMAIL }, 400);
    // a senha não pode ficar guardada em nenhum cache
    c.header('Cache-Control', 'no-store');
    return c.json({ senha, validaAte } satisfies SenhaProvisoria, 201);
  });

  // a pessoa deixa de entrar e as sessões dela se encerram; os papéis ficam no histórico
  r.post('/militares/:id/desativar-acesso', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const tinha = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
      const usuario = (await tx.query<{ id: string }>('select id from usuario where militar_id = $1 for update', [id])).rows[0];
      if (!usuario) return false;
      await tx.query('update usuario set ativo = false, atualizado_em = now() where id = $1', [usuario.id]);
      await tx.query('delete from sessao where usuario_id = $1', [usuario.id]);
      return true;
    });
    if (!tinha) return c.json({ erro: MSG_SEM_ACESSO }, 409);
    return c.json(await montarAcesso(banco, id));
  });

  return r;
}
