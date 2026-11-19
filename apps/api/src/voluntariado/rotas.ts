// Voluntariado lançado à mão: ler a lista do mês e as marcações de um militar (a gravação vem na tarefa seguinte).
import { Mes } from 'contratos';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { voluntariadoDoMes, voluntariadoDoMilitar } from './leitura.ts';

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

  return r;
}
