// Escala do mês: leitura (aqui) e, nas tarefas seguintes, candidatos, escalar e remover.
import { DesfazerResolucao, Data, Hora, Id, Justificativa, Mes, NovaAlocacao, NovaPreEscala, NovoAcumulo, OrdemDeEscalacaoEntrada, Troca, mesPorExtenso } from 'contratos';
import { z } from 'zod';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import { exigirLeituraDaEscala } from '../visao/leitura.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { mesPassado } from '../cadastros/guarnicoes.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { acumular, desfazerRemocao, desfazerResolucao, devolverRemocao, escalar, escalarResolvendo, NAO_DA_PARA_DESFAZER, Proibida, Recusa, remover, tirarAcumulo, voltarAoTurno } from './alocacoes.ts';
import { avaliarCandidatos } from './elegibilidade.ts';
import { montarEscalaDoMes } from './leitura.ts';
import { comPassado, justificativaDoCorpo, respostaDoPassado, semOsQueJaComecaram, tocadoDaAlocacao, tocadoDaRemocao, tocadoDoAcumulo, type Tocado } from './passado.ts';
import { mudarPrevia } from './previa.ts';
import { gravarOrdem, ordemDoMes } from './ordem-do-mes.ts';
import { planejarPreEscala, PreEscalaInvalida } from './pre-escala.ts';
import { NaoEncontrada, opcoesDeTroca, trocar } from './trocar.ts';

const MSG_RODADA = 'Esta escala é uma rodada de cotas: os lançamentos dela são feitos em Oficiais.';
const ConsultaDeCandidatos = z.object({ data: Data, inicio: Hora, fim: Hora, guarnicaoId: Id.optional(), funcaoId: Id.optional() });

