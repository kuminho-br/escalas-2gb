// Escala do mês: leitura (aqui) e, nas tarefas seguintes, candidatos, escalar e remover.
import { Data, Hora, Id, Mes, NovaAlocacao, NovaPreEscala, NovoAcumulo, OrdemDeEscalaEntrada, mesPorExtenso } from 'contratos';
import { z } from 'zod';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { mesPassado } from '../cadastros/guarnicoes.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { acumular, desfazerRemocao, escalar, Recusa, remover, tirarAcumulo } from './alocacoes.ts';
import { avaliarCandidatos } from './elegibilidade.ts';
import { montarEscalaDoMes } from './leitura.ts';
import { gravarOrdem, ordemDoMes } from './ordem-do-mes.ts';
import { planejarPreEscala, PreEscalaInvalida } from './pre-escala.ts';

const ConsultaDeCandidatos = z.object({ data: Data, inicio: Hora, fim: Hora, guarnicaoId: Id.optional(), funcaoId: Id.optional() });

export function rotasEscalaDoMes(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/escalas/:id/mes/*', '/escalas/:id/alocacoes', '/alocacoes/*', '/remocoes/*', '/acumulos/*', '/escalas/:id/ordem/*']) r.use(caminho, sessao);

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

  /** A prévia da pré-escala do Pronto: o que a gravação criaria, o que ficaria de fora e a equipe do dia 1 (a escolhida em `?equipe=` ou a detectada). */
  r.get('/escalas/:id/mes/:mes/pre-escala', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const equipe = c.req.query('equipe');
    if (equipe !== undefined && !Id.safeParse(equipe).success) return c.json({ erro: 'Equipe inválida.', campos: { equipe: 'Equipe inválida.' } }, 400);
    try {
      return c.json((await planejarPreEscala(dep.banco, id, mes, equipe ?? null)).previa);
    } catch (e) {
      if (e instanceof PreEscalaInvalida) return c.json({ erro: e.message, campos: { equipe: e.message } }, 400);
      throw e;
    }
  });

  /**
   * Grava a pré-escala do Pronto. Calcula de novo dentro da transação, com trava por escala e mês (a escala pode ter mudado desde a
   * prévia e dois cliques ao mesmo tempo não duplicam): só entra o que ainda cabe, e quem já estava escalado não é mexido.
   */
  r.post('/escalas/:id/mes/:mes/pre-escala', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const corpo = await lerCorpo(c, NovaPreEscala);
    if (!corpo.ok) return corpo.resposta;
    try {
      const gravadas = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`pre-escala|${id}|${mes}`]);
        const { novas, conflito } = await planejarPreEscala(tx, id, mes, corpo.dados.equipeDia1Id);
        if (conflito) throw new Recusa(conflito);
        if (!novas.length) return 0;
        const { rows } = await tx.query<{ id: string }>(
          `insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, guarnicao_id, funcao_id, origem)
           select x.m, $1, x.s, x.t, x.d, x.g, x.f, 'pre_escala'
             from unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::date[], $6::uuid[], $7::uuid[]) as x(m, s, t, d, g, f)
           on conflict do nothing returning id`,
          [id, novas.map((n) => n.militarId), novas.map((n) => n.servicoId), novas.map((n) => n.turnoId), novas.map((n) => n.data), novas.map((n) => n.guarnicaoId), novas.map((n) => n.funcaoId)],
        );
        return rows.length;
      });
      return c.json({ escala: await montarEscalaDoMes(dep.banco, id, mes), gravadas }, 201);
    } catch (e) {
      if (e instanceof PreEscalaInvalida) return c.json({ erro: e.message, campos: { equipeDia1Id: e.message } }, 400);
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
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

  /** Escalar um militar numa vaga; devolve a escala do mês para a tela trocar o que tem. */
  r.post('/escalas/:id/alocacoes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaAlocacao);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    if (Boolean(d.guarnicaoId) !== Boolean(d.funcaoId)) {
      const campo = d.guarnicaoId ? 'funcaoId' : 'guarnicaoId';
      const texto = d.guarnicaoId ? 'Escolha a função da guarnição.' : 'Escolha a guarnição da função.';
      return c.json({ erro: texto, campos: { [campo]: texto } }, 400);
    }
    try {
      const mes = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => escalar(tx, id, d));
      return c.json(await montarEscalaDoMes(dep.banco, id, mes), 201);
    } catch (e) {
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
  });

  /** Remover tira o militar e guarda a remoção na mesma transação. */
  r.delete('/alocacoes/:id', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'alocacao', id);
    if (!unidadeId) return c.json({ erro: 'Alocação não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => remover(tx, id, c.get('usuarioId')));
    return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes));
  });

  r.delete('/remocoes/:id', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'remocao', id);
    if (!unidadeId) return c.json({ erro: 'Remoção não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => desfazerRemocao(tx, id));
    return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes));
  });

  /** O militar de uma alocação acumula mais uma vaga da mesma faixa; devolve a escala do mês. */
  r.post('/alocacoes/:id/acumulos', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'alocacao', id);
    if (!unidadeId) return c.json({ erro: 'Alocação não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoAcumulo);
    if (!corpo.ok) return corpo.resposta;
    try {
      const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => acumular(tx, id, corpo.dados));
      return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes), 201);
    } catch (e) {
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
  });

  /** Tira só a vaga acumulada (o militar continua na vaga original; não há remoção). */
  r.delete('/acumulos/:id', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'acumulo', id);
    if (!unidadeId) return c.json({ erro: 'Acúmulo não encontrado.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => tirarAcumulo(tx, id));
    return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes));
  });

  /** A ordem de escala em vigor no mês, com as vagas da escala e a vez de cada uma. */
  r.get('/escalas/:id/ordem/:mes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    return c.json(await ordemDoMes(dep.banco, id, mes));
  });

  /** Grava a ordem a partir do mês (substitui a do mesmo mês); a vez de cada vaga é a posição na lista. */
  r.put('/escalas/:id/ordem/:mes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const corpo = await lerCorpo(c, OrdemDeEscalaEntrada);
    if (!corpo.ok) return corpo.resposta;
    const passado = mesPassado(c, mes);
    if (passado) return passado;
    const existentes = new Set((await ordemDoMes(dep.banco, id, mes)).vagas.map((v) => `${v.guarnicaoId}|${v.funcaoId}|${v.vaga}`));
    const campos: Record<string, string> = {};
    corpo.dados.itens.forEach((it, i) => {
      if (!existentes.has(`${it.guarnicaoId}|${it.funcaoId}|${it.vaga}`)) campos[`itens.${i}`] = `Esta vaga não existe nesta escala em ${mesPorExtenso(mes)}.`;
    });
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => gravarOrdem(tx, id, mes, corpo.dados.itens));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await ordemDoMes(dep.banco, id, mes));
  });

  return r;
}
