// A árvore de unidades (entrega 6.25): genérica e editável. Toda unidade se comporta igual, qualquer que seja o tipo (o tipo é só um nome).
// Quem edita: o administrador, tudo; o gestor (e o quinto nível, que edita como gestor) cria unidades abaixo da sua e das de baixo, renomeia a sua e
// as de baixo, e move, extingue e exclui só as de baixo, nunca a própria. Mover muda na hora quem alcança a unidade, porque o acesso é conferido
// pelo caminho da unidade a cada pedido. Toda mudança passa por `comUsuario`: a auditoria registra quem fez.
import {
  AlteracaoDeUnidade, ExtinguirUnidade, NovaUnidade,
  type EfeitoDeMover, type HerancaDaUnidade, type LigadosAUnidade, type NoDaArvore, type PessoaNoEfeito,
} from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, GESTAO, papeisVigentes, temPapel, temPapelAcima, type AmbienteApi, type Papel } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife, inicioDoMes } from '../datas.ts';
import { lerCorpo } from '../erros.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDEM = new Intl.Collator('pt-BR', { numeric: true });
const vigente = (p: string) => `pu.desde <= ${p}::date and (pu.ate is null or pu.ate >= ${p}::date)`;
const VIGENTE = vigente('$2');

const MSG_SEM_ACIMA = 'Você não tem nível de acesso de gestor acima desta unidade.';
const MSG_SEM_DESTINO = 'Você não tem nível de acesso de gestor no destino.';
const MSG_CICLO = 'Uma unidade não pode ficar abaixo de si mesma.';
const MSG_RAIZ_NAO_MUDA = 'A unidade raiz não muda de lugar.';
const MSG_RAIZ_NAO_EXTINGUE = 'A unidade raiz não é extinta.';
const MSG_RAIZ_NAO_EXCLUI = 'A unidade raiz não é excluída.';
const MSG_EXTINTA = 'Esta unidade foi extinta: escolha uma em vigor.';
const MSG_TIPO = 'Escolha o tipo.';
const MSG_NAO_ENCONTRADA = 'Unidade não encontrada.';
const MSG_FIM_ANTES = 'A unidade não pode terminar antes de começar.';
const msgSiglaRepetida = (sigla: string, cima: string) => `Já existe ${sigla} abaixo de ${cima}.`;
const msgComHistorico = (itens: string[]) => `Esta unidade tem histórico (${itens.join(', ')}). Extinga em vez de excluir.`;

type UnidadeBasica = { id: string; sigla: string; mae_id: string | null; desde: string; ate: string | null; extinta: boolean };

/** O que está ligado a cada unidade, em palavras: o texto no singular e no plural, por tabela do banco que aponta para `unidade`. */
const ROTULOS: Record<string, [string, string]> = {
  rastreio: ['militar que já foi lotado', 'militares que já foram lotados'],
  papel_usuario: ['nível de acesso', 'níveis de acesso'],
  parametro: ['parâmetro', 'parâmetros'],
  feriado: ['feriado', 'feriados'],
  funcao: ['função', 'funções'],
  servico: ['serviço', 'serviços'],
  guarnicao: ['guarnição', 'guarnições'],
  escala: ['escala', 'escalas'],
  cota: ['cota', 'cotas'],
  equipe: ['equipe', 'equipes'],
  documento_gerado: ['documento gerado', 'documentos gerados'],
  modelo_impressao: ['modelo de impressão', 'modelos de impressão'],
  meta_dia: ['meta do dia', 'metas do dia'],
  meta_padrao_versao: ['versão da meta padrão', 'versões da meta padrão'],
  oficiais_mes: ['mês da escala dos oficiais', 'meses da escala dos oficiais'],
  oficiais_saldo: ['saldo da escala dos oficiais', 'saldos da escala dos oficiais'],
  vinculo_externo: ['vínculo externo', 'vínculos externos'],
};
const rotulo = (tabela: string, n: number) => {
  const [um, varios] = ROTULOS[tabela] ?? [`registro em ${tabela}`, `registros em ${tabela}`];
  return `${n} ${n === 1 ? um : varios}`;
};

