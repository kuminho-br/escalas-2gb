// Rotas do efetivo do dia: a meta de ativação (padrão e dias diferentes).
import { Data, NovaMetaDoDia, NovaMetaPadrao } from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, ESCREVE_PARAMETRO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { diasContados, gravarMetaDoDia, gravarMetaPadrao, MAXIMO_DE_DIAS_DA_META, metaDoDia, modelosForaDaSecao, versoesDaMetaPadrao, voltarMetaAoPadrao } from './meta.ts';

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

  r.put('/unidades/:u/meta-do-dia/:data', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, ESCREVE_PARAMETRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    const corpo = await lerCorpo(c, NovaMetaDoDia);
    if (!corpo.ok) return corpo.resposta;
    const { ate = data, guarnicoes } = corpo.dados;
    const campos: Record<string, string> = {};
    if (ate < data) campos.ate = 'O último dia não pode ser antes do primeiro.';
    else if (diasContados(data, ate) > MAXIMO_DE_DIAS_DA_META) campos.ate = `Altere no máximo ${MAXIMO_DE_DIAS_DA_META} dias de uma vez.`;
    const fora = await modelosForaDaSecao(dep.banco, u, guarnicoes);
    if (fora) campos.guarnicoes = fora;
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => gravarMetaDoDia(tx, u, data, ate, guarnicoes));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await metaDoDia(dep.banco, u, data));
  });

  r.delete('/unidades/:u/meta-do-dia/:data', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, ESCREVE_PARAMETRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) => voltarMetaAoPadrao(tx, u, data));
    return c.json(await metaDoDia(dep.banco, u, data));
  });

  return r;
}
