// O cadastro de tipos de unidade (entrega 6.25): grupamento, divisão, seção, pelotão… O tipo é só um nome, e nenhuma regra do sistema depende dele.
// Qualquer conta lê (as telas mostram o nome); só o administrador cria, renomeia, reordena e exclui.
import { AlteracaoDeTipoDeUnidade, NovoTipoDeUnidade, type TipoDeUnidadeComUso } from 'contratos';
import { Hono } from 'hono';
import { exigirAdministradorRaiz, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { lerCorpo } from '../erros.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MSG_NOME = 'Já existe um tipo com este nome.';
const MSG_EM_USO = 'Há unidades deste tipo.';
const MSG_NAO_ENCONTRADO = 'Tipo de unidade não encontrado.';

/** O código sai do nome: minúsculas, sem acento, as palavras ligadas por "_". */
export const codigoDoTipo = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const SELECT = `select t.id, t.codigo, t.nome, t.ordem, (select count(*)::int from unidade u where u.tipo = t.codigo) as unidades from tipo_unidade t`;

async function listar(c: Consulta): Promise<TipoDeUnidadeComUso[]> {
  return (await c.query<TipoDeUnidadeComUso>(`${SELECT} order by t.ordem, t.codigo`)).rows;
}
async function doId(c: Consulta, id: string): Promise<TipoDeUnidadeComUso | undefined> {
  return UUID.test(id) ? (await c.query<TipoDeUnidadeComUso>(`${SELECT} where t.id = $1`, [id])).rows[0] : undefined;
}
/** Outro tipo com o mesmo código (o nome sem acento e sem diferenciar maiúsculas)? */
async function repetido(c: Consulta, nome: string, menosId: string | null): Promise<boolean> {
  const codigo = codigoDoTipo(nome);
  const { rows } = await c.query<{ id: string; nome: string; codigo: string }>('select id, nome, codigo from tipo_unidade');
  return rows.some((t) => t.id !== menosId && (t.codigo === codigo || codigoDoTipo(t.nome) === codigo));
}

export function rotasTiposDeUnidade(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/tipos-de-unidade', '/tipos-de-unidade/:id']) r.use(caminho, sessao);
  const soAdministrador = (c: Parameters<typeof exigirAdministradorRaiz>[0]) => exigirAdministradorRaiz(c, 'Só o administrador do sistema altera os tipos de unidade.');

  r.get('/tipos-de-unidade', async (c) => c.json(await listar(c.get('banco'))));

  r.post('/tipos-de-unidade', async (c) => {
    const negado = await soAdministrador(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoTipoDeUnidade);
    if (!corpo.ok) return corpo.resposta;
    const { nome, ordem } = corpo.dados;
    const codigo = codigoDoTipo(nome);
    if (!codigo) return c.json({ erro: 'Use letras ou números no nome.', campos: { nome: 'Use letras ou números no nome.' } }, 400);
    const id = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) => {
      // a trava no cadastro põe em fila dois pedidos com o mesmo nome
      await tx.query('lock table tipo_unidade in share row exclusive mode');
      if (await repetido(tx, nome, null)) return null;
      const proxima = ordem ?? ((await tx.query<{ m: number | null }>('select max(ordem) as m from tipo_unidade')).rows[0]!.m ?? -1) + 1;
      return (await tx.query<{ id: string }>('insert into tipo_unidade (codigo, nome, ordem) values ($1, $2, $3) returning id', [codigo, nome, proxima])).rows[0]!.id;
    });
    if (!id) return c.json({ erro: MSG_NOME, campos: { nome: MSG_NOME } }, 409);
    return c.json(await doId(c.get('banco'), id), 201);
  });

  r.patch('/tipos-de-unidade/:id', async (c) => {
    const negado = await soAdministrador(c);
    if (negado) return negado;
    const banco = c.get('banco');
    const tipo = await doId(banco, c.req.param('id'));
    if (!tipo) return c.json({ erro: MSG_NAO_ENCONTRADO }, 404);
    const corpo = await lerCorpo(c, AlteracaoDeTipoDeUnidade);
    if (!corpo.ok) return corpo.resposta;
    const { nome, ordem } = corpo.dados;
    const gravou = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
      await tx.query('lock table tipo_unidade in share row exclusive mode');
      if (nome !== undefined && (await repetido(tx, nome, tipo.id))) return false;
      await tx.query('update tipo_unidade set nome = coalesce($2, nome), ordem = coalesce($3, ordem) where id = $1', [tipo.id, nome ?? null, ordem ?? null]);
      return true;
    });
    if (!gravou) return c.json({ erro: MSG_NOME, campos: { nome: MSG_NOME } }, 409);
    return c.json(await doId(banco, tipo.id));
  });

  // só o tipo que nenhuma unidade usa, nem extinta (a unidade extinta continua no histórico)
  r.delete('/tipos-de-unidade/:id', async (c) => {
    const negado = await soAdministrador(c);
    if (negado) return negado;
    const banco = c.get('banco');
    const tipo = await doId(banco, c.req.param('id'));
    if (!tipo) return c.json({ erro: MSG_NAO_ENCONTRADO }, 404);
    if (tipo.unidades > 0) return c.json({ erro: MSG_EM_USO }, 409);
    await comUsuario(banco, c.get('usuarioId'), (tx) => tx.query('delete from tipo_unidade where id = $1', [tipo.id]));
    return c.body(null, 204);
  });

  return r;
}
