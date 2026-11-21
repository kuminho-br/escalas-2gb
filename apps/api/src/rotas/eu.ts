import { hashPassword } from 'better-auth/crypto';
import { NovaSenha, NovoTelefone, type MinhaFicha, type UnidadeDeTrabalho } from 'contratos';
import { cnhHabilitadas } from 'dominio';
import { Hono } from 'hono';
import { papeisVigentes, type Papel } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo } from '../erros.ts';
import { MSG_SENHA_VENCIDA } from '../usuarios/mensagens.ts';

export interface Eu {
  usuario: { id: string; nome: string; email: string };
  militar: { matricula: string; postoGrad: string; nomeGuerra: string };
  /** Vazio = militar comum. */
  papeis: { papel: Papel; unidadeId: string; unidadeSigla: string }[];
  /** As unidades em que a pessoa pode trabalhar: as dos papéis vigentes e as de baixo (o administrador, todas), na ordem da árvore. O militar comum: só a lotação. */
  unidades: UnidadeDeTrabalho[];
  /** A unidade do período do rastreio de hoje; null sem lotação. */
  lotacao: UnidadeDeTrabalho | null;
  /** Entrou com a senha provisória: só a tela de criar a senha abre até a troca. */
  trocarSenha: boolean;
}

const ORDEM = new Intl.Collator('pt-BR', { numeric: true });
/** A ordem da árvore: o pai antes dos filhos, e os irmãos pela sigla. */
const porCaminho = (a: UnidadeDeTrabalho, b: UnidadeDeTrabalho) => {
  for (let i = 0; i < Math.min(a.caminho.length, b.caminho.length); i++) {
    const c = ORDEM.compare(a.caminho[i]!, b.caminho[i]!);
    if (c) return c;
  }
  return a.caminho.length - b.caminho.length;
};

const COM_CAMINHO = `select u.id, u.sigla, array(select a.sigla from unidade a where a.caminho @> u.caminho order by nlevel(a.caminho)) as caminho from unidade u`;
type LinhaDaUnidade = { id: string; sigla: string; caminho: string[] };
const paraUnidade = (r: LinhaDaUnidade): UnidadeDeTrabalho => ({ id: r.id, sigla: r.sigla, caminho: r.caminho, nivel: r.caminho.length - 1 });

/** As unidades dos papéis vigentes e as de baixo (as extintas não entram). */
async function unidadesDosPapeis(c: Consulta, usuarioId: string, hoje: string): Promise<UnidadeDeTrabalho[]> {
  const { rows } = await c.query<LinhaDaUnidade>(
    `${COM_CAMINHO}
      where (u.ate is null or u.ate >= $2::date)
        and exists (select 1 from papel_usuario pu join unidade p on p.id = pu.unidade_id
                     where pu.usuario_id = $1 and pu.desde <= $2 and (pu.ate is null or pu.ate >= $2) and p.caminho @> u.caminho)`,
    [usuarioId, hoje],
  );
  return rows.map(paraUnidade).sort(porCaminho);
}

/** A unidade do período do rastreio que cobre hoje. */
async function lotacaoDeHoje(c: Consulta, usuarioId: string, hoje: string): Promise<UnidadeDeTrabalho | null> {
  const { rows } = await c.query<LinhaDaUnidade>(
    `${COM_CAMINHO}
      where u.id = (select r.unidade_id from rastreio r join usuario x on x.militar_id = r.militar_id
                     where x.id = $1 and r.desde <= $2 and (r.ate is null or r.ate >= $2) limit 1)`,
    [usuarioId, hoje],
  );
  return rows[0] ? paraUnidade(rows[0]) : null;
}

type LinhaDaFicha = {
  posto: string; nome_guerra: string; nome_completo: string | null; matricula: string; telefone: string | null; email: string | null; sexo: 'M' | 'F' | null;
  nascimento_dia: number | null; nascimento_mes: number | null; comportamento: string | null; comportamento_boletim: string | null;
  motorista: boolean; cnh: string[]; voluntario_jes: boolean;
  lotacao: string | null; equipe: string | null; jornada: 'pronto' | 'adm' | null;
};

