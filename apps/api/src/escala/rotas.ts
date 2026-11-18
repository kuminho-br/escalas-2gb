// Escala do mês: leitura (aqui) e, nas tarefas seguintes, candidatos, escalar e remover.
import { Data, Hora, Id, Mes } from 'contratos';
import { z } from 'zod';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { avaliarCandidatos } from './elegibilidade.ts';
import { montarEscalaDoMes } from './leitura.ts';

const ConsultaDeCandidatos = z.object({ data: Data, inicio: Hora, fim: Hora, guarnicaoId: Id.optional(), funcaoId: Id.optional() });

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

  /** Quem pode ocupar a vaga (dia, faixa, guarnição e função) e quantos ficaram de fora e por quê. */
  r.get('/escalas/:id/mes/:mes/candidatos', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const q = ConsultaDeCandidatos.safeParse(c.req.query());
    if (!q.success) {
      const campos: Record<string, string> = {};
      for (const p of q.error.issues) campos[p.path.join('.')] ??= p.message;
      return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    }
    const { data, inicio, fim, guarnicaoId, funcaoId } = q.data;
    if (data.slice(0, 7) !== mes) return c.json({ erro: 'A data precisa ser do mês da escala.', campos: { data: 'Use um dia de ' + mes + '.' } }, 400);
    const existe = (
      await dep.banco.query(
        `select 1 from escala_servico es join turno t on t.servico_id = es.servico_id
          where es.escala_id = $1 and t.inicio = $2::time and t.fim = $3::time limit 1`,
        [id, inicio, fim],
      )
    ).rows.length;
    if (!existe) return c.json({ erro: 'Esta faixa não existe nesta escala.' }, 400);
    return c.json(await avaliarCandidatos(dep.banco, { escalaId: id, data, inicio, fim, guarnicaoId: guarnicaoId ?? null, funcaoId: funcaoId ?? null }));
  });

  return r;
}
