// O cadastro das equipes (6.64): as padrão são da corporação e as unidades as herdam, como os feriados (a unidade vê as da corporação, as das unidades acima e as suas).
// O gestor cria (só do tipo ADM), renomeia e exclui as da própria unidade; as herdadas, só quem as criou. As quatro do Pronto e a Externa são as padrão, criadas pela migração.
import { EdicaoDeEquipe, NovaEquipe, type Equipe, type ResultadoDaExclusaoDeEquipe } from 'contratos';
import { conferirEquipeEJornada, normalizar } from 'dominio';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, GESTAO, papeisVigentes, temPapel, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';

type Ctx = Context<AmbienteApi>;
export const MSG_NOME_REPETIDO = 'Já existe uma equipe com esse nome.';
export const MSG_USADA_E_DESATIVADA = 'A equipe já foi usada; ela foi desativada em vez de apagada.';
const MSG_PADRAO = 'As equipes padrão da corporação não se excluem: só se renomeiam.';

const SELECT = `select e.id, e.nome, e.tipo, e.posicao_ciclo as "posicaoCiclo", e.ativa, e.unidade_id as "unidadeId", un.sigla as "unidadeSigla", un.mae_id is null as "daCorporacao", e.unidade_id <> alvo.id as herdada
                  from equipe e join unidade un on un.id = e.unidade_id join unidade alvo on alvo.id = $1`;
/** Pronto pela posição, depois ADM por nome, depois a Externa. */
const ORDEM = `order by case e.tipo when 'pronto' then 0 when 'adm' then 1 else 2 end, e.posicao_ciclo, lower(e.nome)`;

/** As equipes que a unidade vê (as da corporação, as das unidades acima e as suas), ativas e desativadas, na ordem da tela. `herdada`: não é da unidade pedida. */
export async function equipesVisiveis(c: Consulta, unidadeId: string): Promise<Equipe[]> {
  return (await c.query<Equipe>(`${SELECT} where un.caminho @> alvo.caminho ${ORDEM}`, [unidadeId])).rows;
}

/**
 * A recusa de pôr esta equipe no rastreio (a ficha, a edição do período, o lote): a equipe precisa ser da unidade da lotação ou de uma acima, estar ativa e combinar com a jornada
 * (`conferirEquipeEJornada`). `null` quando pode.
 */
export async function recusaDaEquipeNoRastreio(c: Consulta, equipeId: string, unidadeId: string, jornada: 'pronto' | 'adm'): Promise<string | null> {
  const e = (
    await c.query<{ tipo: 'pronto' | 'adm' | 'externa'; ativa: boolean }>(
      'select e.tipo, e.ativa from equipe e join unidade un on un.id = e.unidade_id join unidade alvo on alvo.id = $2 where e.id = $1 and un.caminho @> alvo.caminho',
      [equipeId, unidadeId],
    )
  ).rows[0];
  if (!e) return 'Escolha uma equipe da unidade da lotação.';
  if (!e.ativa) return 'Esta equipe está desativada.';
  return conferirEquipeEJornada(e.tipo, jornada);
}

async function equipeVista(c: Consulta, unidadeId: string, id: string): Promise<Equipe> {
  return (await c.query<Equipe>(`${SELECT} where e.id = $2`, [unidadeId, id])).rows[0]!;
}

/** O nome (sem diferenciar maiúsculas nem acentos) já existe entre as equipes que a unidade vê ou nas de baixo dela (para não criar um nome que já exista lá embaixo)? */
async function nomeJaExiste(c: Consulta, unidadeId: string, nome: string, exceto?: string): Promise<boolean> {
  const { rows } = await c.query<{ id: string; nome: string }>(
    `select e.id, e.nome from equipe e join unidade un on un.id = e.unidade_id join unidade alvo on alvo.id = $1 where un.caminho @> alvo.caminho or un.caminho <@ alvo.caminho`,
    [unidadeId],
  );
  const chave = normalizar(nome);
  return rows.some((r) => r.id !== exceto && normalizar(r.nome) === chave);
}