/** A ficha do próprio militar (o da sessão), só com o que ele pode ver; a situação é a do período do rastreio que cobre hoje. */
async function minhaFicha(c: Consulta, usuarioId: string, hoje: string): Promise<MinhaFicha | null> {
  const { rows } = await c.query<LinhaDaFicha>(
    `select p.sigla as posto, m.nome_guerra, m.nome_completo, m.matricula, m.telefone, m.email, m.sexo, m.nascimento_dia, m.nascimento_mes,
            m.comportamento, m.comportamento_boletim, m.motorista, m.cnh, m.voluntario_jes,
            un.sigla as lotacao, e.nome as equipe, r.jornada
       from usuario u join militar m on m.id = u.militar_id join posto_grad p on p.id = m.posto_grad_id
       left join rastreio r on r.militar_id = m.id and r.desde <= $2 and (r.ate is null or r.ate >= $2)
       left join unidade un on un.id = r.unidade_id
       left join equipe e on e.id = r.equipe_id
      where u.id = $1 and u.ativo limit 1`,
    [usuarioId, hoje],
  );
  const m = rows[0];
  if (!m) return null;
  const cnh = [...m.cnh].sort();
  return {
    postoGrad: m.posto,
    nomeGuerra: m.nome_guerra,
    nomeCompleto: m.nome_completo,
    matricula: m.matricula,
    telefone: m.telefone,
    email: m.email,
    sexo: m.sexo,
    nascimento: m.nascimento_dia !== null && m.nascimento_mes !== null ? { dia: m.nascimento_dia, mes: m.nascimento_mes } : null,
    comportamento: m.comportamento,
    comportamentoBoletim: m.comportamento_boletim,
    situacao: m.lotacao && m.jornada ? { lotacao: m.lotacao, equipe: m.equipe, jornada: m.jornada } : null,
    motorista: m.motorista,
    cnh,
    cnhPorHierarquia: cnhHabilitadas(cnh).filter((x) => !cnh.includes(x)),
    voluntarioJes: m.voluntario_jes,
  };
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
    const hoje = hojeRecife();
    const papeis = await papeisVigentes(banco, u.id, hoje);
    const lotacao = await lotacaoDeHoje(banco, u.id, hoje);
    const eu: Eu = {
      usuario: { id: u.id, nome: u.nome, email: u.email },
      militar: { matricula: u.matricula, postoGrad: u.posto, nomeGuerra: u.nome_guerra },
      papeis: papeis.map((p) => ({ papel: p.papel, unidadeId: p.unidade_id, unidadeSigla: p.sigla })),
      unidades: papeis.length ? await unidadesDosPapeis(banco, u.id, hoje) : lotacao ? [lotacao] : [],
      lotacao,
      trocarSenha: u.trocar_senha,
    };
    return c.json(eu);
  });

  // a própria ficha: confere a sessão aqui, como no GET (não passa pelo `exigirSessao`, que barra quem ainda não trocou a senha provisória)
  r.get('/ficha', async (c) => {
    const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!sessao) return c.json({ erro: 'Não autenticado' }, 401);
    const ficha = await minhaFicha(banco, sessao.user.id, hojeRecife());
    return ficha ? c.json(ficha) : c.json({ erro: 'Não autenticado' }, 401);
  });

  // só o telefone se altera por aqui; quem ainda tem a senha provisória não chega (o /api/eu manda para a troca)
  r.patch('/telefone', async (c) => {
    const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!sessao) return c.json({ erro: 'Não autenticado' }, 401);
    const corpo = await lerCorpo(c, NovoTelefone);
    if (!corpo.ok) return corpo.resposta;
    const ficha = await comUsuario(banco, sessao.user.id, async (tx) => {
      const { rows } = await tx.query(
        'update militar set telefone = $2 where id = (select militar_id from usuario where id = $1 and ativo and senha_provisoria_ate is null) returning id',
        [sessao.user.id, corpo.dados.telefone],
      );
      return rows.length ? minhaFicha(tx, sessao.user.id, hojeRecife()) : null;
    });
    return ficha ? c.json(ficha) : c.json({ erro: 'Não autenticado' }, 401);
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