// uma entrada por schema (o real e o espelho do Laboratório): a leitura do catálogo é do caminho da sessão, e cada schema tem as suas tabelas
const tabelasLigadas = new Map<string, Promise<{ tabela: string; coluna: string }[]>>();
/** Toda tabela que aponta para `unidade` (menos a própria árvore), lida do catálogo do banco: uma tabela nova entra na conta sem mudar o código. */
async function tabelasQueApontamParaUnidade(c: Consulta) {
  const schema = (await c.query<{ s: string }>('select current_schema() as s')).rows[0]!.s;
  let lidas = tabelasLigadas.get(schema);
  if (!lidas) {
    lidas = c
      .query<{ tabela: string; coluna: string }>(
        `select c.conrelid::regclass::text as tabela, a.attname as coluna
           from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
          where c.contype = 'f' and c.confrelid = 'unidade'::regclass and c.conrelid <> 'unidade'::regclass
          order by 1`,
      )
      .then((r) => r.rows)
      .catch((e) => { tabelasLigadas.delete(schema); throw e; });
    tabelasLigadas.set(schema, lidas);
  }
  return lidas;
}

/** O histórico de cada unidade (em palavras): tudo o que um dia foi ligado a ela, mesmo o que já passou. As filhas, ainda que extintas, contam. */
async function historicoDas(c: Consulta, ids: string[]): Promise<Map<string, string[]>> {
  const itens = new Map<string, string[]>(ids.map((id) => [id, []]));
  const filhas = await c.query<{ mae_id: string; n: number }>('select mae_id, count(*)::int as n from unidade where mae_id = any($1::uuid[]) group by mae_id', [ids]);
  for (const f of filhas.rows) itens.get(f.mae_id)!.push(`${f.n} ${f.n === 1 ? 'unidade abaixo' : 'unidades abaixo'}`);
  for (const { tabela, coluna } of await tabelasQueApontamParaUnidade(c)) {
    const conta = tabela === 'rastreio' ? 'count(distinct militar_id)' : 'count(*)';
    const { rows } = await c.query<{ unidade: string; n: number }>(`select ${coluna} as unidade, ${conta}::int as n from ${tabela} where ${coluna} = any($1::uuid[]) group by ${coluna}`, [ids]);
    for (const r of rows) itens.get(r.unidade)!.push(rotulo(tabela, r.n));
  }
  return itens;
}

type Linha = {
  id: string; sigla: string; nome: string; mae_id: string | null; desde: string; ate: string | null;
  codigo: string; tipo_nome: string; ordem: number; pode_editar: boolean; pode_reorganizar: boolean; abaixo: number; lotados: number; lotados_na_arvore: number;
};

/**
 * A árvore a partir de uma unidade: as unidades em vigor (a que já foi extinta não vem), as filhas na ordem das siglas, e em cada nó o que a
 * pessoa pode fazer e o que está ligado a ele.
 */