export function rotasEquipes(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/equipes', '/equipes/*']) r.use(caminho, sessao);

  /** A equipe e a unidade que a criou, para conferir quem pode mexer: 404 se não existe, 403 com a frase fixa se a equipe é de outra unidade. */
  async function daEquipe(c: Ctx, id: string): Promise<{ resposta: Response } | { unidadeId: string; tipo: string }> {
    const unidadeId = await unidadeDoRegistro(dep.banco, 'equipe', id);
    if (!unidadeId) return { resposta: c.json({ erro: 'Equipe não encontrada.' }, 404) };
    const hoje = hojeRecife();
    if (!(await temPapel(dep.banco, c.get('usuarioId'), unidadeId, GESTAO, hoje))) {
      const sigla = (await dep.banco.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]!.sigla;
      const algum = (await papeisVigentes(dep.banco, c.get('usuarioId'), hoje)).length > 0;
      return { resposta: c.json({ erro: algum ? `Esta equipe é de ${sigla}; só quem a criou pode mudar.` : 'Esta tela é dos auxiliares administrativos e gestores.' }, 403) };
    }
    const tipo = (await dep.banco.query<{ tipo: string }>('select tipo from equipe where id = $1', [id])).rows[0]!.tipo;
    return { unidadeId, tipo };
  }

  r.get('/unidades/:u/equipes', async (c) => {
    const negado = await exigirPapel(c, c.req.param('u'), CADASTRO);
    if (negado) return negado;
    return c.json(await equipesVisiveis(dep.banco, c.req.param('u')));
  });

  r.post('/unidades/:u/equipes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, GESTAO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaEquipe);
    if (!corpo.ok) return corpo.resposta;
    if (await nomeJaExiste(dep.banco, u, corpo.dados.nome)) return c.json({ erro: MSG_NOME_REPETIDO, campos: { nome: MSG_NOME_REPETIDO } }, 409);
    try {
      const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (await tx.query<{ id: string }>("insert into equipe (unidade_id, nome, tipo) values ($1, $2, 'adm') returning id", [u, corpo.dados.nome])).rows[0]!.id;
        return equipeVista(tx, u, id);
      });
      return c.json(e, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, { '23505': MSG_NOME_REPETIDO });
    }
  });

  r.patch('/equipes/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daEquipe(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, EdicaoDeEquipe);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    if (d.nome !== undefined && (await nomeJaExiste(dep.banco, acesso.unidadeId, d.nome, id))) return c.json({ erro: MSG_NOME_REPETIDO, campos: { nome: MSG_NOME_REPETIDO } }, 409);
    try {
      const e = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('update equipe set nome = coalesce($2::text, nome), ativa = coalesce($3::boolean, ativa) where id = $1', [id, d.nome ?? null, d.ativa ?? null]);
        return equipeVista(tx, acesso.unidadeId, id);
      });
      return c.json(e);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, { '23505': MSG_NOME_REPETIDO });
    }
  });

  r.delete('/equipes/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await daEquipe(c, id);
    if ('resposta' in acesso) return acesso.resposta;
    // as padrão da corporação não se excluem: o Pronto e a Externa nunca, e a ADM enquanto for a única da corporação
    const daRaiz = (await dep.banco.query<{ raiz: boolean }>('select mae_id is null as raiz from unidade where id = $1', [acesso.unidadeId])).rows[0]!.raiz;
    if (daRaiz) {
      const outrasAdm = (await dep.banco.query<{ n: number }>("select count(*)::int as n from equipe where unidade_id = $1 and tipo = 'adm' and ativa and id <> $2", [acesso.unidadeId, id])).rows[0]!.n;
      if (acesso.tipo !== 'adm' || outrasAdm === 0) return c.json({ erro: MSG_PADRAO }, 409);
    }
    const resultado = await comUsuario(dep.banco, c.get('usuarioId'), async (tx): Promise<ResultadoDaExclusaoDeEquipe> => {
      const usada = (await tx.query('select 1 from rastreio where equipe_id = $1 limit 1', [id])).rows.length > 0;
      if (usada) {
        await tx.query('update equipe set ativa = false where id = $1', [id]);
        return { desativada: true, aviso: MSG_USADA_E_DESATIVADA };
      }
      await tx.query('delete from equipe where id = $1', [id]);
      return { desativada: false };
    });
    return c.json(resultado);
  });

  return r;
}
