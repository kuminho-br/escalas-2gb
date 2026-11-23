// Militares: identificação, rastreio (alterar situação), CNH e afastamentos.
import {
  AlteracaoDeSituacao,
  ConfirmarExclusao,
  NovoPosto,
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
  type UnidadeDeLotacao,
} from 'contratos';
import { cnhHabilitadas, diasDoMes } from 'dominio';
import { Hono, type Context } from 'hono';
import { CADASTRO, ehAdministrador, exigirAdministradorRaiz, exigirAlgumPapel, exigirPapel, exigirSessao, siglaDaUnidadeDeCima, temPapel, temPapelAcima, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { postoCurto } from '../oficiais/participantes.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { apagarMilitar, oQueVaiJunto } from './apagar-militar.ts';
import { mudarPeriodoAberto, periodoAberto } from './periodo-aberto.ts';
import { lerQuadros, quadroParaOPosto } from './quadros.ts';
import { categoriaMaisAlta, pendenciasDoMilitar, repetidasPorAntiguidade, situacaoNoMes } from './militares-regras.ts';

type Ctx = Context<AmbienteApi>;
const MSG_SITUACAO_DESATIVADA = 'Esta situação está desativada.';
const MSG_SITUACAO_NAO_ACHADA = 'Situação não encontrada.';
const MSG_PERIODO_ANTES = (desde: string) => `Use uma data a partir de ${desde.slice(8, 10)}/${desde.slice(5, 7)}/${desde.slice(0, 4)}.`;
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
  nascimento_ano: number | null;
  cpf: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  comportamento: Comportamento | null;
  comportamento_boletim: string | null;
  antiguidade: number | null;
  motorista: boolean;
  cnh: string[];
  voluntario_jes: boolean;
  funcao_militar_id: string | null;
  funcao_nome: string | null;
  abono_permanencia: boolean;
  /** a situação do período pode ser escalada (substitui o antigo `ativo` do militar) */
  ativo: boolean;
  situacao_id: string | null;
  situacao_nome: string | null;
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
  select m.id, m.matricula, p.sigla as posto, m.posto_grad_id, l.quadro_id, (select q.sigla from quadro q where q.id = l.quadro_id) as quadro_sigla, m.nome_guerra, m.nome_completo, m.sexo, m.nascimento_dia, m.nascimento_mes, m.nascimento_ano,
         m.cpf, m.cep, m.logradouro, m.numero, m.complemento, m.bairro, m.cidade, m.uf,
         m.telefone, m.email, m.comportamento, m.comportamento_boletim, m.antiguidade, m.motorista, m.cnh,
         m.voluntario_jes, m.funcao_militar_id, (select f.nome from funcao_militar f where f.id = m.funcao_militar_id) as funcao_nome, m.abono_permanencia,
         coalesce(sm.escalavel, false) as ativo, l.situacao_id, sm.nome as situacao_nome, e.nome as equipe, l.jornada`;

/** Ficha completa; a lotação "atual" é a que cobre o mês. null se o militar não existe. */
async function carregarFicha(c: Consulta, id: string, mes: string, usuarioId: string): Promise<FichaMilitar | null> {
  const { primeiro, ultimo } = limitesDoMes(mes);
  const { rows } = await c.query<LinhaBanco>(
    `${SELECT_MILITAR}
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join rastreio l on l.militar_id = m.id and l.id = ${PERIODO_DO_DIA('m.id')}
       left join equipe e on e.id = l.equipe_id
       left join situacao_militar sm on sm.id = l.situacao_id
      where m.id = $1`,
    [id, primeiro, ultimo, diaDeReferencia(mes)],
  );
  const m = rows[0];
  if (!m) return null;
  const rastreio = await c.query<{
    id: string; unidade_id: string; sigla: string; equipe: string | null; jornada: 'pronto' | 'adm'; quadro: string | null; situacao: string; desde: string; ate: string | null;
    autor_nome: string | null; autor_posto: string | null; alterado_em: string | null; cima: string | null; sigla_repetida: boolean;
  }>(
    `select l.id, l.unidade_id, un.sigla, e.nome as equipe,
            (select m.sigla from unidade m where m.id = un.mae_id) as cima,
            exists (select 1 from unidade o where lower(o.sigla) = lower(un.sigla) and o.id <> un.id and (o.ate is null or o.ate >= current_date)) as sigla_repetida, l.jornada, q.sigla as quadro, sm.nome as situacao, to_char(l.desde, 'YYYY-MM-DD') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate,
            mm.nome_guerra as autor_nome, pp.sigla as autor_posto, to_char(la.em at time zone 'America/Recife', 'YYYY-MM-DD"T"HH24:MI:SS') as alterado_em
       from rastreio l join unidade un on un.id = l.unidade_id left join equipe e on e.id = l.equipe_id left join quadro q on q.id = l.quadro_id
       join situacao_militar sm on sm.id = l.situacao_id
       -- a última mudança deste período que não foi só fechá-lo (o fim do período é posto por quem abre o próximo, e o período antigo segue com quem o abriu):
       -- quem mexeu e quando (sem usuário, ou usuário sem militar, não há autor)
       left join lateral (
         select a.em, a.usuario_id from auditoria a
          where a.tabela = 'rastreio' and a.registro_id = l.id::text and not (a.acao = 'update' and (a.antes - 'ate') is not distinct from (a.depois - 'ate'))
          order by a.id desc limit 1
       ) la on true
       left join usuario uu on uu.id = la.usuario_id left join militar mm on mm.id = uu.militar_id left join posto_grad pp on pp.id = mm.posto_grad_id
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
    `select distinct m2.id, m2.nome_guerra, m2.antiguidade
       from rastreio l0
       join rastreio l2 on l2.unidade_id = l0.unidade_id and l2.desde <= $3 and (l2.ate is null or l2.ate >= $2)
       join situacao_militar sm2 on sm2.id = l2.situacao_id and sm2.escalavel
       join militar m2 on m2.id = l2.militar_id
      where l0.militar_id = $1 and l0.id = ${PERIODO_DO_DIA('l0.militar_id')}
      order by m2.nome_guerra`,
    [id, primeiro, ultimo, diaDeReferencia(mes)],
  );
  const repetidaCom = repetidasPorAntiguidade(colegas.rows.map((x) => ({ id: x.id, nomeGuerra: x.nome_guerra, antiguidade: x.antiguidade }))).get(id) ?? [];
  // o que quem pede pode editar: o Pecúlio é de quem tem papel acima da lotação atual; a escala, de quem tem papel nela ou acima
  const hoje = hojeRecife();
  const lotacaoAtual = await unidadeAtualDoMilitar(c, id, hoje);
  // o administrador age em todo militar, tenha ele lotação ou não (o militar recém-criado ainda não tem a primeira)
  const admin = await ehAdministrador(c, usuarioId, hoje);
  let escala = !lotacaoAtual && admin;
  if (lotacaoAtual) {
    for (const u of await unidadesDoAcesso(c, id)) {
      if (await temPapel(c, usuarioId, u, CADASTRO, hoje)) {
        escala = true;
        break;
      }
    }
  }
  const podeEditar = {
    peculio: lotacaoAtual ? await temPapelAcima(c, usuarioId, lotacaoAtual, CADASTRO, hoje) : admin,
    escala,
    unidadeDeCima: lotacaoAtual ? await siglaDaUnidadeDeCima(c, lotacaoAtual) : null,
  };
  // CPF, nascimento, endereço e abono de permanência: de quem cuida do Pecúlio (nível de acesso acima da lotação) e do administrador; para os outros as chaves nem saem
  const veDadosRestritos = podeEditar.peculio || admin;
  return {
    ...linhaDe(m, afastamentos.rows, mes, repetidaCom),
    antiguidadeRepetidaCom: repetidaCom,
    podeEditar,
    postoGradId: m.posto_grad_id,
    nomeCompleto: m.nome_completo,
    sexo: m.sexo,
    funcao: m.funcao_nome,
    funcaoMilitarId: m.funcao_militar_id,
    veDadosRestritos,
    ...(veDadosRestritos
      ? {
          abonoPermanencia: m.abono_permanencia,
          nascimento: m.nascimento_dia !== null && m.nascimento_mes !== null ? { dia: m.nascimento_dia, mes: m.nascimento_mes, ano: m.nascimento_ano } : null,
          cpf: m.cpf,
          endereco: { cep: m.cep, logradouro: m.logradouro, numero: m.numero, complemento: m.complemento, bairro: m.bairro, cidade: m.cidade, uf: m.uf },
        }
      : {}),
    situacaoDoMilitar: m.situacao_id && m.situacao_nome ? { id: m.situacao_id, nome: m.situacao_nome, escalavel: m.ativo } : null,
    telefone: m.telefone,
    email: m.email,
    comportamento: m.comportamento,
    comportamentoBoletim: m.comportamento_boletim,
    antiguidade: m.antiguidade,
    noQuadroDeMotoristas: m.motorista,
    cnh,
    cnhPorHierarquia: cnhHabilitadas(cnh).filter((x) => !cnh.includes(x)),
    rastreio: rastreio.rows.map((l) => ({
      // a sigla que se repete leva a unidade de cima ("2ª SB (2º GB)"), como na lista de destinos
      id: l.id, unidadeId: l.unidade_id, unidadeSigla: l.sigla_repetida && l.cima ? `${l.sigla} (${l.cima})` : l.sigla, equipe: l.equipe, jornada: l.jornada, quadro: l.quadro, situacao: l.situacao, desde: l.desde, ate: l.ate,
      alteradoPor: l.autor_nome && l.autor_posto ? { patente: postoCurto(l.autor_posto), nomeGuerra: l.autor_nome } : null,
      alteradoEm: l.autor_nome && l.autor_posto ? l.alterado_em : null,
    })),
    afastamentos: afastamentos.rows.map((a) => ({ id: a.id, tipo: a.tipo, tipoAfastamentoId: a.tipo_afastamento_id, inicio: a.inicio, fim: a.fim, motivo: a.motivo, boletim: a.boletim })),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!(await unidadeDoRegistro(banco, tabela, id))) {
    // um militar sem nenhuma lotação (o administrador criado na instalação, o cadastro que ainda não foi lotado): só o administrador o abre, para dar a primeira
    const semLotacao = tabela === 'militar' && UUID.test(id) && (await banco.query('select 1 from militar where id = $1', [id])).rows.length > 0;
    return semLotacao && (await ehAdministrador(banco, c.get('usuarioId'), hojeRecife())) ? null : naoAchou();
  }
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

