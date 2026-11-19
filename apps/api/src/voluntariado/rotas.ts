// Voluntariado lançado à mão: ler a lista do mês e as marcações de um militar, e lançar o mês de um militar.
import { LancamentoDeVoluntariado, Mes, mesPorExtenso } from 'contratos';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { lancar } from './lancamento.ts';
import { lotadosNoMes, voluntariadoDoMes, voluntariadoDoMilitar } from './leitura.ts';

const MES_INVALIDO = 'Mês inválido: use o formato aaaa-mm.';

export function rotasVoluntariado(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/voluntariado/*', '/militares/:id/voluntariado/*']) r.use(caminho, sessao);

  r.get('/unidades/:u/voluntariado/:mes', async (c) => {
    const negado = await exigirPapel(c, c.req.param('u'), CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    return c.json(await voluntariadoDoMes(dep.banco, c.req.param('u'), mes));
  });

  r.get('/militares/:id/voluntariado/:mes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'militar', id);
    if (!unidadeId) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    return c.json(await voluntariadoDoMilitar(dep.banco, unidadeId, id, mes));
  });

  /** Lança o mês inteiro do militar (substitui o que havia) e devolve a lista do mês para a tela passar ao próximo. */
  r.put('/militares/:id/voluntariado/:mes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'militar', id);
    if (!unidadeId) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const corpo = await lerCorpo(c, LancamentoDeVoluntariado);
    if (!corpo.ok) return corpo.resposta;
    const campos: Record<string, string> = {};
    corpo.dados.marcas.forEach((m, i) => {
      if (m.data.slice(0, 7) !== mes) campos[`marcas.${i}`] = `Use um dia de ${mesPorExtenso(mes)}.`;
    });
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    if (!(await lotadosNoMes(dep.banco, unidadeId, mes, id)).length) return c.json({ erro: `Este militar não está lotado na seção em ${mesPorExtenso(mes)}.` }, 409);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => lancar(tx, id, mes, corpo.dados.marcas, c.get('usuarioId')));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await voluntariadoDoMes(dep.banco, unidadeId, mes));
  });

  return r;
}
