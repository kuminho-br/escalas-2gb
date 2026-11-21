// O acesso de um militar ao sistema (fase 6): a senha provisória, desativar e a situação da conta. Quem pode: quem tem papel de cadastro
// (auxiliar administrativo, gestor ou administrador) na lotação do militar ou acima, a mesma regra do GET da ficha.
import { hashPassword } from 'better-auth/crypto';
import { EncerrarPapel, NovoPapel, type AcessoDoMilitar, type Papel, type PapelDoMilitar, type SenhaProvisoria, type SituacaoDoAcesso } from 'contratos';
import { Hono } from 'hono';
import { exigirSessao, temPapel, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { exigirPapelNoRegistro } from '../cadastros/militares.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo } from '../erros.ts';
import { MSG_SEM_EMAIL, MSG_ULTIMO_GESTOR } from './mensagens.ts';
import { gerarSenhaProvisoria } from './senha-provisoria.ts';

const MSG_SO_ADMIN = 'Só o administrador dá ou encerra o papel de administrador.';
const MSG_SEM_PODER = 'Você só dá e encerra papéis na sua unidade e nas de baixo.';
const MSG_ADMIN_NA_RAIZ = 'O papel de administrador só existe na unidade raiz.';
const MSG_JA_ENCERRADO = 'Este papel já foi encerrado.';
const MSG_ATE_ANTES = 'O encerramento não pode ser antes do início do papel.';
const MSG_EMAIL_EM_USO = 'Este e-mail já é de outro militar.';
const MSG_SO_QUEM_PODE_DAR = 'Só quem pode dar o papel dessa pessoa mexe no acesso dela.';
const MSG_SEM_ACESSO = 'Este militar ainda não tem acesso ao sistema.';

/**
 * O usuário do militar, criado se faltar (nome = "posto nome de guerra", e-mail = o da ficha). null se a ficha não tem e-mail: sem e-mail,
 * não há como entrar.
 */
export class EmailEmUso extends Error {}

export async function garantirUsuario(tx: Consulta, militarId: string): Promise<string | null> {
  const m = (await tx.query<{ email: string | null; nome: string }>(
    `select m.email, p.sigla || ' ' || m.nome_guerra as nome from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = $1`,
    [militarId],
  )).rows[0];
  if (!m?.email) return null;
  const existente = (await tx.query<{ id: string }>('select id from usuario where militar_id = $1 for update', [militarId])).rows[0];
  if (existente) return existente.id;
  // o e-mail pode estar guardado no usuário de outro militar (o administrador de instalação, ou quem teve o acesso desativado e o e-mail apagado da ficha)
  if ((await tx.query('select 1 from usuario where lower(email) = lower($1)', [m.email])).rows.length) throw new EmailEmUso();
  return (await tx.query<{ id: string }>('insert into usuario (nome, email, militar_id) values ($1, lower($2), $3) returning id', [m.nome, m.email, militarId])).rows[0]!.id;
}

/** A situação da conta, o e-mail da ficha e os papéis do militar. As listas do que quem olha pode dar vêm da rota que as preenche. */
export async function montarAcesso(c: Consulta, militarId: string): Promise<AcessoDoMilitar> {
  const m = (await c.query<{ email: string | null; usuario_id: string | null; ativo: boolean | null; tem_senha: boolean; provisoria: boolean; prazo: Date | string | null; vencida: boolean }>(
    `select m.email, u.id as usuario_id, u.ativo,
            exists (select 1 from conta k where k.usuario_id = u.id and k.provedor_id = 'credential' and k.senha is not null) as tem_senha,
            u.senha_provisoria_ate is not null as provisoria, u.senha_provisoria_ate as prazo,
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
  return { situacao, email: m.email, senhaProvisoriaAte: m.prazo ? new Date(m.prazo).toISOString() : null, papeis, podeGerarSenha: m.email !== null, papeisQuePodeDar: [], unidadesParaPapel: [] };
}

/** O que quem olha pode dar: o administrador, qualquer papel em qualquer unidade; o gestor, gestor e auxiliar na unidade dele e nas de baixo. */
async function quemPodeDar(c: Consulta, usuarioId: string, hoje: string): Promise<Pick<AcessoDoMilitar, 'papeisQuePodeDar' | 'unidadesParaPapel'>> {
  const vigente = 'pu.desde <= $2 and (pu.ate is null or pu.ate >= $2)';
  const admin = (await c.query<{ ok: boolean }>(`select exists (select 1 from papel_usuario pu where pu.usuario_id = $1 and pu.papel = 'administrador' and ${vigente}) as ok`, [usuarioId, hoje])).rows[0]!.ok;
  const papeisQuePodeDar: Papel[] = [];
  let filtro = '';
  if (admin) papeisQuePodeDar.push('administrador', 'gestor', 'escalante');
  else {
    const gestor = (await c.query<{ ok: boolean }>(`select exists (select 1 from papel_usuario pu where pu.usuario_id = $1 and pu.papel = 'gestor' and ${vigente}) as ok`, [usuarioId, hoje])).rows[0]!.ok;
    if (!gestor) return { papeisQuePodeDar: [], unidadesParaPapel: [] };
    papeisQuePodeDar.push('gestor', 'escalante');
    filtro = `and exists (select 1 from papel_usuario pu join unidade a on a.id = pu.unidade_id where pu.usuario_id = $1 and pu.papel = 'gestor' and ${vigente} and a.caminho @> u.caminho)`;
  }
  const { rows } = await c.query<{ id: string; sigla: string; nivel: number }>(
    `select u.id, u.sigla, nlevel(u.caminho) - 1 as nivel from unidade u where (u.ate is null or u.ate >= $2::date) and $1::uuid is not null ${filtro} order by u.caminho`,
    [usuarioId, hoje],
  );
  return { papeisQuePodeDar, unidadesParaPapel: rows.map((u) => ({ id: u.id, sigla: u.sigla, nivel: Number(u.nivel) })) };
}

/** O acesso do militar, com o que quem pede pode dar. */
async function acessoPara(c: Consulta, militarId: string, usuarioId: string): Promise<AcessoDoMilitar> {
  const acesso = await montarAcesso(c, militarId);
  // o botão acompanha a regra da rota: sem e-mail, ou sem poder sobre os papéis da pessoa, fica desligado
  const podeGerarSenha = acesso.podeGerarSenha && (await podeMexerNaConta(c, usuarioId, militarId)) === null;
  return { ...acesso, podeGerarSenha, ...(await quemPodeDar(c, usuarioId, hojeRecife())) };
}

/** null se quem pede pode dar/encerrar o papel nesta unidade; senão o 403. */
async function podeNaUnidade(c: Consulta, usuarioId: string, papel: Papel, unidadeId: string): Promise<string | null> {
  const hoje = hojeRecife();
  if (papel === 'administrador') {
    const raiz = (await c.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
    return (await temPapel(c, usuarioId, raiz, ['administrador'], hoje)) ? null : MSG_SO_ADMIN;
  }
  return (await temPapel(c, usuarioId, unidadeId, ['gestor', 'administrador'], hoje)) ? null : MSG_SEM_PODER;
}

/**
 * Gerar a senha e desativar o acesso valem só para quem poderia dar todos os papéis da pessoa (que ainda não terminaram): senão o auxiliar
 * geraria a senha de um gestor e entraria como ele. Devolve o texto do 403, ou null.
 */
async function podeMexerNaConta(c: Consulta, usuarioId: string, militarId: string): Promise<string | null> {
  const { rows } = await c.query<{ papel: Papel; unidade_id: string }>(
    `select pu.papel, pu.unidade_id from papel_usuario pu join usuario u on u.id = pu.usuario_id
      where u.militar_id = $1 and (pu.ate is null or pu.ate >= $2::date)`,
    [militarId, hojeRecife()],
  );
  for (const p of rows) {
    if (!(await podeNaUnidade(c, usuarioId, p.papel, p.unidade_id))) continue;
    // a folga do auxiliar (decisão de 21/11/2026): o papel de auxiliar de um colega também passa para quem é auxiliar na unidade dele ou acima
    if (p.papel === 'escalante' && (await temPapel(c, usuarioId, p.unidade_id, ['escalante'], hojeRecife()))) continue;
    return MSG_SO_QUEM_PODE_DAR;
  }
  return null;
}

export function rotasAcesso(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const { banco } = dep;
  r.use('/militares/*', exigirSessao(banco, dep.auth));
  r.use('/papeis/*', exigirSessao(banco, dep.auth));

  r.get('/militares/:id/acesso', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    return c.json(await acessoPara(banco, id, c.get('usuarioId')));
  });

  // gera a senha provisória (vale 7 dias, aparece só nesta resposta). Gerar de novo invalida a anterior e derruba as sessões abertas;
  // numa conta desativada, reativa.
  r.post('/militares/:id/senha-provisoria', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const semPoder = await podeMexerNaConta(banco, c.get('usuarioId'), id);
    if (semPoder) return c.json({ erro: semPoder }, 403);
    const senha = gerarSenhaProvisoria();
    const hash = await hashPassword(senha);
    let validaAte: string | null;
    try {
      validaAte = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
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
    } catch (e) {
      if (e instanceof EmailEmUso) return c.json({ erro: MSG_EMAIL_EM_USO, campos: { email: MSG_EMAIL_EM_USO } }, 409);
      throw e;
    }
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
    const semPoder = await podeMexerNaConta(banco, c.get('usuarioId'), id);
    if (semPoder) return c.json({ erro: semPoder }, 403);
    const tinha = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
      const usuario = (await tx.query<{ id: string }>('select id from usuario where militar_id = $1 for update', [id])).rows[0];
      if (!usuario) return false;
      await tx.query('update usuario set ativo = false, atualizado_em = now() where id = $1', [usuario.id]);
      await tx.query('delete from sessao where usuario_id = $1', [usuario.id]);
      return true;
    });
    if (!tinha) return c.json({ erro: MSG_SEM_ACESSO }, 409);
    return c.json(await acessoPara(banco, id, c.get('usuarioId')));
  });

  r.post('/militares/:id/papeis', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoPapel);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const unidade = (await banco.query<{ mae_id: string | null }>('select mae_id from unidade where id = $1', [d.unidadeId])).rows[0];
    if (!unidade) return c.json({ erro: 'Unidade não encontrada.', campos: { unidadeId: 'Escolha a unidade.' } }, 400);
    const sem = await podeNaUnidade(banco, c.get('usuarioId'), d.papel, d.unidadeId);
    if (sem) return c.json({ erro: sem }, 403);
    if (d.papel === 'administrador' && unidade.mae_id !== null) return c.json({ erro: MSG_ADMIN_NA_RAIZ, campos: { unidadeId: MSG_ADMIN_NA_RAIZ } }, 400);
    let gravou: boolean;
    try {
      gravou = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
        const usuarioId = await garantirUsuario(tx, id);
        if (!usuarioId) return false;
        await tx.query('insert into papel_usuario (usuario_id, unidade_id, papel, desde) values ($1, $2, $3, $4)', [usuarioId, d.unidadeId, d.papel, d.desde]);
        return true;
      });
    } catch (e) {
      if (e instanceof EmailEmUso) return c.json({ erro: MSG_EMAIL_EM_USO, campos: { email: MSG_EMAIL_EM_USO } }, 409);
      throw e;
    }
    if (!gravou) return c.json({ erro: MSG_SEM_EMAIL }, 400);
    return c.json(await acessoPara(banco, id, c.get('usuarioId')), 201);
  });

  // fecha o período na data; o papel não é apagado
  r.post('/papeis/:id/encerrar', async (c) => {
    const papelId = c.req.param('id');
    const p = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(papelId)
      ? (await banco.query<{ usuario_id: string; militar_id: string; unidade_id: string; papel: Papel; desde: string; ate: string | null }>(
          `select pu.usuario_id, u.militar_id, pu.unidade_id, pu.papel, to_char(pu.desde, 'YYYY-MM-DD') as desde, to_char(pu.ate, 'YYYY-MM-DD') as ate
             from papel_usuario pu join usuario u on u.id = pu.usuario_id where pu.id = $1`,
          [papelId],
        )).rows[0]
      : undefined;
    if (!p) return c.json({ erro: 'Papel não encontrado.' }, 404);
    const quem = c.get('usuarioId');
    const sem = await podeNaUnidade(banco, quem, p.papel, p.unidade_id);
    if (sem) return c.json({ erro: sem }, 403);
    const corpo = await lerCorpo(c, EncerrarPapel);
    if (!corpo.ok) return corpo.resposta;
    if (p.ate !== null) return c.json({ erro: MSG_JA_ENCERRADO }, 409);
    if (corpo.dados.ate < p.desde) return c.json({ erro: MSG_ATE_ANTES, campos: { ate: MSG_ATE_ANTES } }, 400);
    // ninguém encerra o próprio último papel de gestor (o administrador pode)
    if (p.usuario_id === quem && p.papel === 'gestor') {
      const hoje = hojeRecife();
      const outros = (await banco.query<{ gestor: boolean; admin: boolean }>(
        `select exists (select 1 from papel_usuario where usuario_id = $1 and papel = 'gestor' and id <> $3 and desde <= $2 and (ate is null or ate >= $2)) as gestor,
                exists (select 1 from papel_usuario where usuario_id = $1 and papel = 'administrador' and desde <= $2 and (ate is null or ate >= $2)) as admin`,
        [quem, hoje, papelId],
      )).rows[0]!;
      if (!outros.gestor && !outros.admin) return c.json({ erro: MSG_ULTIMO_GESTOR }, 409);
    }
    await comUsuario(banco, quem, (tx) => tx.query('update papel_usuario set ate = $2 where id = $1', [papelId, corpo.dados.ate]));
    return c.json(await acessoPara(banco, p.militar_id, quem));
  });

  return r;
}
