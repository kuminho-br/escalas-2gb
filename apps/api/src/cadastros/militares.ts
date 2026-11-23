// Militares: identificação, rastreio (alterar situação), CNH e afastamentos.
import {
  AlteracaoDeSituacao,
  EdicaoAfastamento,
  EdicaoMilitar,
  MENSAGEM_FIM_ANTES_DO_INICIO,
  Mes,
  mesParaData,
  NovoAfastamento,
  NovoMilitar,
  type Comportamento,
  type Equipe,
  type FichaMilitar,
  type LinhaMilitar,
  type ListaDoPeculio,
  type Posto,
  type Quadro,
  type SecaoDeLotacao,
} from 'contratos';
import { cnhHabilitadas, diasDoMes } from 'dominio';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirAlgumPapel, exigirPapel, exigirSessao, temPapel, temPapelAcima, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { quadroParaOPosto } from './quadros.ts';
import { categoriaMaisAlta, pendenciasDoMilitar, repetidasPorAntiguidade, situacaoNoMes } from './militares-regras.ts';

type Ctx = Context<AmbienteApi>;
const MSG_PERIODO_ANTES = 'Use o dia do período aberto ou um dia depois.';
const MSG_EQUIPE_DE_OUTRA = 'Escolha uma equipe da unidade da lotação.';
const MSG_EMAIL_REPETIDO = 'Este e-mail já é de outro militar.';
const MSG_EMAIL_COM_ACESSO = 'Desative o acesso antes de apagar o e-mail.';
const MSG_SITUACAO_MUDOU = 'A situação do militar mudou enquanto você alterava. Recarregue a ficha e tente de novo.';
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
  quadro_id: string | null;
  quadro_sigla: string | null;
  nome_guerra: string;
  nome_completo: string | null;
  sexo: 'M' | 'F' | null;
  nascimento_dia: number | null;
  nascimento_mes: number | null;
  telefone: string | null;
  email: string | null;
  comportamento: Comportamento | null;
  comportamento_boletim: string | null;
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
    quadro: m.quadro_id && m.quadro_sigla ? { id: m.quadro_id, sigla: m.quadro_sigla } : null,
    nomeGuerra: m.nome_guerra,
    equipe: m.equipe,
    jornada: m.jornada,
    motorista: m.motorista ? categoriaMaisAlta(m.cnh) : null,
    voluntarioJes: m.voluntario_jes,
    ativo: m.ativo,
    situacao: situacaoNoMes(afast, mes),
    pendencias: pendenciasDoMilitar({ motorista: m.motorista, cnh: m.cnh, jornada: m.jornada, equipe: m.equipe, antiguidade: m.antiguidade, nomeCompleto: m.nome_completo, quadro: m.quadro_id, repetidaCom }),
  };
}

/**
 * O dia que decide a situação de um militar num mês: hoje, se o mês é o de hoje; o primeiro dia, se o mês é futuro; o último, se já passou.
 * Com o rastreio por dia, um militar pode ter dois períodos no mesmo mês: a lista e a ficha mostram o que vale neste dia.
 */
function diaDeReferencia(mes: string): string {
  const { primeiro, ultimo } = limitesDoMes(mes);
  const hoje = hojeRecife();
  return hoje < primeiro ? primeiro : hoje > ultimo ? ultimo : hoje;
}

/** `$2` e `$3` são os limites do mês e `$4`, o dia de referência; `quem` é a coluna do militar e `sub`, a condição extra sobre a unidade do período. */
const PERIODO_DO_DIA = (quem: string, sub = '') =>
  `(select x.id from rastreio x ${sub ? 'join unidade ux on ux.id = x.unidade_id join unidade alvo2 on alvo2.id = $1' : ''}
     where x.militar_id = ${quem} and x.desde <= $3 and (x.ate is null or x.ate >= $2) ${sub}
     order by (x.desde <= $4 and (x.ate is null or x.ate >= $4)) desc, x.desde desc limit 1)`;

