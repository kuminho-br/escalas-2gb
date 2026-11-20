// Rotas do efetivo do dia: a meta de ativação (padrão e dias diferentes).
import { Data, NovaMetaDoDia, NovaMetaPadrao, TirarDaMeta } from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, ESCREVE_PARAMETRO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { Recusa } from '../escala/alocacoes.ts';
import { montarEfetivoDoDia } from './efetivo-do-dia.ts';
import { gravarMetaDoDia, gravarMetaPadrao, metaDoDia, modelosForaDaSecao, tirarDaMeta, versoesDaMetaPadrao, voltarMetaAoPadrao } from './meta.ts';

type Ctx = Context<AmbienteApi>;
const MSG_DATA = 'Data inválida: use o formato aaaa-mm-dd.';

export function rotasEfetivo(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/meta-padrao', '/unidades/:u/meta-do-dia/*', '/unidades/:u/efetivo-do-dia/*']) r.use(caminho, sessao);

  const dataDaRota = (c: Ctx): string | null => (Data.safeParse(c.req.param('data')).success ? c.req.param('data')! : null);

  r.get('/unidades/:u/meta-padrao', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    return c.json(await versoesDaMetaPadrao(dep.banco, u));
  });

  r.put('/unidades/:u/meta-padrao', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, ESCREVE_PARAMETRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaMetaPadrao);
    if (!corpo.ok) return corpo.resposta;
    const { desde, guarnicoes } = corpo.dados;
    const campos: Record<string, string> = {};
    if (desde < hojeRecife()) campos.desde = 'A meta padrão muda de hoje em diante.';
    const fora = await modelosForaDaSecao(dep.banco, u, guarnicoes);
    if (fora) campos.guarnicoes = fora;
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => gravarMetaPadrao(tx, u, desde, guarnicoes));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await versoesDaMetaPadrao(dep.banco, u));
  });

  r.get('/unidades/:u/meta-do-dia/:data', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    return c.json(await metaDoDia(dep.banco, u, data));
  });

  // a meta do dia é consequência de escalar: quem escala mexe nela (a meta padrão continua com gestor e administrador)
  r.put('/unidades/:u/meta-do-dia/:data', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    const corpo = await lerCorpo(c, NovaMetaDoDia);
    if (!corpo.ok) return corpo.resposta;
    const { guarnicoes } = corpo.dados;
    const fora = await modelosForaDaSecao(dep.banco, u, guarnicoes);
    if (fora) return c.json({ erro: 'Confira os campos destacados.', campos: { guarnicoes: fora } }, 400);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => gravarMetaDoDia(tx, u, data, guarnicoes));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await metaDoDia(dep.banco, u, data));
  });

  /** Tira uma guarnição da meta do dia e, se pedido, desescala quem está nela no dia; devolve o efetivo do dia. */
  r.post('/unidades/:u/meta-do-dia/:data/tirar', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    const corpo = await lerCorpo(c, TirarDaMeta);
    if (!corpo.ok) return corpo.resposta;
    const usuarioId = c.get('usuarioId');
    try {
      await comUsuario(dep.banco, usuarioId, (tx) => tirarDaMeta(tx, u, data, corpo.dados.guarnicaoId, corpo.dados.desescalar, usuarioId));
    } catch (e) {
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await montarEfetivoDoDia(dep.banco, u, data));
  });

  r.delete('/unidades/:u/meta-do-dia/:data', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) => voltarMetaAoPadrao(tx, u, data));
    return c.json(await metaDoDia(dep.banco, u, data));
  });

  r.get('/unidades/:u/efetivo-do-dia/:data', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    return c.json(await montarEfetivoDoDia(dep.banco, u, data));
  });

  return r;
}