/** 403 do bloco do Pecúlio: só quem tem papel numa unidade acima da lotação altera. `quem` completa a frase ("Este campo", "Os afastamentos"...). */
async function exigirDonoDoPeculio(c: Ctx, unidadeId: string, frase: (cima: string) => string): Promise<Response | null> {
  const banco = c.get('banco');
  if (await temPapelAcima(banco, c.get('usuarioId'), unidadeId, CADASTRO, hojeRecife())) return null;
  const cima = await siglaDaUnidadeDeCima(banco, unidadeId);
  return c.json({ erro: frase(cima ?? 'uma unidade acima') }, 403);
}
const FRASE_CAMPO = (cima: string) => `Este campo é alterado por quem tem nível de acesso no ${cima}.`;
const FRASE_LOTACAO = (cima: string) => `A lotação é alterada por quem tem nível de acesso no ${cima}.`;
const FRASE_CADASTRAR = (cima: string) => `Cadastrar militar é com quem tem nível de acesso no ${cima}.`;
const FRASE_AFASTAMENTOS = (cima: string) => `Os afastamentos são alterados por quem tem nível de acesso no ${cima}.`;

/** Os campos da ficha que são do Pecúlio (o resto do PATCH é da escala: motorista, CNH e voluntário JES). */
const CAMPOS_DO_PECULIO = ['postoGradId', 'nomeCompleto', 'nomeGuerra', 'antiguidade', 'sexo', 'nascimento', 'cpf', 'endereco', 'telefone', 'email', 'comportamento', 'comportamentoBoletim', 'funcaoMilitarId', 'abonoPermanencia'] as const;