export function rotasEscalaDoMes(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/escalas/:id/mes/*', '/escalas/:id/alocacoes', '/alocacoes/*', '/remocoes/*', '/resolucoes/*', '/acumulos/*', '/escalas/:id/ordem/*']) r.use(caminho, sessao);

  r.get('/escalas/:id/mes/:mes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirLeituraDaEscala(c, unidadeId);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    return c.json(await montarEscalaDoMes(dep.banco, id, mes, c.get('usuarioId')));
  });

  /** Lança (POST) ou recolhe (DELETE) a prévia da escala no mês: lançada, a corporação lê a escala. Repetir não é erro. */
  for (const metodo of ['post', 'delete'] as const) {
    r[metodo]('/escalas/:id/mes/:mes/previa', async (c) => {
      const id = c.req.param('id');
      const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
      if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
      const negado = await exigirPapel(c, unidadeId, CADASTRO);
      if (negado) return negado;
      const mes = c.req.param('mes');
      if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
      try {
        await comUsuario(dep.banco, c.get('usuarioId'), (tx) => mudarPrevia(tx, id, mes, metodo === 'post', c.get('usuarioId')));
      } catch (e) {
        return respostaDoErroDoBanco(c, e);
      }
      return c.json(await montarEscalaDoMes(dep.banco, id, mes, c.get('usuarioId')));
    });
  }

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
    // a escala de rodada de cotas (a dos oficiais) não tem pré-escala: ela é montada em Oficiais
    const jeito = (await dep.banco.query<{ distribuicao: string }>('select distribuicao from escala where id = $1', [id])).rows[0]!.distribuicao;
    if (jeito !== 'pre_escala') return c.json({ erro: 'Esta escala é uma rodada de cotas: ela é montada em Oficiais, e não tem pré-escala.' }, 409);
    try {
      const gravadas = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('select pg_advisory_xact_lock(hashtext($1))', [`pre-escala|${id}|${mes}`]);
        const planejada = await planejarPreEscala(tx, id, mes, corpo.dados.equipeDia1Id);
        if (planejada.conflito) throw new Recusa(planejada.conflito);
        // com a prévia lançada, o que já começou não é preenchido (e não deixa registro)
        const novas = await semOsQueJaComecaram(tx, id, mes, planejada.novas);
        if (!novas.length) return 0;
        const { rows } = await tx.query<{ id: string }>(
          `insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, guarnicao_id, funcao_id, origem)
           select x.m, x.e, x.s, x.t, x.d, x.g, x.f, 'pre_escala'
             from unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::date[], $5::uuid[], $6::uuid[], $7::uuid[]) as x(m, s, t, d, g, f, e)
           on conflict do nothing returning id`,
          // o expediente do Adm (6.40) não tem escala: `escalaId` nulo
          [novas.map((n) => n.militarId), novas.map((n) => n.servicoId), novas.map((n) => n.turnoId), novas.map((n) => n.data), novas.map((n) => n.guarnicaoId), novas.map((n) => n.funcaoId), novas.map((n) => (n.escalaId === null ? null : id))],
        );
        return rows.length;
      });
      return c.json({ escala: await montarEscalaDoMes(dep.banco, id, mes, c.get('usuarioId')), gravadas }, 201);
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
    return c.json(await avaliarCandidatos(dep.banco, { escalaId: id, data, inicio, fim, guarnicaoId: guarnicaoId ?? null, funcaoId: funcaoId ?? null }, { usuarioId: c.get('usuarioId'), hoje: hojeRecife() }));
  });

  /** A escala de rodada de cotas (a dos oficiais) só se lança em Oficiais: a pré-escala, o escalar, o remover e o trocar das praças não mexem nela. */
  const daRodada = async (escalaId: string) => (await dep.banco.query('select 1 from escala where id = $1 and distribuicao <> $2', [escalaId, 'pre_escala'])).rows.length > 0;
  const daRodadaDaAlocacao = async (alocacaoId: string) =>
    (await dep.banco.query('select 1 from alocacao a join escala e on e.id = a.escala_id where a.id = $1 and e.distribuicao <> $2', [alocacaoId, 'pre_escala'])).rows.length > 0;

  /** Escalar um militar numa vaga; devolve a escala do mês para a tela trocar o que tem. */
  r.post('/escalas/:id/alocacoes', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'escala', id);
    if (!unidadeId) return c.json({ erro: 'Escala não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    if (await daRodada(id)) return c.json({ erro: MSG_RODADA }, 409);
    const corpo = await lerCorpo(c, NovaAlocacao);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    if (Boolean(d.guarnicaoId) !== Boolean(d.funcaoId)) {
      const campo = d.guarnicaoId ? 'funcaoId' : 'guarnicaoId';
      const texto = d.guarnicaoId ? 'Escolha a função da guarnição.' : 'Escolha a guarnição da função.';
      return c.json({ erro: texto, campos: { [campo]: texto } }, 400);
    }
    try {
      const { resolverChoque, justificativa, ...vaga } = d;
      // os turnos que a mudança toca: o da vaga e, se tira o militar de outro serviço, o de lá
      const tocar = async (tx: Consulta): Promise<Tocado[]> => [{ escalaId: id, data: vaga.data, turnoId: vaga.turnoId }, ...(resolverChoque && 'alocacaoId' in resolverChoque ? await tocadoDaAlocacao(tx, resolverChoque.alocacaoId) : [])];
      if (resolverChoque) {
        // tirar de lá e escalar aqui (6.38): as duas coisas na mesma transação; uma recusa desfaz as duas
        const feito = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), tocar, justificativa, () => escalarResolvendo(tx, id, vaga, resolverChoque, c.get('usuarioId'), hojeRecife())));
        return c.json({ ...(await montarEscalaDoMes(dep.banco, id, feito.mes, c.get('usuarioId'))), desfazer: feito.desfazer }, 201);
      }
      const mes = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), tocar, justificativa, () => escalar(tx, id, vaga)));
      return c.json(await montarEscalaDoMes(dep.banco, id, mes, c.get('usuarioId')), 201);
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      if (e instanceof Proibida) return c.json({ erro: e.message }, 403);
      return respostaDoErroDoBanco(c, e);
    }
  });

  /** "Desfazer" o movimento do turno para a vaga (6.40): a alocação volta ao turno sem guarnição; 409 se a escala mudou desde então. */
  r.post('/alocacoes/:id/voltar-ao-turno', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'alocacao', id);
    // a que já não existe tem a mesma frase de quando a escala mudou
    if (!unidadeId) return c.json({ erro: NAO_DA_PARA_DESFAZER }, 409);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, z.object({ guarnicaoId: Id, funcaoId: Id, justificativa: Justificativa }));
    if (!corpo.ok) return corpo.resposta;
    try {
      const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), (t) => tocadoDaAlocacao(t, id), corpo.dados.justificativa, () => voltarAoTurno(tx, id, corpo.dados)));
      return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes, c.get('usuarioId')));
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
  });

  /** "Desfazer" a resolução do choque: tira o serviço novo e devolve o de lá; 409 se a escala mudou desde então. */
  r.post('/resolucoes/desfazer', async (c) => {
    const corpo = await lerCorpo(c, DesfazerResolucao);
    if (!corpo.ok) return corpo.resposta;
    const unidadeId = await unidadeDoRegistro(dep.banco, 'alocacao', corpo.dados.alocacaoId);
    // a alocação que já não existe: a mesma frase de quando a escala mudou (ninguém precisa saber se foi apagada ou nunca existiu)
    if (!unidadeId) return c.json({ erro: NAO_DA_PARA_DESFAZER }, 409);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    try {
      const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), async (t) => [...(await tocadoDaAlocacao(t, corpo.dados.alocacaoId)), ...(corpo.dados.remocaoId ? await tocadoDaRemocao(t, corpo.dados.remocaoId) : [])], corpo.dados.justificativa, () => desfazerResolucao(tx, corpo.dados)));
      return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes, c.get('usuarioId')));
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
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
    if (await daRodadaDaAlocacao(id)) return c.json({ erro: MSG_RODADA }, 409);
    const justificativa = await justificativaDoCorpo(c);
    try {
      const { escalaId, mes, remocaoId } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), (t) => tocadoDaAlocacao(t, id), justificativa, () => remover(tx, id, c.get('usuarioId'))));
      // a escala do mês e o id da remoção: o aviso da tela usa o id para o "Desfazer"
      // o expediente lançado pela pré-escala não é de nenhuma escala (6.40): só o id da remoção
      if (escalaId === null) return c.json({ escalaId: null, remocaoId });
      return c.json({ ...(await montarEscalaDoMes(dep.banco, escalaId, mes, c.get('usuarioId'))), remocaoId });
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      throw e;
    }
  });

  /** "Desfazer" a remoção: devolve o militar à mesma vaga e tira a marca de removido; 409 se a escala mudou desde então. */
  r.post('/remocoes/:id/desfazer', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'remocao', id);
    if (!unidadeId) return c.json({ erro: 'Remoção não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const justificativa = await justificativaDoCorpo(c);
    try {
      const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), (t) => tocadoDaRemocao(t, id), justificativa, () => devolverRemocao(tx, id)));
      if (escalaId === null) return c.json({ escalaId: null });
      return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes, c.get('usuarioId')));
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.delete('/remocoes/:id', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'remocao', id);
    if (!unidadeId) return c.json({ erro: 'Remoção não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const justificativa = await justificativaDoCorpo(c);
    try {
      const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), (t) => tocadoDaRemocao(t, id), justificativa, () => desfazerRemocao(tx, id)));
      if (escalaId === null) return c.json({ escalaId: null });
      return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes, c.get('usuarioId')));
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      throw e;
    }
  });

  /** Quem pode ocupar a vaga de uma alocação (livres) e quem já está escalado no mesmo dia (para trocar de lugar). */
  r.get('/alocacoes/:id/trocas', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'alocacao', id);
    if (!unidadeId) return c.json({ erro: 'Alocação não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const opcoes = await opcoesDeTroca(dep.banco, id);
    if (!opcoes) return c.json({ erro: 'Alocação não encontrada.' }, 404);
    return c.json(opcoes);
  });

  /** Troca a alocação: por um militar livre ou de lugar com quem já está escalado (entre dois ordinários, é uma permuta). */
  r.post('/alocacoes/:id/trocar', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'alocacao', id);
    if (!unidadeId) return c.json({ erro: 'Alocação não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    if (await daRodadaDaAlocacao(id)) return c.json({ erro: MSG_RODADA }, 409);
    const corpo = await lerCorpo(c, Troca);
    if (!corpo.ok) return corpo.resposta;
    try {
      const troca = corpo.dados;
      // a troca toca a alocação, e o turno escolhido (o militar livre entra nele) ou a alocação com quem ela troca de lugar
      const tocar = async (t: Consulta): Promise<Tocado[]> => {
        const a = await tocadoDaAlocacao(t, id);
        if ('comAlocacaoId' in troca) return [...a, ...(await tocadoDaAlocacao(t, troca.comAlocacaoId))];
        return [...a, ...a.map((x) => ({ ...x, turnoId: troca.turnoId }))];
      };
      const escalas = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), tocar, troca.justificativa, () => trocar(tx, id, troca, c.get('usuarioId'))));
      return c.json({ escalas });
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      if (e instanceof NaoEncontrada) return c.json({ erro: 'Alocação não encontrada.' }, 404);
      if (e instanceof Recusa) return c.json({ erro: e.message }, 409);
      return respostaDoErroDoBanco(c, e);
    }
  });

  /** O militar de uma alocação acumula mais uma vaga da mesma faixa; devolve a escala do mês. */
  r.post('/alocacoes/:id/acumulos', async (c) => {
    const id = c.req.param('id');
    const unidadeId = await unidadeDoRegistro(dep.banco, 'alocacao', id);
    if (!unidadeId) return c.json({ erro: 'Alocação não encontrada.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    if (await daRodadaDaAlocacao(id)) return c.json({ erro: MSG_RODADA }, 409);
    const corpo = await lerCorpo(c, NovoAcumulo);
    if (!corpo.ok) return corpo.resposta;
    try {
      const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), (t) => tocadoDaAlocacao(t, id), corpo.dados.justificativa, () => acumular(tx, id, corpo.dados)));
      return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes, c.get('usuarioId')), 201);
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
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
    const justificativa = await justificativaDoCorpo(c);
    try {
      const { escalaId, mes } = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => comPassado(tx, c.get('usuarioId'), (t) => tocadoDoAcumulo(t, id), justificativa, () => tirarAcumulo(tx, id)));
      return c.json(await montarEscalaDoMes(dep.banco, escalaId, mes, c.get('usuarioId')));
    } catch (e) {
      const p = respostaDoPassado(c, e);
      if (p) return p;
      throw e;
    }
  });

  /** A ordem de escalação em vigor no mês, com as vagas da escala e a vez de cada uma. */
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
    const corpo = await lerCorpo(c, OrdemDeEscalacaoEntrada);
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