export async function arvoreDaUnidade(c: Consulta, raizId: string, usuarioId: string, hoje: string): Promise<NoDaArvore | null> {
  const gestao = `exists (select 1 from papel_usuario pu join unidade a on a.id = pu.unidade_id
                           where pu.usuario_id = $3 and ${VIGENTE} and pu.papel = any($4) and a.caminho @> u.caminho`;
  const { rows } = await c.query<Linha>(
    `select u.id, u.sigla, u.nome, u.mae_id, to_char(u.desde, 'YYYY-MM-DD') as desde, to_char(u.ate, 'YYYY-MM-DD') as ate,
            t.codigo, t.nome as tipo_nome, t.ordem,
            ${gestao}) as pode_editar,
            ${gestao} and a.id <> u.id) and u.mae_id is not null as pode_reorganizar,
            (select count(*)::int from unidade d where d.caminho <@ u.caminho and d.id <> u.id and (d.ate is null or d.ate >= $2::date)) as abaixo,
            (select count(distinct r.militar_id)::int from rastreio r where r.unidade_id = u.id and r.desde <= $2::date and (r.ate is null or r.ate >= $2::date)) as lotados,
            (select count(distinct r.militar_id)::int from rastreio r join unidade d on d.id = r.unidade_id where d.caminho <@ u.caminho and r.desde <= $2::date and (r.ate is null or r.ate >= $2::date)) as lotados_na_arvore
       from unidade r join unidade u on u.caminho <@ r.caminho join tipo_unidade t on t.codigo = u.tipo
      where r.id = $1 and (u.id = r.id or u.ate is null or u.ate >= $2::date)`,
    [raizId, hoje, usuarioId, GESTAO],
  );
  const historico = await historicoDas(c, rows.map((l) => l.id));
  const no = (l: Linha): NoDaArvore => ({
    id: l.id, sigla: l.sigla, nome: l.nome, tipo: { codigo: l.codigo, nome: l.tipo_nome, ordem: l.ordem }, desde: l.desde, ate: l.ate,
    filhas: rows.filter((f) => f.mae_id === l.id).sort((a, b) => ORDEM.compare(a.sigla, b.sigla)).map(no),
    podeEditar: l.pode_editar, podeReorganizar: l.pode_reorganizar,
    ligados: { unidades: l.abaixo, militaresHoje: l.lotados, militaresNaArvore: l.lotados_na_arvore, historico: historico.get(l.id) ?? [] } satisfies LigadosAUnidade,
  });
  const raiz = rows.find((l) => l.id === raizId);
  return raiz ? no(raiz) : null;
}

async function unidadePorId(c: Consulta, id: string, hoje: string): Promise<UnidadeBasica | undefined> {
  if (!UUID.test(id)) return undefined;
  return (await c.query<UnidadeBasica>(
    `select id, sigla, mae_id, to_char(desde, 'YYYY-MM-DD') as desde, to_char(ate, 'YYYY-MM-DD') as ate, (ate is not null and ate < $2::date) as extinta from unidade where id = $1`,
    [id, hoje],
  )).rows[0];
}

/** Outra unidade em vigor, com a mesma sigla (sem diferenciar maiúsculas), debaixo da mesma unidade de cima? Devolve o aviso, ou null. */
async function avisoDeSiglaRepetida(c: Consulta, maeId: string, sigla: string, menosId: string | null, hoje: string): Promise<string | null> {
  const { rows } = await c.query<{ sigla: string; cima: string }>(
    `select u.sigla, m.sigla as cima from unidade u join unidade m on m.id = u.mae_id
      where u.mae_id = $1 and lower(u.sigla) = lower($2) and u.id::text is distinct from $3 and (u.ate is null or u.ate >= $4::date) limit 1`,
    [maeId, sigla, menosId, hoje],
  );
  return rows[0] ? msgSiglaRepetida(rows[0].sigla, rows[0].cima) : null;
}

const tipoExiste = async (c: Consulta, codigo: string) => (await c.query('select 1 from tipo_unidade where codigo = $1', [codigo])).rows.length > 0;

/**
 * O "mover" pede nível de gestão ACIMA da unidade e no destino, e o destino não pode ser ela nem uma de baixo. Devolve a resposta de erro, ou o destino.
 */
async function conferirMovimento(c: Context<AmbienteApi>, un: UnidadeBasica, destinoId: string, hoje: string): Promise<Response | UnidadeBasica> {
  const banco = c.get('banco');
  const uid = c.get('usuarioId');
  if (un.mae_id === null) return c.json({ erro: MSG_RAIZ_NAO_MUDA }, 400);
  if (!(await temPapelAcima(banco, uid, un.id, GESTAO, hoje))) return c.json({ erro: MSG_SEM_ACIMA }, 403);
  const destino = await unidadePorId(banco, destinoId, hoje);
  if (!destino) return c.json({ erro: MSG_NAO_ENCONTRADA }, 404);
  const ciclo = (await banco.query<{ ok: boolean }>('select d.caminho <@ u.caminho as ok from unidade u, unidade d where u.id = $1 and d.id = $2', [un.id, destino.id])).rows[0]!.ok;
  if (ciclo) return c.json({ erro: MSG_CICLO, campos: { maeId: MSG_CICLO } }, 400);
  if (destino.extinta) return c.json({ erro: MSG_EXTINTA, campos: { maeId: MSG_EXTINTA } }, 400);
  if (!(await temPapel(banco, uid, destino.id, GESTAO, hoje))) return c.json({ erro: MSG_SEM_DESTINO }, 403);
  return destino;
}