const militarDoAfastamento = async (c: Consulta, afastamentoId: string): Promise<string> =>
  (await c.query<{ militar_id: string }>('select militar_id from afastamento where id = $1', [afastamentoId])).rows[0]!.militar_id;

/** Exige o dono do Pecúlio sobre o militar (pela lotação atual dele); 404 se o militar não existe. */
async function exigirDonoDoPeculioDoMilitar(c: Ctx, militarId: string, frase: (cima: string) => string): Promise<Response | null> {
  const ref = await unidadeAtualDoMilitar(c.get('banco'), militarId, hojeRecife());
  if (ref) return exigirDonoDoPeculio(c, ref, frase);
  // sem lotação só o administrador age (ele dá a primeira); para os outros o militar nem aparece
  return (await ehAdministrador(c.get('banco'), c.get('usuarioId'), hojeRecife())) ? null : c.json({ erro: 'Este militar ainda não tem lotação.' }, 409);
}

const mesDaConsulta = (c: Ctx) => c.req.query('mes') ?? hojeRecife().slice(0, 7);

export function rotasMilitares(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/postos', '/postos/*', '/quadros', '/unidades-de-lotacao', '/unidades/:u/equipes', '/unidades/:u/militares', '/unidades/:u/peculio', '/militares/*', '/afastamentos/*']) r.use(caminho, sessao);

  r.get('/postos', async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const { rows } = await dep.banco.query<Posto>('select id, sigla, nome, ordem from posto_grad order by ordem');
    return c.json(rows);
  });

  // os quadros são fixos e não têm nada sigiloso: qualquer pessoa com sessão lê
  // a sigla e o nome de um posto ou graduação: só o administrador. A ordem não muda (a antiguidade nas escalas vem dela, e não da sigla), e não há
  // rota para criar nem apagar posto. A auditoria vem do gatilho da tabela.
  r.patch('/postos/:id', async (c) => {
    const negado = await exigirAdministradorRaiz(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoPosto);
    if (!corpo.ok) return corpo.resposta;
    const id = c.req.param('id');
    const { sigla, nome } = corpo.dados;
    const MSG = 'Já existe um posto com esta sigla.';
    const resultado = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      const antes = (await tx.query<Posto>('select id, sigla, nome, ordem from posto_grad where id::text = $1 for update', [id])).rows[0];
      if (!antes) return { status: 404 as const };
      if ((await tx.query('select 1 from posto_grad where lower(sigla) = lower($1) and id <> $2', [sigla, antes.id])).rows.length) return { status: 409 as const };
      const depois = (await tx.query<Posto>('update posto_grad set sigla = $2, nome = $3 where id = $1 returning id, sigla, nome, ordem', [antes.id, sigla, nome])).rows[0]!;
      return { status: 200 as const, posto: depois };
    });
    if (resultado.status === 404) return c.json({ erro: 'Posto não encontrado.' }, 404);
    if (resultado.status === 409) return c.json({ erro: MSG, campos: { sigla: MSG } }, 409);
    return c.json(resultado.posto);
  });

  r.get('/quadros', async (c) => c.json(await lerQuadros(dep.banco)));

  // as unidades em que a pessoa pode lotar um militar, de qualquer tipo: as que ela pode cadastrar (o administrador, todas). A sigla que se repete
  // (a "1ª SB" de cada grupamento) leva a unidade de cima: "1ª SB (2º GB)"
  r.get('/unidades-de-lotacao', async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const hoje = hojeRecife();
    const { rows } = await dep.banco.query<UnidadeDeLotacao & { cima: string | null }>(
      `select u.id, u.sigla, u.nome, (select m.sigla from unidade m where m.id = u.mae_id) as cima
         from unidade u where (u.ate is null or u.ate >= $1::date) order by u.sigla, u.caminho`,
      [hoje],
    );
    const permitidas: (UnidadeDeLotacao & { cima: string | null })[] = [];
    for (const u of rows) if (await temPapel(dep.banco, c.get('usuarioId'), u.id, CADASTRO, hoje)) permitidas.push(u);
    const repetidas = new Set(permitidas.map((u) => u.sigla.toLowerCase()).filter((sigla, i, todas) => todas.indexOf(sigla) !== i));
    return c.json(permitidas.map(({ cima, ...u }): UnidadeDeLotacao => (repetidas.has(u.sigla.toLowerCase()) && cima ? { ...u, sigla: `${u.sigla} (${cima})` } : u)));
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
         left join situacao_militar sm on sm.id = l.situacao_id
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
    const { rows } = await dep.banco.query<LinhaBanco & { lotacao: string; lotacao_id: string }>(
      `${SELECT_MILITAR}, un.sigla as lotacao, un.id as lotacao_id
         from rastreio l
         join unidade un on un.id = l.unidade_id
         join unidade alvo on alvo.id = $1
         join militar m on m.id = l.militar_id
         join posto_grad p on p.id = m.posto_grad_id
         left join equipe e on e.id = l.equipe_id
         left join situacao_militar sm on sm.id = l.situacao_id
        where alvo.caminho @> un.caminho and l.desde <= $3 and (l.ate is null or l.ate >= $2)
          and l.id = ${PERIODO_DO_DIA('m.id', 'and alvo2.caminho @> ux.caminho')}
        order by p.ordem desc, m.antiguidade asc nulls last, m.nome_guerra`,
      [u, primeiro, ultimo, diaDeReferencia(mes)],
    );
    const repetidas = repetidasPorAntiguidade(rows.filter((m) => m.ativo).map((m) => ({ id: m.id, nomeGuerra: m.nome_guerra, antiguidade: m.antiguidade })));
    const numeroDoMes = Number(mes.slice(5, 7));
    // o nascimento é de quem cuida do Pecúlio do militar (nível de acesso acima da lotação dele, ou o administrador): a lista só traz os aniversários desses
    const hoje = hojeRecife();
    const admin = await ehAdministrador(dep.banco, c.get('usuarioId'), hoje);
    const veDaUnidade = new Map<string, boolean>();
    for (const un of new Set(rows.map((m) => m.lotacao_id))) veDaUnidade.set(un, admin || (await temPapelAcima(dep.banco, c.get('usuarioId'), un, CADASTRO, hoje)));
    const veNascimento = (m: { lotacao_id: string }) => veDaUnidade.get(m.lotacao_id) === true;
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
      // quem não tem o nascimento preenchido não entra; no mesmo dia, a ordem é a da lista (posto, antiguidade, nome). Sem ver o nascimento de nenhum
      // militar da lista, a chave nem existe (a tela esconde a seção, em vez de dizer que ninguém faz aniversário)
      ...(rows.some(veNascimento)
        ? {
            aniversariantes: rows
              .flatMap((m) => (veNascimento(m) && m.nascimento_dia !== null && m.nascimento_mes === numeroDoMes ? [{ militarId: m.id, posto: m.posto, nomeGuerra: m.nome_guerra, dia: m.nascimento_dia, lotacao: m.lotacao }] : []))
              .sort((a, b) => a.dia - b.dia),
          }
        : {}),
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
            `insert into militar (matricula, posto_grad_id, nome_completo, nome_guerra, antiguidade, motorista, cnh, voluntario_jes)
             values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
            [d.matricula, d.postoGradId, d.nomeCompleto, d.nomeGuerra, d.antiguidade, d.motorista, d.cnh, d.voluntarioJes],
          )
        ).rows[0]!.id;
        await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, quadro_id) values ($1, $2, $3, $4, $5, $6)', [
          id, u, d.lotacao.equipeId, d.lotacao.jornada, d.lotacao.desde, quadro.quadroId,
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

  // apagar um militar, com tudo o que é dele: só o administrador, depois de ver o que vai junto e de digitar a matrícula (entrega 6.13)
  const MSG_SO_ADMIN = 'Só o administrador do sistema apaga um militar.';
  const militarDe = async (id: string) =>
    (await dep.banco.query<{ matricula: string }>('select matricula from militar where id::text = $1', [id])).rows[0];
  r.get('/militares/:id/exclusao', async (c) => {
    const negado = await exigirAdministradorRaiz(c, MSG_SO_ADMIN);
    if (negado) return negado;
    const id = c.req.param('id');
    if (!(await militarDe(id))) return c.json({ erro: 'Militar não encontrado.' }, 404);
    return c.json(await dep.banco.transacao((tx) => oQueVaiJunto(tx, id)));
  });

  r.delete('/militares/:id', async (c) => {
    const negado = await exigirAdministradorRaiz(c, MSG_SO_ADMIN);
    if (negado) return negado;
    const id = c.req.param('id');
    const corpo = await lerCorpo(c, ConfirmarExclusao);
    if (!corpo.ok) return corpo.resposta;
    const m = await militarDe(id);
    if (!m) return c.json({ erro: 'Militar não encontrado.' }, 404);
    if (corpo.dados.matricula.trim() !== m.matricula) return c.json({ erro: 'Digite a matrícula para confirmar.', campos: { matricula: 'Digite a matrícula para confirmar.' } }, 400);
    const meu = (await dep.banco.query<{ militar_id: string | null }>('select militar_id from usuario where id = $1', [c.get('usuarioId')])).rows[0]?.militar_id;
    if (meu === id) return c.json({ erro: 'Você não pode apagar o seu próprio cadastro.' }, 409);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => apagarMilitar(tx, id));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.body(null, 204);
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
    // a função é do catálogo: precisa existir e estar ativa (a que o militar já tem pode ser regravada, mesmo desativada)
    if (d.funcaoMilitarId) {
      const f = (await dep.banco.query<{ ativo: boolean; dele: boolean }>(
        'select f.ativo, exists (select 1 from militar m where m.id = $2 and m.funcao_militar_id = f.id) as dele from funcao_militar f where f.id = $1', [d.funcaoMilitarId, id])).rows[0];
      const msg = !f ? 'Escolha uma função da lista.' : !f.ativo && !f.dele ? 'Esta função está desativada.' : null;
      if (msg) return c.json({ erro: msg, campos: { funcaoMilitarId: msg } }, 400);
    }
    try {
      const ficha = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        // o estado atual é lido já dentro da transação, com a linha travada: duas edições ao mesmo tempo, em campos
        // diferentes, não se atropelam (a segunda parte do que a primeira gravou)
        const atual = (await tx.query<Pick<LinhaBanco, 'posto_grad_id' | 'nome_completo' | 'nome_guerra' | 'sexo' | 'nascimento_dia' | 'nascimento_mes' | 'nascimento_ano' | 'cpf' | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'telefone' | 'email' | 'comportamento' | 'comportamento_boletim' | 'antiguidade' | 'motorista' | 'cnh' | 'voluntario_jes' | 'funcao_militar_id' | 'abono_permanencia'>>(
          `select posto_grad_id, nome_completo, nome_guerra, sexo, nascimento_dia, nascimento_mes, nascimento_ano, cpf, cep, logradouro, numero, complemento, bairro, cidade, uf,
                  telefone, email, comportamento, comportamento_boletim, antiguidade, motorista, cnh, voluntario_jes, funcao_militar_id, abono_permanencia from militar where id = $1 for update`,
          [id],
        )).rows[0]!;
        // `undefined` mantém o que está gravado; `null` limpa
        const novo = <T,>(valor: T | undefined, gravado: T): T => (valor === undefined ? gravado : valor);
        const nascimentoDia = d.nascimento === undefined ? atual.nascimento_dia : (d.nascimento?.dia ?? null);
        const nascimentoMes = d.nascimento === undefined ? atual.nascimento_mes : (d.nascimento?.mes ?? null);
        // sem o ano no pedido, o ano gravado continua (se a data ainda existe nele: 29/02 só em ano bissexto); `ano: null` limpa
        const anoMantido = atual.nascimento_ano !== null && !(d.nascimento?.dia === 29 && d.nascimento.mes === 2 && !((atual.nascimento_ano % 4 === 0 && atual.nascimento_ano % 100 !== 0) || atual.nascimento_ano % 400 === 0)) ? atual.nascimento_ano : null;
        const nascimentoAno = d.nascimento === undefined ? atual.nascimento_ano : d.nascimento === null ? null : d.nascimento.ano === undefined ? anoMantido : d.nascimento.ano;
        const endereco = d.endereco ?? {};
        // desmarcar o quadro de motoristas não apaga a CNH: ela só deixa de valer para a escala
        const motorista = d.motorista ?? atual.motorista;
        const cnh = d.cnh ?? atual.cnh;
        const postoGradId = d.postoGradId ?? atual.posto_grad_id;
        await tx.query(
          `update militar set posto_grad_id = $2, nome_guerra = $3, antiguidade = $4, motorista = $5, cnh = $6, voluntario_jes = $7,
                  nome_completo = $8, sexo = $9, nascimento_dia = $10, nascimento_mes = $11, nascimento_ano = $12, telefone = $13, email = $14, comportamento = $15, comportamento_boletim = $16,
                  cpf = $17, cep = $18, logradouro = $19, numero = $20, complemento = $21, bairro = $22, cidade = $23, uf = $24,
                  funcao_militar_id = $25, abono_permanencia = $26
            where id = $1`,
          [
            id,
            postoGradId,
            d.nomeGuerra ?? atual.nome_guerra,
            d.antiguidade === undefined ? atual.antiguidade : d.antiguidade,
            motorista,
            cnh,
            d.voluntarioJes ?? atual.voluntario_jes,
            d.nomeCompleto ?? atual.nome_completo,
            novo(d.sexo, atual.sexo),
            nascimentoDia,
            nascimentoMes,
            nascimentoAno,
            novo(d.telefone, atual.telefone),
            novo(d.email, atual.email),
            novo(d.comportamento, atual.comportamento),
            novo(d.comportamentoBoletim, atual.comportamento_boletim),
            novo(d.cpf, atual.cpf),
            novo(endereco.cep, atual.cep),
            novo(endereco.logradouro, atual.logradouro),
            novo(endereco.numero, atual.numero),
            novo(endereco.complemento, atual.complemento),
            novo(endereco.bairro, atual.bairro),
            novo(endereco.cidade, atual.cidade),
            novo(endereco.uf, atual.uf),
            novo(d.funcaoMilitarId, atual.funcao_militar_id),
            d.abonoPermanencia ?? atual.abono_permanencia,
          ],
        );
        // o quadro vale por período e acompanha o posto: trocar o MAJ do QOA por CEL leva o período aberto ao QOC (um período novo, a partir de hoje)
        if (d.postoGradId !== undefined && d.postoGradId !== atual.posto_grad_id) {
          const aberto = await periodoAberto(tx, id);
          if (aberto) {
            const quadro = await quadroParaOPosto(tx, postoGradId, undefined, aberto.quadro_id);
            if (!('erro' in quadro)) await mudarPeriodoAberto(tx, id, hojeRecife(), { quadroId: quadro.quadroId });
          }
        }
        return carregarFicha(tx, id, mes, c.get('usuarioId'));
      });
      return c.json(ficha);
    } catch (e) {
      // o e-mail é único sem distinção de maiúsculas (índice militar_email_unico): o 409 vai no campo
      const doBanco = e as { code?: string; message?: string; constraint?: string } | null;
      // quem tem acesso ativo entra pelo e-mail da ficha (gatilho militar_email_para_usuario): apagá-lo pede desativar o acesso antes
      if (doBanco?.code === 'P0001' && /email_obrigatorio_com_acesso/.test(doBanco.message ?? '')) {
        return c.json({ erro: MSG_EMAIL_COM_ACESSO, campos: { email: MSG_EMAIL_COM_ACESSO } }, 409);
      }
      if (doBanco?.code === '23505' && /militar_cpf_unico/.test(`${doBanco.constraint ?? ''} ${doBanco.message ?? ''}`) && d.cpf) {
        const dono = (await dep.banco.query<{ nome_guerra: string }>('select nome_guerra from militar where cpf = $1 and id <> $2', [d.cpf, id])).rows[0];
        const msg = `Este CPF já é de ${dono?.nome_guerra ?? 'outro militar'}.`;
        return c.json({ erro: msg, campos: { cpf: msg } }, 409);
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
    // o quadro e a situação são do Pecúlio, como a lotação: só quem tem nível de acesso acima da lotação os muda
    const aberta0 = (await dep.banco.query<{ quadro_id: string | null; situacao_id: string }>('select quadro_id, situacao_id from rastreio where militar_id = $1 and ate is null', [id])).rows[0];
    const mudaQuadro = d.quadroId !== undefined && d.quadroId !== (aberta0?.quadro_id ?? null);
    const mudaSituacao = d.situacaoId !== undefined && d.situacaoId !== aberta0?.situacao_id;
    if (mudaQuadro || mudaSituacao) {
      const naoEDono = await exigirDonoDoPeculioDoMilitar(c, id, FRASE_CAMPO);
      if (naoEDono) return naoEDono;
    }
    if (mudaSituacao) {
      const sit = (await dep.banco.query<{ ativo: boolean }>('select ativo from situacao_militar where id = $1', [d.situacaoId]))?.rows[0];
      if (!sit) return c.json({ erro: MSG_SITUACAO_NAO_ACHADA, campos: { situacaoId: MSG_SITUACAO_NAO_ACHADA } }, 400);
      if (!sit.ativo) return c.json({ erro: MSG_SITUACAO_DESATIVADA, campos: { situacaoId: MSG_SITUACAO_DESATIVADA } }, 400);
    }
    try {
      const resultado = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        // o período aberto é lido dentro da transação, com a linha travada: duas alterações ao mesmo tempo não se atropelam
        const aberta = await periodoAberto(tx, id);
        // outra gravação trocou a unidade do período aberto entre a conferência do papel e agora: confere de novo, com a ficha atualizada
        if (aberta && aberta.unidade_id !== d.unidadeId && aberta.unidade_id !== unidadeAberta) return 'mudou' as const;
        if (aberta && d.desde < aberta.desde) return { antes: aberta.desde };
        // o quadro precisa conter o posto (o posto não tem histórico: vale o de agora)
        let quadroId = aberta?.quadro_id ?? null;
        // sem período aberto (todos fechados), o período novo nasce com o quadro do posto, quando só um serve
        if (d.quadroId !== undefined || !aberta) {
          const posto = (await tx.query<{ posto_grad_id: string }>('select posto_grad_id from militar where id = $1', [id])).rows[0]!.posto_grad_id;
          const q = await quadroParaOPosto(tx, posto, d.quadroId, aberta?.quadro_id ?? null);
          if ('erro' in q) return { quadroErro: q.erro };
          quadroId = q.quadroId;
        }
        const situacaoId = d.situacaoId ?? aberta?.situacao_id ?? null;
        const mes = d.desde.slice(0, 7);
        if (aberta && d.desde === aberta.desde) {
          await tx.query('update rastreio set unidade_id = $2, equipe_id = $3, jornada = $4, quadro_id = $5, situacao_id = coalesce($6, situacao_id) where id = $1', [aberta.id, d.unidadeId, d.equipeId, d.jornada, quadroId, situacaoId]);
          return { ficha: await carregarFicha(tx, id, mes, c.get('usuarioId')), criado: false };
        }
        if (aberta) await tx.query("update rastreio set ate = $2::date - interval '1 day' where id = $1", [aberta.id, d.desde]);
        await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, quadro_id, situacao_id) values ($1, $2, $3, $4, $5, $6, $7)', [
          id, d.unidadeId, d.equipeId, d.jornada, d.desde, quadroId, situacaoId,
        ]);
        return { ficha: await carregarFicha(tx, id, mes, c.get('usuarioId')), criado: true };
      });
      if (resultado === 'mudou') return c.json({ erro: MSG_SITUACAO_MUDOU }, 409);
      if ('antes' in resultado && resultado.antes) return c.json({ erro: MSG_PERIODO_ANTES(resultado.antes), campos: { desde: MSG_PERIODO_ANTES(resultado.antes) } }, 400);
      if ('quadroErro' in resultado) return c.json({ erro: resultado.quadroErro, campos: { quadroId: resultado.quadroErro } }, 400);
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
