// Militares: identificação, lotação com histórico (transferências), CNH e afastamentos.
import {
  EdicaoAfastamento,
  EdicaoMilitar,
  MENSAGEM_CNH_SEM_MOTORISTA,
  MENSAGEM_FIM_ANTES_DO_INICIO,
  Mes,
  mesParaData,
  mesPorExtenso,
  NovaLotacao,
  NovoAfastamento,
  NovoMilitar,
  type Equipe,
  type FichaMilitar,
  type LinhaMilitar,
  type Posto,
} from 'contratos';
import { cnhHabilitadas, diasDoMes } from 'dominio';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirAlgumPapel, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { categoriaMaisAlta, pendenciasDoMilitar, repetidasPorAntiguidade, situacaoNoMes } from './militares-regras.ts';

type Ctx = Context<AmbienteApi>;
const MSG_MATRICULA = { '23505': 'Já existe um militar com essa matrícula.', '23503': 'Posto, unidade ou equipe não encontrado.' };

const limitesDoMes = (mes: string) => {
  const d = diasDoMes(mes);
  return { primeiro: d[0]!, ultimo: d[d.length - 1]! };
};

type LinhaBanco = {
  id: string;
  matricula: string;
  posto: string;
  posto_grad_id: string;
  nome_guerra: string;
  antiguidade: number | null;
  motorista: boolean;
  cnh: string[];
  voluntario_jes: boolean;
  ativo: boolean;
  equipe: string | null;
  jornada: 'pronto' | 'adm' | null;
};

async function afastamentosNoMes(c: Consulta, ids: string[], mes: string) {
  const { primeiro, ultimo } = limitesDoMes(mes);
  const { rows } = await c.query<{ militar_id: string; tipo: string; inicio: string; fim: string }>(
    `select a.militar_id, t.nome as tipo, to_char(a.inicio, 'YYYY-MM-DD') as inicio, to_char(a.fim, 'YYYY-MM-DD') as fim
       from afastamento a join tipo_afastamento t on t.id = a.tipo_afastamento_id
      where a.militar_id = any($1) and a.inicio <= $3 and a.fim >= $2`,
    [ids, primeiro, ultimo],
  );
  return rows;
}

function linhaDe(m: LinhaBanco, afast: { tipo: string; inicio: string; fim: string }[], mes: string, repetidaCom: string[] = []): LinhaMilitar {
  return {
    id: m.id,
    matricula: m.matricula,
    posto: m.posto,
    nomeGuerra: m.nome_guerra,
    equipe: m.equipe,
    jornada: m.jornada,
    motorista: m.motorista ? categoriaMaisAlta(m.cnh) : null,
    voluntarioJes: m.voluntario_jes,
    ativo: m.ativo,
    situacao: situacaoNoMes(afast, mes),
    pendencias: pendenciasDoMilitar({ motorista: m.motorista, cnh: m.cnh, jornada: m.jornada, equipe: m.equipe, antiguidade: m.antiguidade, repetidaCom }),
  };
}

const SELECT_MILITAR = `
  select m.id, m.matricula, p.sigla as posto, m.posto_grad_id, m.nome_guerra, m.antiguidade, m.motorista, m.cnh,
         m.voluntario_jes, m.ativo, e.nome as equipe, l.jornada`;