type Entrada = { usuario: string; nome: string; papel: Papel; sigla: string; nivel: number };
const PRECEDENCIA: Papel[] = ['administrador', 'gestor', 'gestor_lateral', 'escalante'];

/** Quem tem nível de acesso (vigente hoje) nas unidades da lista, uma entrada por pessoa (o nível mais alto, e o mais perto da raiz). */
async function pessoasCom(c: Consulta, hoje: string, filtro: string, params: unknown[], papeis: Papel[]): Promise<Map<string, Entrada>> {
  const { rows } = await c.query<{ usuario: string; nome: string; papel: Papel; sigla: string; nivel: number }>(
    `select pu.usuario_id::text as usuario, us.nome, pu.papel, a.sigla, nlevel(a.caminho) as nivel
       from papel_usuario pu join usuario us on us.id = pu.usuario_id join unidade a on a.id = pu.unidade_id
      where ${vigente('$1')} and pu.papel = any($2) and (${filtro})`,
    [hoje, papeis, ...params],
  );
  const porPessoa = new Map<string, Entrada>();
  for (const r of rows.sort((a, b) => PRECEDENCIA.indexOf(a.papel) - PRECEDENCIA.indexOf(b.papel) || a.nivel - b.nivel || ORDEM.compare(a.sigla, b.sigla))) {
    if (!porPessoa.has(r.usuario)) porPessoa.set(r.usuario, r);
  }
  return porPessoa;
}
const paraPessoa = (e: Entrada): PessoaNoEfeito => ({ nome: e.nome, papel: e.papel, unidadeSigla: e.sigla });
const aMais = (a: Map<string, Entrada>, b: Map<string, Entrada>) => [...a].filter(([k]) => !b.has(k)).map(([, e]) => e);
const porNome = (a: Entrada, b: Entrada) => ORDEM.compare(a.nome, b.nome);

async function herancaDe(c: Consulta, filtro: string, params: unknown[]): Promise<Map<string, HerancaDaUnidade & { nivel: number }>> {
  const { rows } = await c.query<{ id: string; sigla: string; nivel: number; parametros: number; feriados: number; funcoes: number }>(
    `select a.id, a.sigla, nlevel(a.caminho) as nivel,
            (select count(*)::int from parametro x where x.unidade_id = a.id) as parametros,
            (select count(*)::int from feriado x where x.unidade_id = a.id) as feriados,
            (select count(*)::int from funcao x where x.unidade_id = a.id) as funcoes
       from unidade a where ${filtro}`,
    params,
  );
  return new Map(rows.map((r) => [r.id, { unidadeSigla: r.sigla, parametros: r.parametros, feriados: r.feriados, funcoes: r.funcoes, nivel: Number(r.nivel) }]));
}