const SELECT_MILITAR = `
  select m.id, m.matricula, p.sigla as posto, m.posto_grad_id, m.quadro_id, (select q.sigla from quadro q where q.id = m.quadro_id) as quadro_sigla, m.nome_guerra, m.nome_completo, m.sexo, m.nascimento_dia, m.nascimento_mes,
         m.telefone, m.email, m.comportamento, m.comportamento_boletim, m.antiguidade, m.motorista, m.cnh,
         m.voluntario_jes, m.ativo, e.nome as equipe, l.jornada`;

/** Ficha completa; a lotação "atual" é a que cobre o mês. null se o militar não existe. */
async function carregarFicha(c: Consulta, id: string, mes: string, usuarioId: string): Promise<FichaMilitar | null> {
  const { primeiro, ultimo } = limitesDoMes(mes);
  const { rows } = await c.query<LinhaBanco>(
    `${SELECT_MILITAR}
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join rastreio l on l.militar_id = m.id and l.id = ${PERIODO_DO_DIA('m.id')}
       left join equipe e on e.id = l.equipe_id
      where m.id = $1`,
    [id, primeiro, ultimo, diaDeReferencia(mes)],
  );
  const m = rows[0];
  if (!m) return null;
  const rastreio = await c.query<{ id: string; sigla: string; equipe: string | null; jornada: 'pronto' | 'adm'; desde: string; ate: string | null }>(
    `select l.id, un.sigla, e.nome as equipe, l.jornada, to_char(l.desde, 'YYYY-MM-DD') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate
       from rastreio l join unidade un on un.id = l.unidade_id left join equipe e on e.id = l.equipe_id
      where l.militar_id = $1 order by l.desde desc`,
    [id],
  );
  const afastamentos = await c.query<{ id: string; tipo: string; tipo_afastamento_id: string; inicio: string; fim: string; motivo: string | null; boletim: string | null }>(
    `select a.id, t.nome as tipo, a.tipo_afastamento_id, to_char(a.inicio, 'YYYY-MM-DD') as inicio, to_char(a.fim, 'YYYY-MM-DD') as fim, a.motivo, a.boletim
       from afastamento a join tipo_afastamento t on t.id = a.tipo_afastamento_id
      where a.militar_id = $1 order by a.inicio`,
    [id],
  );
  // a CNH é do militar: aparece mesmo fora do quadro de motoristas (só não vale para a escala)
  const cnh = [...m.cnh].sort();
  // compara com os ativos lotados, no mês, na mesma unidade; sem lotação ou inativo, não compara
  const colegas = await c.query<{ id: string; nome_guerra: string; antiguidade: number | null }>(
    `select m2.id, m2.nome_guerra, m2.antiguidade
       from rastreio l0
       join rastreio l2 on l2.unidade_id = l0.unidade_id and l2.desde <= $3 and (l2.ate is null or l2.ate >= $2)
       join militar m2 on m2.id = l2.militar_id and m2.ativo
      where l0.militar_id = $1 and l0.id = ${PERIODO_DO_DIA('l0.militar_id')}
      order by m2.nome_guerra`,
    [id, primeiro, ultimo, diaDeReferencia(mes)],
  );
  const repetidaCom = repetidasPorAntiguidade(colegas.rows.map((x) => ({ id: x.id, nomeGuerra: x.nome_guerra, antiguidade: x.antiguidade }))).get(id) ?? [];
  // o que quem pede pode editar: o Pecúlio é de quem tem papel acima da lotação atual; a escala, de quem tem papel nela ou acima
  const hoje = hojeRecife();
  const lotacaoAtual = await unidadeAtualDoMilitar(c, id, hoje);
  let escala = false;
  for (const u of await unidadesDoAcesso(c, id)) {
    if (await temPapel(c, usuarioId, u, CADASTRO, hoje)) {
      escala = true;
      break;
    }
  }
  const podeEditar = {
    peculio: lotacaoAtual ? await temPapelAcima(c, usuarioId, lotacaoAtual, CADASTRO, hoje) : false,
    escala,
    unidadeDeCima: lotacaoAtual ? await siglaDaUnidadeDeCima(c, lotacaoAtual) : null,
  };
  return {
    ...linhaDe(m, afastamentos.rows, mes, repetidaCom),
    antiguidadeRepetidaCom: repetidaCom,
    podeEditar,
    postoGradId: m.posto_grad_id,
    nomeCompleto: m.nome_completo,
    sexo: m.sexo,
    nascimento: m.nascimento_dia !== null && m.nascimento_mes !== null ? { dia: m.nascimento_dia, mes: m.nascimento_mes } : null,
    telefone: m.telefone,
    email: m.email,
    comportamento: m.comportamento,
    comportamentoBoletim: m.comportamento_boletim,
    antiguidade: m.antiguidade,
    noQuadroDeMotoristas: m.motorista,
    cnh,
    cnhPorHierarquia: cnhHabilitadas(cnh).filter((x) => !cnh.includes(x)),
    rastreio: rastreio.rows.map((l) => ({ id: l.id, unidadeSigla: l.sigla, equipe: l.equipe, jornada: l.jornada, desde: l.desde, ate: l.ate })),
    afastamentos: afastamentos.rows.map((a) => ({ id: a.id, tipo: a.tipo, tipoAfastamentoId: a.tipo_afastamento_id, inicio: a.inicio, fim: a.fim, motivo: a.motivo, boletim: a.boletim })),
  };
}

