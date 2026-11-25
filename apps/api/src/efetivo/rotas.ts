// Rotas do efetivo do dia: a meta de ativação (padrão e dias diferentes).
import { Data, DesativarGuarnicao, DesfazerDesativacao, NovaMetaDoDia, NovaMetaPadrao } from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, GESTAO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import { exigirLeituraDaEscala } from '../visao/leitura.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { Recusa } from '../escala/alocacoes.ts';
import { comPassado, respostaDoPassado, tocadoDaAlocacao, type Tocado } from '../escala/passado.ts';
import { montarEfetivoDoDia } from './efetivo-do-dia.ts';
import { DadosInvalidos, desativar, desfazerDesativacao, gravarMetaDoDia, gravarMetaPadrao, metaDoDia, modelosForaDaSecao, versoesDaMetaPadrao, voltarMetaAoPadrao } from './meta.ts';

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
    const negado = await exigirPapel(c, u, GESTAO);
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

  /** Desativa uma guarnição no dia: sai da meta do dia e desescala quem está nela. Devolve o efetivo do dia e o que tirou (para o "Desfazer"). */
  r.post('/unidades/:u/meta-do-dia/:data/desativar', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    const corpo = await lerCorpo(c, DesativarGuarnicao);
    if (!corpo.ok) return corpo.resposta;
    const usuarioId = c.get('usuarioId');
    try {
      // os turnos que a desativação toca: os das alocações da unidade neste dia que estão na guarnição ou acumulam nela (sai ou vira outra vaga)
      const tocar = async (tx: Consulta): Promise<Tocado[]> =>
        (
          await tx.query<{ escala_id: string; data: string; turno_id: string }>(
            `select distinct a.escala_id, to_char(a.data, 'YYYY-MM-DD') as data, a.turno_id
               from alocacao a join escala e on e.id = a.escala_id
              where e.unidade_id = $1 and a.data = $2::date
                and (a.guarnicao_id = $3 or exists (select 1 from alocacao_acumulo x where x.alocacao_id = a.id and x.guarnicao_id = $3))`,
            [u, data, corpo.dados.guarnicaoId],
          )
        ).rows.map((x) => ({ escalaId: x.escala_id, data: x.data, turnoId: x.turno_id }));
      const desfazer = await comUsuario(dep.banco, usuarioId, (tx) => comPassado(tx, usuarioId, tocar, corpo.dados.justificativa, () => desativar(tx, u, data, corpo.dados.guarnicaoId, usuarioId)));
      return c.json({ efetivo: await montarEfetivoDoDia(dep.banco, u, data), desfazer });
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
  });

  /** Desfaz a desativação com o que ela devolveu: recria as alocações e os acúmulos e devolve a meta. Devolve o efetivo do dia. */
  r.post('/unidades/:u/meta-do-dia/:data/desfazer-desativacao', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    const corpo = await lerCorpo(c, DesfazerDesativacao);
    if (!corpo.ok) return corpo.resposta;
    try {
      const d = corpo.dados;
      // os turnos que o "Desfazer" toca: os das alocações que voltam e os das alocações que perderam um acúmulo ou foram promovidas
      const tocar = async (tx: Consulta): Promise<Tocado[]> => [
        ...d.alocacoes.map((a) => ({ escalaId: a.escalaId, data: a.data, turnoId: a.turnoId })),
        ...(await Promise.all([...new Set([...d.acumulos.map((x) => x.alocacaoId), ...d.promovidas.map((x) => x.alocacaoId)])].map((id) => tocadoDaAlocacao(tx, id)))).flat(),
      ];
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), tocar, d.justificativa, () => desfazerDesativacao(tx, u, data, d)));
      return c.json(await montarEfetivoDoDia(dep.banco, u, data));
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      if (e instanceof DadosInvalidos) return c.json({ erro: 'Os dados para desfazer não são desta seção.' }, 400);
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
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
    const negado = await exigirLeituraDaEscala(c, u);
    if (negado) return negado;
    const data = dataDaRota(c);
    if (!data) return c.json({ erro: MSG_DATA }, 400);
    return c.json(await montarEfetivoDoDia(dep.banco, u, data));
  });

  return r;
}
