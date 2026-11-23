// Voluntariado lançado à mão: ler a lista do mês e as marcações de um militar, e lançar o mês de um militar.
import { LancamentoDeVoluntariado, Mes, mesPorExtenso } from 'contratos';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import { exigirLeituraDaEscala } from '../visao/leitura.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { lancar } from './lancamento.ts';
import { lotadosNoMes, unidadeDoMilitarNoMes, voluntariadoDoMes, voluntariadoDoMilitar } from './leitura.ts';

const MES_INVALIDO = 'Mês inválido: use o formato aaaa-mm.';

export function rotasVoluntariado(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/voluntariado/*', '/militares/:id/voluntariado/*']) r.use(caminho, sessao);

  r.get('/unidades/:u/voluntariado/:mes', async (c) => {
    const negado = await exigirLeituraDaEscala(c, c.req.param('u'));
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    return c.json(await voluntariadoDoMes(dep.banco, c.req.param('u'), mes));
  });

  r.get('/militares/:id/voluntariado/:mes', async (c) => {
    const id = c.req.param('id');
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const unidadeId = await unidadeDoMilitarNoMes(dep.banco, id, mes);
    if (!unidadeId) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const negado = await exigirLeituraDaEscala(c, unidadeId);
    if (negado) return negado;
    return c.json(await voluntariadoDoMilitar(dep.banco, unidadeId, id, mes));
  });

  /** Lança o mês inteiro do militar (substitui o que havia) e devolve a lista do mês para a tela passar ao próximo. */
  r.put('/militares/:id/voluntariado/:mes', async (c) => {
    const id = c.req.param('id');
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const unidadeId = await unidadeDoMilitarNoMes(dep.banco, id, mes);
    if (!unidadeId) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, LancamentoDeVoluntariado);
    if (!corpo.ok) return corpo.resposta;
    const campos: Record<string, string> = {};
    corpo.dados.faixas.forEach((f, i) => {
      if (f.data.slice(0, 7) !== mes) campos[`faixas.${i}`] = `Use um dia de ${mesPorExtenso(mes)}.`;
    });
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    if (!(await lotadosNoMes(dep.banco, unidadeId, mes, id)).length) return c.json({ erro: `Este militar não está lotado na seção em ${mesPorExtenso(mes)}.` }, 409);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => lancar(tx, id, mes, corpo.dados.faixas, c.get('usuarioId')));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await voluntariadoDoMes(dep.banco, unidadeId, mes));
  });

  return r;
}