/** O que muda quando a unidade troca de unidade de cima (o aviso da tela, antes de salvar). */
async function efeitoDeMover(c: Consulta, un: UnidadeBasica, destino: UnidadeBasica, hoje: string): Promise<EfeitoDeMover> {
  // quem alcança: nível de acesso numa unidade acima dela (hoje) ou, depois, na nova unidade de cima ou acima dela
  const acimaDelaHoje = 'a.caminho @> (select caminho from unidade where id = $3) and a.id <> $3::uuid';
  const acimaDepois = 'a.caminho @> (select caminho from unidade where id = $3)';
  const alcancavamAntes = await pessoasCom(c, hoje, acimaDelaHoje, [un.id], CADASTRO);
  const alcancamDepois = await pessoasCom(c, hoje, acimaDepois, [destino.id], CADASTRO);
  // o quinto nível vê as irmãs (mesma unidade de cima) e o que está abaixo delas, sem editar
  const irmas = 'a.mae_id = $3::uuid and a.id <> $4::uuid';
  const lateraisAntes = await pessoasCom(c, hoje, irmas, [un.mae_id, un.id], ['gestor_lateral']);
  const lateraisDepois = await pessoasCom(c, hoje, irmas, [destino.id, un.id], ['gestor_lateral']);
  const passamAVer = [...lateraisDepois.values()].filter((e) => !alcancavamAntes.has(e.usuario) && !lateraisAntes.has(e.usuario) && !alcancamDepois.has(e.usuario));
  const deixamDeVer = [...lateraisAntes.values()].filter((e) => !alcancamDepois.has(e.usuario) && !lateraisDepois.has(e.usuario));

  const herdavaAntes = await herancaDe(c, 'a.caminho @> (select caminho from unidade where id = $1) and a.id <> $1::uuid', [un.id]);
  const herdaDepois = await herancaDe(c, 'a.caminho @> (select caminho from unidade where id = $1)', [destino.id]);
  const soEm = (a: Map<string, HerancaDaUnidade & { nivel: number }>, b: Map<string, unknown>) =>
    [...a].filter(([id, h]) => !b.has(id) && h.parametros + h.feriados + h.funcoes > 0).map(([, h]) => h).sort((x, y) => x.nivel - y.nivel)
      .map(({ unidadeSigla, parametros, feriados, funcoes }): HerancaDaUnidade => ({ unidadeSigla, parametros, feriados, funcoes }));

  const novas = await c.query<{ sigla: string }>(
    'select sigla from unidade where mae_id = $1 and id <> $2 and (ate is null or ate >= $3::date)', [destino.id, un.id, hoje]);
  return {
    passamAAlcancar: aMais(alcancamDepois, alcancavamAntes).sort(porNome).map(paraPessoa),
    deixamDeAlcancar: aMais(alcancavamAntes, alcancamDepois).sort(porNome).map(paraPessoa),
    passamAVer: passamAVer.sort(porNome).map(paraPessoa),
    deixamDeVer: deixamDeVer.sort(porNome).map(paraPessoa),
    deixaDeHerdar: soEm(herdavaAntes, herdaDepois),
    passaAHerdar: soEm(herdaDepois, herdavaAntes),
    irmasNovas: novas.rows.map((r) => r.sigla).sort(ORDEM.compare),
  };
}