/** Ficha completa; a lotação "atual" é a que cobre o mês. null se o militar não existe. */
async function carregarFicha(c: Consulta, id: string, mes: string): Promise<FichaMilitar | null> {
  const { primeiro, ultimo } = limitesDoMes(mes);
  const { rows } = await c.query<LinhaBanco>(
    `${SELECT_MILITAR}
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join rastreio l on l.militar_id = m.id and l.desde <= $3 and (l.ate is null or l.ate >= $2)
       left join equipe e on e.id = l.equipe_id
      where m.id = $1`,
    [id, primeiro, ultimo],
  );
  const m = rows[0];
  if (!m) return null;
  const lotacoes = await c.query<{ id: string; sigla: string; equipe: string | null; jornada: 'pronto' | 'adm'; desde: string; ate: string | null }>(
    `select l.id, un.sigla, e.nome as equipe, l.jornada, to_char(l.desde, 'YYYY-MM-DD') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate
       from rastreio l join unidade un on un.id = l.unidade_id left join equipe e on e.id = l.equipe_id
      where l.militar_id = $1 order by l.desde desc`,
    [id],
  );
  const afastamentos = await c.query<{ id: string; tipo: string; tipo_afastamento_id: string; inicio: string; fim: string }>(
    `select a.id, t.nome as tipo, a.tipo_afastamento_id, to_char(a.inicio, 'YYYY-MM-DD') as inicio, to_char(a.fim, 'YYYY-MM-DD') as fim
       from afastamento a join tipo_afastamento t on t.id = a.tipo_afastamento_id
      where a.militar_id = $1 order by a.inicio`,
    [id],
  );
  const cnh = m.motorista ? [...m.cnh].sort() : [];
  // compara com os ativos lotados, no mês, na mesma unidade; sem lotação ou inativo, não compara
  const colegas = await c.query<{ id: string; nome_guerra: string; antiguidade: number | null }>(
    `select m2.id, m2.nome_guerra, m2.antiguidade
       from rastreio l0
       join rastreio l2 on l2.unidade_id = l0.unidade_id and l2.desde <= $3 and (l2.ate is null or l2.ate >= $2)
       join militar m2 on m2.id = l2.militar_id and m2.ativo
      where l0.militar_id = $1 and l0.desde <= $3 and (l0.ate is null or l0.ate >= $2)
      order by m2.nome_guerra`,
    [id, primeiro, ultimo],
  );
  const repetidaCom = repetidasPorAntiguidade(colegas.rows.map((x) => ({ id: x.id, nomeGuerra: x.nome_guerra, antiguidade: x.antiguidade }))).get(id) ?? [];
  return {
    ...linhaDe(m, afastamentos.rows, mes, repetidaCom),
    antiguidadeRepetidaCom: repetidaCom,
    postoGradId: m.posto_grad_id,
    antiguidade: m.antiguidade,
    noQuadroDeMotoristas: m.motorista,
    cnh,
    cnhPorHierarquia: cnhHabilitadas(cnh).filter((x) => !cnh.includes(x)),
    lotacoes: lotacoes.rows.map((l) => ({ id: l.id, unidadeSigla: l.sigla, equipe: l.equipe, jornada: l.jornada, desde: l.desde, ate: l.ate })),
    afastamentos: afastamentos.rows.map((a) => ({ id: a.id, tipo: a.tipo, tipoAfastamentoId: a.tipo_afastamento_id, inicio: a.inicio, fim: a.fim })),
  };
}

/**
 * Confere o papel numa unidade do militar: as das lotações deste mês em diante (uma transferência
 * marcada para o mês que vem não tira o acesso de quem cuida dele agora). Sem nenhuma, vale a
 * lotação mais recente. 404 se o registro não existe.
 */
async function exigirPapelNoRegistro(c: Ctx, tabela: 'militar' | 'afastamento', id: string): Promise<Response | null> {
  const banco = c.get('banco');
  const naoAchou = () => c.json({ erro: tabela === 'militar' ? 'Militar não encontrado.' : 'Afastamento não encontrado.' }, 404);
  if (!(await unidadeDoRegistro(banco, tabela, id))) return naoAchou();
  const militarId = tabela === 'militar' ? id : (await banco.query<{ militar_id: string }>('select militar_id from afastamento where id = $1', [id])).rows[0]!.militar_id;
  const inicioDoMes = `${hojeRecife().slice(0, 7)}-01`;
  const { rows } = await banco.query<{ unidade_id: string }>(
    'select distinct unidade_id from rastreio where militar_id = $1 and (ate is null or ate >= $2)',
    [militarId, inicioDoMes],
  );
  const unidades = rows.length ? rows.map((r) => r.unidade_id) : [(await unidadeDoRegistro(banco, 'militar', militarId))!];
  let negado: Response | null = null;
  for (const u of unidades) {
    negado = await exigirPapel(c, u, CADASTRO);
    if (!negado) return null;
  }
  return negado;
}

/** Tipo de afastamento existente e ativo; senão, a resposta 400. */
async function conferirTipo(c: Ctx, tipoId: string): Promise<Response | null> {
  const t = (await c.get('banco').query<{ ativo: boolean }>('select ativo from tipo_afastamento where id = $1', [tipoId])).rows[0];
  if (!t) return c.json({ erro: 'Escolha um tipo de afastamento.', campos: { tipoAfastamentoId: 'Escolha um tipo de afastamento.' } }, 400);
  if (!t.ativo) return c.json({ erro: 'Este tipo de afastamento está desativado.', campos: { tipoAfastamentoId: 'Este tipo de afastamento está desativado.' } }, 400);
  return null;
}

