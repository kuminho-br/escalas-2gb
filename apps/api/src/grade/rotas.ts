// Rotas da Grade geral: o mês de todo o efetivo da seção.
import { Data, Id, Mes } from 'contratos';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import { exigirLeituraDaEscala } from '../visao/leitura.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { montarPainelDoDia } from './dia.ts';
import { montarGradeDoMes } from './grade.ts';

export function rotasGrade(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/unidades/:u/grade/*', exigirSessao(dep.banco, dep.auth));

  r.get('/unidades/:u/grade/:mes', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirLeituraDaEscala(c, u);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    return c.json(await montarGradeDoMes(dep.banco, u, mes));
  });

  /** O dia de um militar na grade: serviços, choques e onde ele pode entrar ("Adicionar serviço neste dia"). */
  r.get('/unidades/:u/grade/:mes/militares/:militarId/dias/:data', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirLeituraDaEscala(c, u);
    if (negado) return negado;
    const mes = c.req.param('mes');
    const data = c.req.param('data');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    if (!Data.safeParse(data).success) return c.json({ erro: 'Data inválida: use o formato aaaa-mm-dd.' }, 400);
    if (data.slice(0, 7) !== mes) return c.json({ erro: 'A data precisa ser do mês da grade.' }, 400);
    const militarId = c.req.param('militarId');
    const painel = Id.safeParse(militarId).success ? await montarPainelDoDia(dep.banco, u, militarId, data) : null;
    if (!painel) return c.json({ erro: 'Militar não encontrado nesta seção.' }, 404);
    return c.json(painel);
  });

  return r;
}