/** As unidades que dão acesso ao militar: as lotações deste mês em diante; sem nenhuma, a lotação mais recente. */
async function unidadesDoAcesso(banco: Consulta, militarId: string): Promise<string[]> {
  const inicioDoMes = `${hojeRecife().slice(0, 7)}-01`;
  const { rows } = await banco.query<{ unidade_id: string }>(
    'select distinct unidade_id from rastreio where militar_id = $1 and (ate is null or ate >= $2)',
    [militarId, inicioDoMes],
  );
  return rows.length ? rows.map((r) => r.unidade_id) : [(await unidadeDoRegistro(banco, 'militar', militarId))!];
}

/**
 * Confere o papel numa unidade do militar: as das lotações deste mês em diante (uma transferência
 * marcada para o mês que vem não tira o acesso de quem cuida dele agora). Sem nenhuma, vale a
 * lotação mais recente. 404 se o registro não existe.
 */
export async function exigirPapelNoRegistro(c: Ctx, tabela: 'militar' | 'afastamento', id: string): Promise<Response | null> {
  const banco = c.get('banco');
  const naoAchou = () => c.json({ erro: tabela === 'militar' ? 'Militar não encontrado.' : 'Afastamento não encontrado.' }, 404);
  if (!(await unidadeDoRegistro(banco, tabela, id))) return naoAchou();
  const militarId = tabela === 'militar' ? id : (await banco.query<{ militar_id: string }>('select militar_id from afastamento where id = $1', [id])).rows[0]!.militar_id;
  const unidades = await unidadesDoAcesso(banco, militarId);
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

/** A unidade em que o militar está lotado hoje: a do período que cobre hoje; sem ele, a do mais recente. */
async function unidadeAtualDoMilitar(c: Consulta, militarId: string, hoje: string): Promise<string | null> {
  const { rows } = await c.query<{ unidade_id: string }>(
    `select unidade_id from rastreio where militar_id = $1
      order by (desde <= $2::date and (ate is null or ate >= $2::date)) desc, desde desc limit 1`,
    [militarId, hoje],
  );
  return rows[0]?.unidade_id ?? null;
}

/** A sigla da unidade mãe: a "unidade de cima" que a mensagem cita ("quem tem papel no 2º GB"). */
async function siglaDaUnidadeDeCima(c: Consulta, unidadeId: string): Promise<string | null> {
  const { rows } = await c.query<{ sigla: string }>('select m.sigla from unidade u join unidade m on m.id = u.mae_id where u.id = $1', [unidadeId]);
  return rows[0]?.sigla ?? null;
}

/** 403 do bloco do Pecúlio: só quem tem papel numa unidade acima da lotação altera. `quem` completa a frase ("Este campo", "Os afastamentos"...). */
async function exigirDonoDoPeculio(c: Ctx, unidadeId: string, frase: (cima: string) => string): Promise<Response | null> {
  const banco = c.get('banco');
  if (await temPapelAcima(banco, c.get('usuarioId'), unidadeId, CADASTRO, hojeRecife())) return null;
  const cima = await siglaDaUnidadeDeCima(banco, unidadeId);
  return c.json({ erro: frase(cima ?? 'uma unidade acima') }, 403);
}
const FRASE_CAMPO = (cima: string) => `Este campo é alterado por quem tem papel no ${cima}.`;
const FRASE_LOTACAO = (cima: string) => `A lotação é alterada por quem tem papel no ${cima}.`;
const FRASE_CADASTRAR = (cima: string) => `Cadastrar militar é com quem tem papel no ${cima}.`;
const FRASE_AFASTAMENTOS = (cima: string) => `Os afastamentos são alterados por quem tem papel no ${cima}.`;

/** Os campos da ficha que são do Pecúlio (o resto do PATCH é da escala: motorista, CNH, voluntário JES e ativo). */
const CAMPOS_DO_PECULIO = ['postoGradId', 'quadroId', 'nomeCompleto', 'nomeGuerra', 'antiguidade', 'sexo', 'nascimento', 'telefone', 'email', 'comportamento', 'comportamentoBoletim'] as const;

const militarDoAfastamento = async (c: Consulta, afastamentoId: string): Promise<string> =>
  (await c.query<{ militar_id: string }>('select militar_id from afastamento where id = $1', [afastamentoId])).rows[0]!.militar_id;

/** Exige o dono do Pecúlio sobre o militar (pela lotação atual dele); 404 se o militar não existe. */
async function exigirDonoDoPeculioDoMilitar(c: Ctx, militarId: string, frase: (cima: string) => string): Promise<Response | null> {
  const ref = await unidadeAtualDoMilitar(c.get('banco'), militarId, hojeRecife());
  return ref ? exigirDonoDoPeculio(c, ref, frase) : c.json({ erro: 'Este militar ainda não tem lotação.' }, 409);
}

const mesDaConsulta = (c: Ctx) => c.req.query('mes') ?? hojeRecife().slice(0, 7);

export function rotasMilitares(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/postos', '/quadros', '/secoes', '/unidades/:u/equipes', '/unidades/:u/militares', '/unidades/:u/peculio', '/militares/*', '/afastamentos/*']) r.use(caminho, sessao);

  r.get('/postos', async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const { rows } = await dep.banco.query<Posto>('select id, sigla, nome, ordem from posto_grad order by ordem');
    return c.json(rows);
  });

  // os quadros são fixos e não têm nada sigiloso: qualquer pessoa com sessão lê
  r.get('/quadros', async (c) => {
    const { rows } = await dep.banco.query<Quadro>(
      `select q.id, q.sigla, q.nome, coalesce(array_agg(qp.posto_grad_id order by p.ordem) filter (where qp.posto_grad_id is not null), '{}') as "postoGradIds"
         from quadro q left join quadro_posto_grad qp on qp.quadro_id = q.id left join posto_grad p on p.id = qp.posto_grad_id
        group by q.id order by q.ordem`,
    );
    return c.json(rows);
  });

  // as seções em que a pessoa pode lotar um militar: as que ela pode cadastrar (o administrador, todas)
  r.get('/secoes', async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const hoje = hojeRecife();
    const { rows } = await dep.banco.query<SecaoDeLotacao>("select id, sigla, nome from unidade where tipo = 'secao' and (ate is null or ate >= $1::date) order by sigla", [hoje]);
    const permitidas: SecaoDeLotacao[] = [];
    for (const u of rows) if (await temPapel(dep.banco, c.get('usuarioId'), u.id, CADASTRO, hoje)) permitidas.push(u);
    return c.json(permitidas);
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
          and l.id = ${PERIODO_DO_DIA('m.id', 'and alvo2.caminho @> ux.caminho')}
        order by p.ordem desc, m.antiguidade asc nulls last, m.nome_guerra`,
      [u, primeiro, ultimo, diaDeReferencia(mes)],
    );
    const afast = await afastamentosNoMes(dep.banco, rows.map((m) => m.id), mes);
    const repetidas = repetidasPorAntiguidade(rows.filter((m) => m.ativo).map((m) => ({ id: m.id, nomeGuerra: m.nome_guerra, antiguidade: m.antiguidade })));
    return c.json(rows.map((m) => linhaDe(m, afast.filter((a) => a.militar_id === m.id), mes, repetidas.get(m.id))));
  });

  // O módulo Pecúlio: os militares lotados em :u e nas unidades de baixo no mês, com os dados de contato, e os aniversariantes do mês.
  // Quem tem papel de cadastro em :u lê; quem edita cada bloco é o dono dele (a ficha diz).
  r.get('/unidades/:u/peculio', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const mes = mesDaConsulta(c);
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const { primeiro, ultimo } = limitesDoMes(mes);
    const { rows } = await dep.banco.query<LinhaBanco & { lotacao: string }>(
      `${SELECT_MILITAR}, un.sigla as lotacao
         from rastreio l
         join unidade un on un.id = l.unidade_id
         join unidade alvo on alvo.id = $1
         join militar m on m.id = l.militar_id
         join posto_grad p on p.id = m.posto_grad_id
         left join equipe e on e.id = l.equipe_id
        where alvo.caminho @> un.caminho and l.desde <= $3 and (l.ate is null or l.ate >= $2)
          and l.id = ${PERIODO_DO_DIA('m.id', 'and alvo2.caminho @> ux.caminho')}
        order by p.ordem desc, m.antiguidade asc nulls last, m.nome_guerra`,
      [u, primeiro, ultimo, diaDeReferencia(mes)],
    );
    const repetidas = repetidasPorAntiguidade(rows.filter((m) => m.ativo).map((m) => ({ id: m.id, nomeGuerra: m.nome_guerra, antiguidade: m.antiguidade })));
    const numeroDoMes = Number(mes.slice(5, 7));
    const lista: ListaDoPeculio = {
      militares: rows.map((m) => ({
        militarId: m.id,
        matricula: m.matricula,
        posto: m.posto,
        nomeGuerra: m.nome_guerra,
        nomeCompleto: m.nome_completo,
        lotacao: m.lotacao,
        telefone: m.telefone,
        email: m.email,
        pendencias: pendenciasDoMilitar({
          motorista: m.motorista, cnh: m.cnh, jornada: m.jornada, equipe: m.equipe, antiguidade: m.antiguidade, nomeCompleto: m.nome_completo, quadro: m.quadro_id, repetidaCom: repetidas.get(m.id),
        }),
      })),
      // quem não tem o nascimento preenchido não entra; no mesmo dia, a ordem é a da lista (posto, antiguidade, nome)
      aniversariantes: rows
        .flatMap((m) => (m.nascimento_dia !== null && m.nascimento_mes === numeroDoMes ? [{ militarId: m.id, posto: m.posto, nomeGuerra: m.nome_guerra, dia: m.nascimento_dia, lotacao: m.lotacao }] : []))
        .sort((a, b) => a.dia - b.dia),
    };
    return c.json(lista);
  });

  r.post('/unidades/:u/militares', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    // cadastrar militar é do Pecúlio: papel numa unidade acima da seção em que ele entra
    const naoEDono = await exigirDonoDoPeculio(c, u, FRASE_CADASTRAR);
    if (naoEDono) return naoEDono;
    const corpo = await lerCorpo(c, NovoMilitar);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    try {
      const quadro = await quadroParaOPosto(dep.banco, d.postoGradId, d.quadroId, null);
      if ('erro' in quadro) return c.json({ erro: quadro.erro, campos: { quadroId: quadro.erro } }, 400);
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            `insert into militar (matricula, posto_grad_id, quadro_id, nome_completo, nome_guerra, antiguidade, motorista, cnh, voluntario_jes)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
            [d.matricula, d.postoGradId, quadro.quadroId, d.nomeCompleto, d.nomeGuerra, d.antiguidade, d.motorista, d.cnh, d.voluntarioJes],
          )
        ).rows[0]!.id;
        await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde) values ($1, $2, $3, $4, $5)', [
          id, u, d.lotacao.equipeId, d.lotacao.jornada, d.lotacao.desde,
        ]);
        return carregarFicha(tx, id, d.lotacao.desde.slice(0, 7), c.get('usuarioId'));
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
    return c.json(await carregarFicha(dep.banco, id, mes, c.get('usuarioId')));
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
    // os campos do Pecúlio e os da escala são conferidos separadamente, antes de gravar: com um campo do Pecúlio sem permissão, nada é gravado
    if (CAMPOS_DO_PECULIO.some((k) => d[k] !== undefined)) {
      const naoEDono = await exigirDonoDoPeculioDoMilitar(c, id, FRASE_CAMPO);
      if (naoEDono) return naoEDono;
    }
    try {
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        // o estado atual é lido já dentro da transação, com a linha travada: duas edições ao mesmo tempo, em campos
        // diferentes, não se atropelam (a segunda parte do que a primeira gravou)
        const atual = (await tx.query<Pick<LinhaBanco, 'posto_grad_id' | 'quadro_id' | 'nome_completo' | 'nome_guerra' | 'sexo' | 'nascimento_dia' | 'nascimento_mes' | 'telefone' | 'email' | 'comportamento' | 'comportamento_boletim' | 'antiguidade' | 'motorista' | 'cnh' | 'voluntario_jes' | 'ativo'>>(
          `select posto_grad_id, quadro_id, nome_completo, nome_guerra, sexo, nascimento_dia, nascimento_mes, telefone, email, comportamento, comportamento_boletim,
                  antiguidade, motorista, cnh, voluntario_jes, ativo from militar where id = $1 for update`,
          [id],
        )).rows[0]!;
        // `undefined` mantém o que está gravado; `null` limpa
        const novo = <T,>(valor: T | undefined, gravado: T): T => (valor === undefined ? gravado : valor);
        const nascimentoDia = d.nascimento === undefined ? atual.nascimento_dia : (d.nascimento?.dia ?? null);
        const nascimentoMes = d.nascimento === undefined ? atual.nascimento_mes : (d.nascimento?.mes ?? null);
        // desmarcar o quadro de motoristas não apaga a CNH: ela só deixa de valer para a escala
        const motorista = d.motorista ?? atual.motorista;
        const cnh = d.cnh ?? atual.cnh;
        // o quadro acompanha o posto (trocar MAJ do QOA por CEL leva ao QOC); quadro que não contém o posto é 400, antes de gravar
        const postoGradId = d.postoGradId ?? atual.posto_grad_id;
        // só quando o posto ou o quadro vêm no pedido: o quadro é campo do Pecúlio, e um PATCH só da escala (motorista, JES, ativo) não o preenche
        const quadro = d.postoGradId === undefined && d.quadroId === undefined ? { quadroId: atual.quadro_id } : await quadroParaOPosto(tx, postoGradId, d.quadroId, atual.quadro_id);
        if ('erro' in quadro) return quadro;
        await tx.query(
          `update militar set posto_grad_id = $2, quadro_id = $17, nome_guerra = $3, antiguidade = $4, motorista = $5, cnh = $6, voluntario_jes = $7, ativo = $8,
                  nome_completo = $9, sexo = $10, nascimento_dia = $11, nascimento_mes = $12, telefone = $13, email = $14, comportamento = $15, comportamento_boletim = $16
            where id = $1`,
          [
            id,
            postoGradId,
            d.nomeGuerra ?? atual.nome_guerra,
            d.antiguidade === undefined ? atual.antiguidade : d.antiguidade,
            motorista,
            cnh,
            d.voluntarioJes ?? atual.voluntario_jes,
            d.ativo ?? atual.ativo,
            d.nomeCompleto ?? atual.nome_completo,
            novo(d.sexo, atual.sexo),
            nascimentoDia,
            nascimentoMes,
            novo(d.telefone, atual.telefone),
            novo(d.email, atual.email),
            novo(d.comportamento, atual.comportamento),
            novo(d.comportamentoBoletim, atual.comportamento_boletim),
            quadro.quadroId,
          ],
        );
        return carregarFicha(tx, id, mes, c.get('usuarioId'));
      });
      if (ficha && 'erro' in ficha) return c.json({ erro: ficha.erro, campos: { quadroId: ficha.erro } }, 400);
      return c.json(ficha);
    } catch (e) {
      // o e-mail é único sem distinção de maiúsculas (índice militar_email_unico): o 409 vai no campo
      const doBanco = e as { code?: string; message?: string; constraint?: string } | null;
      // quem tem acesso ativo entra pelo e-mail da ficha (gatilho militar_email_para_usuario): apagá-lo pede desativar o acesso antes
      if (doBanco?.code === 'P0001' && /email_obrigatorio_com_acesso/.test(doBanco.message ?? '')) {
        return c.json({ erro: MSG_EMAIL_COM_ACESSO, campos: { email: MSG_EMAIL_COM_ACESSO } }, 409);
      }
      if (doBanco?.code === '23505' && /militar_email_unico|usuario_email/.test(`${doBanco.constraint ?? ''} ${doBanco.message ?? ''}`)) {
        return c.json({ erro: MSG_EMAIL_REPETIDO, campos: { email: MSG_EMAIL_REPETIDO } }, 409);
      }
      return respostaDoErroDoBanco(c, e, MSG_MATRICULA);
    }
  });

  // "Alterar situação": lotação (a unidade), equipe e jornada a partir de um mês. No mês do período aberto, substitui o período; depois dele,
  // fecha o período aberto no fim do mês anterior e abre outro; antes dele, é 400.
  r.post('/militares/:id/situacao', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const corpo = await lerCorpo(c, AlteracaoDeSituacao);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    // a unidade de destino também precisa ser de quem registra
    const negadoDestino = await exigirPapel(c, d.unidadeId, CADASTRO);
    if (negadoDestino) return negadoDestino;
    if (d.equipeId) {
      const daUnidade = (await dep.banco.query('select 1 from equipe where id = $1 and unidade_id = $2', [d.equipeId, d.unidadeId])).rows.length > 0;
      if (!daUnidade) return c.json({ erro: MSG_EQUIPE_DE_OUTRA, campos: { equipeId: MSG_EQUIPE_DE_OUTRA } }, 400);
    }
    // o período aberto pode ser de outra seção (uma mudança de lotação já marcada): substituí-lo ou fechá-lo também pede papel nela
    const unidadeAberta = (await dep.banco.query<{ unidade_id: string }>('select unidade_id from rastreio where militar_id = $1 and ate is null', [id])).rows[0]?.unidade_id;
    if (unidadeAberta && unidadeAberta !== d.unidadeId) {
      const negadoAberta = await exigirPapel(c, unidadeAberta, CADASTRO);
      if (negadoAberta) return negadoAberta;
    }
    // mudar a LOTAÇÃO (a unidade) é do Pecúlio: papel acima da lotação atual. Equipe e jornada, com a lotação travada, são da escala (papel na lotação ou acima)
    const lotacaoAtual = await unidadeAtualDoMilitar(dep.banco, id, hojeRecife());
    if (lotacaoAtual && d.unidadeId !== (unidadeAberta ?? lotacaoAtual)) {
      const naoEDono = await exigirDonoDoPeculio(c, lotacaoAtual, FRASE_LOTACAO);
      if (naoEDono) return naoEDono;
    }
    try {
      const resultado = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        // o período aberto é lido dentro da transação, com a linha travada: duas alterações ao mesmo tempo não se atropelam
        const aberta = (await tx.query<{ id: string; desde: string; unidade_id: string }>(
          "select id, to_char(desde, 'YYYY-MM-DD') as desde, unidade_id from rastreio where militar_id = $1 and ate is null for update",
          [id],
        )).rows[0];
        // outra gravação trocou a unidade do período aberto entre a conferência do papel e agora: confere de novo, com a ficha atualizada
        if (aberta && aberta.unidade_id !== d.unidadeId && aberta.unidade_id !== unidadeAberta) return 'mudou' as const;
        if (aberta && d.desde < aberta.desde) return 'antes' as const;
        const mes = d.desde.slice(0, 7);
        if (aberta && d.desde === aberta.desde) {
          await tx.query('update rastreio set unidade_id = $2, equipe_id = $3, jornada = $4 where id = $1', [aberta.id, d.unidadeId, d.equipeId, d.jornada]);
          return { ficha: await carregarFicha(tx, id, mes, c.get('usuarioId')), criado: false };
        }
        if (aberta) await tx.query("update rastreio set ate = $2::date - interval '1 day' where id = $1", [aberta.id, d.desde]);
        await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde) values ($1, $2, $3, $4, $5)', [
          id, d.unidadeId, d.equipeId, d.jornada, d.desde,
        ]);
        return { ficha: await carregarFicha(tx, id, mes, c.get('usuarioId')), criado: true };
      });
      if (resultado === 'mudou') return c.json({ erro: MSG_SITUACAO_MUDOU }, 409);
      if (resultado === 'antes') return c.json({ erro: MSG_PERIODO_ANTES, campos: { desde: MSG_PERIODO_ANTES } }, 400);
      return c.json(resultado.ficha, resultado.criado ? 201 : 200);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_MATRICULA);
    }
  });

  r.post('/militares/:id/afastamentos', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'militar', id);
    if (negado) return negado;
    const naoEDono = await exigirDonoDoPeculioDoMilitar(c, id, FRASE_AFASTAMENTOS);
    if (naoEDono) return naoEDono;
    const corpo = await lerCorpo(c, NovoAfastamento);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const tipoRuim = await conferirTipo(c, d.tipoAfastamentoId);
    if (tipoRuim) return tipoRuim;
    try {
      const novo = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) =>
        (await tx.query<{ id: string }>(
          'insert into afastamento (militar_id, tipo_afastamento_id, inicio, fim, motivo, boletim) values ($1, $2, $3, $4, $5, $6) returning id',
          [id, d.tipoAfastamentoId, d.inicio, d.fim, d.motivo ?? null, d.boletim ?? null],
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
    const naoEDono = await exigirDonoDoPeculioDoMilitar(c, await militarDoAfastamento(dep.banco, id), FRASE_AFASTAMENTOS);
    if (naoEDono) return naoEDono;
    const corpo = await lerCorpo(c, EdicaoAfastamento);
    if (!corpo.ok) return corpo.resposta;
    const atual = (await dep.banco.query<{ tipo: string; inicio: string; fim: string; motivo: string | null; boletim: string | null }>(
      "select tipo_afastamento_id as tipo, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim, motivo, boletim from afastamento where id = $1",
      [id],
    )).rows[0]!;
    // `undefined` mantém o que está gravado; `null` limpa o motivo ou o boletim
    const novo = {
      tipo: corpo.dados.tipoAfastamentoId ?? atual.tipo,
      inicio: corpo.dados.inicio ?? atual.inicio,
      fim: corpo.dados.fim ?? atual.fim,
      motivo: corpo.dados.motivo === undefined ? atual.motivo : corpo.dados.motivo,
      boletim: corpo.dados.boletim === undefined ? atual.boletim : corpo.dados.boletim,
    };
    if (novo.fim < novo.inicio) return c.json({ erro: MENSAGEM_FIM_ANTES_DO_INICIO, campos: { fim: MENSAGEM_FIM_ANTES_DO_INICIO } }, 400);
    if (corpo.dados.tipoAfastamentoId) {
      const tipoRuim = await conferirTipo(c, novo.tipo);
      if (tipoRuim) return tipoRuim;
    }
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) =>
        tx.query('update afastamento set tipo_afastamento_id = $2, inicio = $3, fim = $4, motivo = $5, boletim = $6 where id = $1', [id, novo.tipo, novo.inicio, novo.fim, novo.motivo, novo.boletim]),
      );
      return c.json({ id, tipoAfastamentoId: novo.tipo, inicio: novo.inicio, fim: novo.fim, motivo: novo.motivo, boletim: novo.boletim });
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.delete('/afastamentos/:id', async (c) => {
    const id = c.req.param('id');
    const negado = await exigirPapelNoRegistro(c, 'afastamento', id);
    if (negado) return negado;
    const naoEDono = await exigirDonoDoPeculioDoMilitar(c, await militarDoAfastamento(dep.banco, id), FRASE_AFASTAMENTOS);
    if (naoEDono) return naoEDono;
    await comUsuario(dep.banco, c.get('usuarioId'), (tx) => tx.query('delete from afastamento where id = $1', [id]));
    return c.body(null, 204);
  });

  return r;
}
