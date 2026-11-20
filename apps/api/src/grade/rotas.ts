// Rotas da Grade geral: o mês de todo o efetivo da seção.
import { Mes } from 'contratos';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { montarGradeDoMes } from './grade.ts';

export function rotasGrade(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/unidades/:u/grade/*', exigirSessao(dep.banco, dep.auth));

  r.get('/unidades/:u/grade/:mes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    return c.json(await montarGradeDoMes(dep.banco, u, mes));
  });

  return r;
}