const mesDaConsulta = (c: Ctx) => c.req.query('mes') ?? hojeRecife().slice(0, 7);

export function rotasMilitares(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/postos', '/unidades/:u/equipes', '/unidades/:u/militares', '/militares/*', '/afastamentos/*']) r.use(caminho, sessao);

  r.get('/postos', async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const { rows } = await dep.banco.query<Posto>('select id, sigla, nome, ordem from posto_grad order by ordem');
    return c.json(rows);
  });

  r.get('/unidades/:u/equipes', async (c) => {
    const negado = await exigirPapel(c, c.req.param('u'), CADASTRO);
    if (negado) return negado;
    const { rows } = await dep.banco.query<Equipe>(
      'select id, nome, ordem_ciclo as "ordemCiclo" from equipe where unidade_id = $1 order by ordem_ciclo',
      [c.req.param('u')],
    );
    return c.json(rows);
  });

  r.get('/unidades/:u/militares', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const mes = mesDaConsulta(c);
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const { primeiro, ultimo } = limitesDoMes(mes);
    const { rows } = await dep.banco.query<LinhaBanco>(
      `${SELECT_MILITAR}
         from rastreio l
         join unidade un on un.id = l.unidade_id
         join unidade alvo on alvo.id = $1
         join militar m on m.id = l.militar_id
         join posto_grad p on p.id = m.posto_grad_id
         left join equipe e on e.id = l.equipe_id
        where alvo.caminho @> un.caminho and l.desde <= $3 and (l.ate is null or l.ate >= $2)
        order by p.ordem desc, m.antiguidade asc nulls last, m.nome_guerra`,
      [u, primeiro, ultimo],
    );
    const afast = await afastamentosNoMes(dep.banco, rows.map((m) => m.id), mes);
    const repetidas = repetidasPorAntiguidade(rows.filter((m) => m.ativo).map((m) => ({ id: m.id, nomeGuerra: m.nome_guerra, antiguidade: m.antiguidade })));
    return c.json(rows.map((m) => linhaDe(m, afast.filter((a) => a.militar_id === m.id), mes, repetidas.get(m.id))));
  });

  r.post('/unidades/:u/militares', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoMilitar);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    try {
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            `insert into militar (matricula, posto_grad_id, nome_guerra, antiguidade, motorista, cnh, voluntario_jes)
             values ($1, $2, $3, $4, $5, $6, $7) returning id`,
            [d.matricula, d.postoGradId, d.nomeGuerra, d.antiguidade, d.motorista, d.cnh, d.voluntarioJes],
          )
        ).rows[0]!.id;
        await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde) values ($1, $2, $3, $4, $5)', [
          id, u, d.lotacao.equipeId, d.lotacao.jornada, mesParaData(d.lotacao.desde),
        ]);
        return carregarFicha(tx, id, d.lotacao.desde);
      });
      return c.json(ficha, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_MATRICULA);
    }
  });

  r.get('/militares/:id', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const mes = mesDaConsulta(c);
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    return c.json(await carregarFicha(dep.banco, id, mes));
  });

  r.patch('/militares/:id', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    // o mês da ficha devolvida vale antes de gravar: mês quebrado não pode deixar a gravação pela metade
    const mes = mesDaConsulta(c);
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const corpo = await lerCorpo(c, EdicaoMilitar);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    try {
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        // o estado atual é lido já dentro da transação, com a linha travada: duas edições ao mesmo tempo, em campos
        // diferentes, não se atropelam (a segunda parte do que a primeira gravou)
        const atual = (await tx.query<Pick<LinhaBanco, 'posto_grad_id' | 'nome_guerra' | 'antiguidade' | 'motorista' | 'cnh' | 'voluntario_jes' | 'ativo'>>(
          'select posto_grad_id, nome_guerra, antiguidade, motorista, cnh, voluntario_jes, ativo from militar where id = $1 for update',
          [id],
        )).rows[0]!;
        const motorista = d.motorista ?? atual.motorista;
        // desmarcar o quadro de motoristas limpa a CNH na mesma gravação
        const cnh = d.motorista === false ? [] : (d.cnh ?? atual.cnh);
        if (!motorista && cnh.length) return null;
        await tx.query(
          `update militar set posto_grad_id = $2, nome_guerra = $3, antiguidade = $4, motorista = $5, cnh = $6, voluntario_jes = $7, ativo = $8
            where id = $1`,
          [
            id,
            d.postoGradId ?? atual.posto_grad_id,
            d.nomeGuerra ?? atual.nome_guerra,
            d.antiguidade === undefined ? atual.antiguidade : d.antiguidade,
            motorista,
            cnh,
            d.voluntarioJes ?? atual.voluntario_jes,
            d.ativo ?? atual.ativo,
          ],
        );
        return carregarFicha(tx, id, mes);
      });
      if (!ficha) return c.json({ erro: MENSAGEM_CNH_SEM_MOTORISTA, campos: { cnh: MENSAGEM_CNH_SEM_MOTORISTA } }, 400);
      return c.json(ficha);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_MATRICULA);
    }
  });

  r.post('/militares/:id/lotacoes', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaLotacao);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    // a unidade de destino também precisa ser de quem registra
    const negadoDestino = await exigirPapel(c, d.unidadeId, CADASTRO);
    if (negadoDestino) return negadoDestino;
    const aberta = (await dep.banco.query<{ id: string; mes: string }>(
      "select id, to_char(desde, 'YYYY-MM') as mes from rastreio where militar_id = $1 and ate is null",
      [id],
    )).rows[0];
    if (aberta && d.desde <= aberta.mes) {
      return c.json({ erro: `A transferência precisa ser depois de ${mesPorExtenso(aberta.mes)}.` }, 409);
    }
    try {
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        if (aberta) await tx.query("update rastreio set ate = $2::date - interval '1 day' where id = $1", [aberta.id, mesParaData(d.desde)]);
        await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde) values ($1, $2, $3, $4, $5)', [
          id, d.unidadeId, d.equipeId, d.jornada, mesParaData(d.desde),
        ]);
        return carregarFicha(tx, id, d.desde);
      });
      return c.json(ficha, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_MATRICULA);
    }
  });

  r.post('/militares/:id/afastamentos', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoAfastamento);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const tipoRuim = await conferirTipo(c, d.tipoAfastamentoId);
    if (tipoRuim) return tipoRuim;
    try {
      const novo = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) =>
        (await tx.query<{ id: string }>(
          'insert into afastamento (militar_id, tipo_afastamento_id, inicio, fim) values ($1, $2, $3, $4) returning id',
          [id, d.tipoAfastamentoId, d.inicio, d.fim],
        )).rows[0]!,
      );
      return c.json(novo, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.patch('/afastamentos/:id', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'afastamento', id);
    if (negado) return negado;
    const corpo = await lerCorpo(c, EdicaoAfastamento);
    if (!corpo.ok) return corpo.resposta;
    const atual = (await dep.banco.query<{ tipo: string; inicio: string; fim: string }>(
      "select tipo_afastamento_id as tipo, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim from afastamento where id = $1",
      [id],
    )).rows[0]!;
    const novo = { tipo: corpo.dados.tipoAfastamentoId ?? atual.tipo, inicio: corpo.dados.inicio ?? atual.inicio, fim: corpo.dados.fim ?? atual.fim };
    if (novo.fim < novo.inicio) return c.json({ erro: MENSAGEM_FIM_ANTES_DO_INICIO, campos: { fim: MENSAGEM_FIM_ANTES_DO_INICIO } }, 400);
    if (corpo.dados.tipoAfastamentoId) {
      const tipoRuim = await conferirTipo(c, novo.tipo);
      if (tipoRuim) return tipoRuim;
    }
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) =>
        tx.query('update afastamento set tipo_afastamento_id = $2, inicio = $3, fim = $4 where id = $1', [id, novo.tipo, novo.inicio, novo.fim]),
      );
      return c.json({ id, tipoAfastamentoId: novo.tipo, inicio: novo.inicio, fim: novo.fim });
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.delete('/afastamentos/:id', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'afastamento', id);
    if (negado) return negado;
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) => tx.query('delete from afastamento where id = $1', [id]));
    return c.body(null, 204);
  });

  return r;
}
