// Escala do mês: leitura (aqui) e, nas tarefas seguintes, candidatos, escalar e remover.
import { Mes } from 'contratos';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { montarEscalaDoMes } from './leitura.ts';

export function rotasEscalaDoMes(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/escalas/:id/mes/*', exigirSessao(dep.banco, dep.auth));

  r.get('/escalas/:id/mes/:mes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    return c.json(await montarEscalaDoMes(dep.banco, id, mes));
  });

  return r;
}
