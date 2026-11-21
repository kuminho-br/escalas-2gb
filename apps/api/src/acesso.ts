// Quem está logado e o que pode fazer (adendo do design, "Atores").
// Papéis valem para a unidade e as de baixo. Sem papel vigente, o usuário é militar comum:
// entra no site, mas não vê cadastros.
import type { Context, MiddlewareHandler } from 'hono';
import type { Auth } from './auth.ts';
import type { Banco, Consulta } from './banco/banco.ts';
import { hojeRecife } from './datas.ts';
import { MSG_CRIE_A_SENHA, MSG_SENHA_VENCIDA } from './usuarios/mensagens.ts';

export type Papel = 'administrador' | 'gestor' | 'escalante';

export type AmbienteApi = { Variables: { usuarioId: string; banco: Banco } };

export const CADASTRO: Papel[] = ['escalante', 'gestor', 'administrador'];
export const ESCREVE_PARAMETRO: Papel[] = ['gestor', 'administrador'];

const VIGENTE = 'pu.desde <= $2 and (pu.ate is null or pu.ate >= $2)';

/** Papéis vigentes na data, com a unidade de cada um. */
export async function papeisVigentes(c: Consulta, usuarioId: string, hoje: string) {
  const { rows } = await c.query<{ papel: Papel; unidade_id: string; sigla: string }>(
    `select pu.papel, pu.unidade_id, un.sigla
       from papel_usuario pu join unidade un on un.id = pu.unidade_id
      where pu.usuario_id = $1 and ${VIGENTE}
      order by pu.papel, un.sigla`,
    [usuarioId, hoje],
  );
  return rows;
}

/** Tem um dos papéis, vigente na data, na unidade ou numa acima dela? */
export async function temPapel(c: Consulta, usuarioId: string, unidadeId: string, papeis: Papel[], hoje: string): Promise<boolean> {
  const { rows } = await c.query<{ ok: boolean }>(
    `select exists (
       select 1
         from papel_usuario pu
         join unidade a on a.id = pu.unidade_id
         join unidade u on u.id = $3
        where pu.usuario_id = $1 and ${VIGENTE} and pu.papel = any($4) and a.caminho @> u.caminho
     ) as ok`,
    [usuarioId, hoje, unidadeId, papeis],
  );
  return rows[0]!.ok;
}

/**
 * Tem um dos papéis, vigente na data, numa unidade ACIMA da unidade (a mãe ou mais alta), nunca nela própria? É o "papel de cima"
 * que dá a posse dos blocos do Pecúlio da ficha do militar (o escalante da seção não é dono do que é da seção de pessoal).
 */
export async function temPapelAcima(c: Consulta, usuarioId: string, unidadeId: string, papeis: Papel[], hoje: string): Promise<boolean> {
  const { rows } = await c.query<{ ok: boolean }>(
    `select exists (
       select 1
         from papel_usuario pu
         join unidade a on a.id = pu.unidade_id
         join unidade u on u.id = $3
        where pu.usuario_id = $1 and ${VIGENTE} and pu.papel = any($4) and a.caminho @> u.caminho and a.id <> u.id
     ) as ok`,
    [usuarioId, hoje, unidadeId, papeis],
  );
  return rows[0]!.ok;
}

/**
 * Importar o Pecúlio é de quem tem papel numa unidade ACIMA das seções da unidade importada (o dono dos blocos do Pecúlio): existe, na unidade
 * ou abaixo dela, uma seção cuja unidade de cima a pessoa tem. 403 com a frase de quem altera (a unidade mãe da importada, "2º GB" para a 1ª SB).
 */
export async function exigirPapelDeCimaDasSecoes(c: Context<AmbienteApi>, unidadeId: string, papeis: Papel[]): Promise<Response | null> {
  const banco = c.get('banco');
  const { rows } = await banco.query<{ ok: boolean }>(
    `select exists (
       select 1
         from papel_usuario pu
         join unidade a on a.id = pu.unidade_id
         join unidade u on u.id = $3
         join unidade s on s.caminho <@ u.caminho
        where pu.usuario_id = $1 and ${VIGENTE} and pu.papel = any($4) and a.caminho @> s.caminho and a.id <> s.id
     ) as ok`,
    [c.get('usuarioId'), hojeRecife(), unidadeId, papeis],
  );
  if (rows[0]!.ok) return null;
  const mae = (await banco.query<{ sigla: string }>('select m.sigla from unidade u join unidade m on m.id = u.mae_id where u.id = $1', [unidadeId])).rows[0]?.sigla;
  return c.json({ erro: `A importação do Pecúlio é de quem tem papel no ${mae ?? 'nível acima'}.` }, 403);
}