export function rotasEstrutura(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/estrutura', '/unidades', '/unidades/:id', '/unidades/:id/extinguir', '/unidades/:id/efeito-de-mover']) r.use(caminho, sessao);

  // a árvore a partir de `raiz`; sem ela, a unidade mais alta em que a pessoa tem nível de acesso (a raiz, para o administrador)
  r.get('/estrutura', async (c) => {
    const banco = c.get('banco');
    const hoje = hojeRecife();
    let raiz = c.req.query('raiz');
    if (raiz) {
      const negado = await exigirPapel(c, raiz, CADASTRO);
      if (negado) return negado;
    } else {
      raiz = (await banco.query<{ id: string }>(
        `select a.id from papel_usuario pu join unidade a on a.id = pu.unidade_id
          where pu.usuario_id = $1 and ${VIGENTE} and pu.papel = any($3)
          order by nlevel(a.caminho), a.caminho limit 1`,
        [c.get('usuarioId'), hoje, CADASTRO],
      )).rows[0]?.id;
      if (!raiz) return c.json({ erro: 'Esta tela é dos auxiliares administrativos e gestores.' }, 403);
    }
    return c.json((await arvoreDaUnidade(banco, raiz, c.get('usuarioId'), hoje))!);
  });

  r.post('/unidades', async (c) => {
    const banco = c.get('banco');
    // a unidade de cima vem no corpo, então o nível exato só se confere depois dele; antes, quem não tem nível de gestão em lugar nenhum não fica sabendo do formato
    if (!(await papeisVigentes(banco, c.get('usuarioId'), hojeRecife())).some((p) => GESTAO.includes(p.papel))) return c.json({ erro: MSG_SEM_ACIMA }, 403);
    const corpo = await lerCorpo(c, NovaUnidade);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const hoje = hojeRecife();
    const negado = await exigirPapel(c, d.maeId, GESTAO);
    if (negado) return negado;
    const mae = (await unidadePorId(banco, d.maeId, hoje))!;
    if (mae.extinta) return c.json({ erro: MSG_EXTINTA, campos: { maeId: MSG_EXTINTA } }, 400);
    if (!(await tipoExiste(banco, d.tipo))) return c.json({ erro: MSG_TIPO, campos: { tipo: MSG_TIPO } }, 400);
    const id = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
      // a trava na unidade de cima põe em fila dois pedidos com a mesma sigla
      await tx.query('select 1 from unidade where id = $1 for update', [d.maeId]);
      const aviso = await avisoDeSiglaRepetida(tx, d.maeId, d.sigla, null, hoje);
      if (aviso) return aviso;
      return (await tx.query<{ id: string }>('insert into unidade (tipo, sigla, nome, mae_id, desde) values ($1, $2, $3, $4, $5) returning id', [d.tipo, d.sigla, d.nome, d.maeId, inicioDoMes(d.desde)])).rows[0]!.id;
    });
    if (!UUID.test(id)) return c.json({ erro: id, campos: { sigla: id } }, 409);
    return c.json((await arvoreDaUnidade(banco, id, c.get('usuarioId'), hoje))!, 201);
  });

  r.patch('/unidades/:id', async (c) => {
    const banco = c.get('banco');
    const hoje = hojeRecife();
    const un = await unidadePorId(banco, c.req.param('id'), hoje);
    if (!un) return c.json({ erro: MSG_NAO_ENCONTRADA }, 404);
    // quem não tem nível de gestão na unidade (nem acima dela) não passa, qualquer que seja o corpo: renomear e mover pedem isso, no mínimo
    if (!(await temPapel(banco, c.get('usuarioId'), un.id, GESTAO, hoje))) return c.json({ erro: MSG_SEM_ACIMA }, 403);
    if (un.extinta) return c.json({ erro: 'Esta unidade foi extinta.' }, 409);
    const corpo = await lerCorpo(c, AlteracaoDeUnidade);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const muda = d.maeId !== undefined && d.maeId !== un.mae_id;
    let maeId = un.mae_id;
    if (muda) {
      const destino = await conferirMovimento(c, un, d.maeId!, hoje);
      if (destino instanceof Response) return destino;
      maeId = destino.id;
    }
    if (d.tipo !== undefined && !(await tipoExiste(banco, d.tipo))) return c.json({ erro: MSG_TIPO, campos: { tipo: MSG_TIPO } }, 400);
    const aviso = await comUsuario(banco, c.get('usuarioId'), async (tx) => {
      // a unidade é lida de novo, já travada: renomear não desfaz um "mover" que outra pessoa fez entre a leitura de cima e esta gravação
      const atual = (await tx.query<{ mae_id: string | null; sigla: string }>('select mae_id, sigla from unidade where id = $1 for update', [un.id])).rows[0]!;
      const maeEfetiva = muda ? maeId : atual.mae_id;
      if (maeEfetiva) {
        await tx.query('select 1 from unidade where id = $1 for update', [maeEfetiva]);
        const repetida = (muda || d.sigla !== undefined) && (await avisoDeSiglaRepetida(tx, maeEfetiva, d.sigla ?? atual.sigla, un.id, hoje));
        if (repetida) return repetida;
      }
      // só o que o pedido manda é gravado: o lugar (`mae_id`) só muda quando o pedido é de mover
      await tx.query(
        `update unidade set sigla = coalesce($2, sigla), nome = coalesce($3, nome), tipo = coalesce($4, tipo), mae_id = case when $6::boolean then $5::uuid else mae_id end
          where id = $1 and (sigla, nome, tipo, mae_id) is distinct from (coalesce($2, sigla), coalesce($3, nome), coalesce($4, tipo), case when $6::boolean then $5::uuid else mae_id end)`,
        [un.id, d.sigla ?? null, d.nome ?? null, d.tipo ?? null, maeId, muda],
      );
      return null;
    });
    if (aviso) return c.json({ erro: aviso, campos: { sigla: aviso } }, 409);
    return c.json((await arvoreDaUnidade(banco, un.id, c.get('usuarioId'), hoje))!);
  });

  // o aviso antes de mover: o que muda para quem alcança a unidade, o que ela herda e quem passa a ser irmã dela
  r.get('/unidades/:id/efeito-de-mover', async (c) => {
    const hoje = hojeRecife();
    const un = await unidadePorId(c.get('banco'), c.req.param('id'), hoje);
    if (!un) return c.json({ erro: MSG_NAO_ENCONTRADA }, 404);
    const destino = await conferirMovimento(c, un, c.req.query('maeId') ?? '', hoje);
    if (destino instanceof Response) return destino;
    return c.json(await efeitoDeMover(c.get('banco'), un, destino, hoje));
  });

  r.post('/unidades/:id/extinguir', async (c) => {
    const banco = c.get('banco');
    const hoje = hojeRecife();
    const un = await unidadePorId(banco, c.req.param('id'), hoje);
    if (!un) return c.json({ erro: MSG_NAO_ENCONTRADA }, 404);
    if (!(await temPapel(banco, c.get('usuarioId'), un.id, GESTAO, hoje))) return c.json({ erro: MSG_SEM_ACIMA }, 403);
    const corpo = await lerCorpo(c, ExtinguirUnidade);
    if (!corpo.ok) return corpo.resposta;
    const { ate } = corpo.dados;
    if (un.mae_id === null) return c.json({ erro: MSG_RAIZ_NAO_EXTINGUE }, 400);
    if (!(await temPapelAcima(banco, c.get('usuarioId'), un.id, GESTAO, hoje))) return c.json({ erro: MSG_SEM_ACIMA }, 403);
    if (ate < un.desde) return c.json({ erro: MSG_FIM_ANTES, campos: { ate: MSG_FIM_ANTES } }, 400);
    const { rows } = await banco.query<{ unidades: number; militares: number }>(
      `select (select count(*)::int from unidade d where d.caminho <@ u.caminho and d.id <> u.id and (d.ate is null or d.ate > $2::date)) as unidades,
              (select count(distinct r.militar_id)::int from rastreio r where r.unidade_id = u.id and (r.ate is null or r.ate > $2::date)) as militares
         from unidade u where u.id = $1`,
      [un.id, ate],
    );
    const { unidades, militares } = rows[0]!;
    if (unidades || militares) {
      const erro = `Antes de extinguir, mova ${unidades} unidades e ${militares} militares lotados.`;
      return c.json({ erro, unidades, militares }, 409);
    }
    await comUsuario(banco, c.get('usuarioId'), (tx) => tx.query('update unidade set ate = $2 where id = $1', [un.id, ate]));
    return c.json({ id: un.id, ate });
  });

  r.delete('/unidades/:id', async (c) => {
    const banco = c.get('banco');
    const hoje = hojeRecife();
    const un = await unidadePorId(banco, c.req.param('id'), hoje);
    if (!un) return c.json({ erro: MSG_NAO_ENCONTRADA }, 404);
    if (un.mae_id === null) return c.json({ erro: MSG_RAIZ_NAO_EXCLUI }, 400);
    if (!(await temPapelAcima(banco, c.get('usuarioId'), un.id, GESTAO, hoje))) return c.json({ erro: MSG_SEM_ACIMA }, 403);
    const historico = (await historicoDas(banco, [un.id])).get(un.id)!;
    if (historico.length) return c.json({ erro: msgComHistorico(historico), historico }, 409);
    await comUsuario(banco, c.get('usuarioId'), (tx) => tx.query('delete from unidade where id = $1', [un.id]));
    return c.body(null, 204);
  });

  return r;
}