/** Exige sessão; põe o usuário e o banco no contexto. */
export function exigirSessao(banco: Banco, auth: Auth): MiddlewareHandler<AmbienteApi> {
  return async (c, next) => {
    const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!sessao) return c.json({ erro: 'Entre no sistema para continuar.' }, 401);
    // usuário desativado perde o acesso na hora: a sessão já aberta não vale (o gancho do login só barra sessão nova)
    const u = (await banco.query<{ ativo: boolean; provisoria: boolean; vencida: boolean }>(
      'select ativo, senha_provisoria_ate is not null as provisoria, coalesce(senha_provisoria_ate < now(), false) as vencida from usuario where id = $1',
      [sessao.user.id],
    )).rows[0];
    if (!u?.ativo) return c.json({ erro: 'Entre no sistema para continuar.' }, 401);
    // com a senha provisória, a pessoa só chega à tela de criar a senha (as rotas de /api/eu): o resto espera a troca
    if (u.provisoria) return c.json({ erro: u.vencida ? MSG_SENHA_VENCIDA : MSG_CRIE_A_SENHA }, 403);
    c.set('usuarioId', sessao.user.id);
    c.set('banco', banco);
    await next();
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** null se pode; senão a resposta de erro (404 unidade inexistente, 403 sem papel). */
export async function exigirPapel(c: Context<AmbienteApi>, unidadeId: string, papeis: Papel[]): Promise<Response | null> {
  const banco = c.get('banco');
  const usuarioId = c.get('usuarioId');
  const unidade = UUID.test(unidadeId)
    ? (await banco.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]
    : undefined;
  if (!unidade) return c.json({ erro: 'Unidade não encontrada.' }, 404);
  const hoje = hojeRecife();
  if (await temPapel(banco, usuarioId, unidadeId, papeis, hoje)) return null;
  const algum = await papeisVigentes(banco, usuarioId, hoje);
  const erro = algum.length ? `Você não tem permissão nos cadastros de ${unidade.sigla}.` : 'Esta tela é dos auxiliares administrativos e gestores.';
  return c.json({ erro }, 403);
}

/** Qualquer papel vigente (escalante, gestor ou administrador); o militar comum recebe 403. */
export async function exigirAlgumPapel(c: Context<AmbienteApi>): Promise<Response | null> {
  const papeis = await papeisVigentes(c.get('banco'), c.get('usuarioId'), hojeRecife());
  return papeis.length ? null : c.json({ erro: 'Esta tela é dos auxiliares administrativos e gestores.' }, 403);
}

/** Catálogos do sistema: só o administrador (que só existe na raiz). */
export async function exigirAdministradorRaiz(c: Context<AmbienteApi>): Promise<Response | null> {
  const banco = c.get('banco');
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  if (await temPapel(banco, c.get('usuarioId'), raiz, ['administrador'], hojeRecife())) return null;
  return c.json({ erro: 'Só o administrador do sistema altera esta lista.' }, 403);
}

type TabelaComUnidade = 'militar' | 'afastamento' | 'funcao' | 'guarnicao' | 'servico' | 'turno' | 'escala' | 'feriado' | 'cota' | 'alocacao' | 'remocao' | 'acumulo';

const SQL_UNIDADE: Record<TabelaComUnidade, string> = {
  militar: 'select unidade_id from rastreio where militar_id = $1 order by desde desc limit 1',
  afastamento:
    'select l.unidade_id from afastamento a join rastreio l on l.militar_id = a.militar_id where a.id = $1 order by l.desde desc limit 1',
  funcao: 'select unidade_id from funcao where id = $1',
  guarnicao: 'select unidade_id from guarnicao where id = $1',
  servico: 'select unidade_id from servico where id = $1',
  turno: 'select s.unidade_id from turno t join servico s on s.id = t.servico_id where t.id = $1',
  escala: 'select unidade_id from escala where id = $1',
  feriado: 'select unidade_id from feriado where id = $1',
  cota: 'select unidade_id from cota where id = $1',
  alocacao: 'select e.unidade_id from alocacao a join escala e on e.id = a.escala_id where a.id = $1',
  remocao: 'select e.unidade_id from remocao r join escala e on e.id = r.escala_id where r.id = $1',
  acumulo:
    'select e.unidade_id from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id join escala e on e.id = a.escala_id where x.id = $1',
};

/** Unidade dona de um registro (para conferir o papel); null se não existe. */
export async function unidadeDoRegistro(c: Consulta, tabela: TabelaComUnidade, id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await c.query<{ unidade_id: string }>(SQL_UNIDADE[tabela], [id]);
  return rows[0]?.unidade_id ?? null;
}
