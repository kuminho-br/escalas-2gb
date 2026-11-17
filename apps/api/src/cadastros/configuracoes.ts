// Configurações: catálogos do sistema (tipos de afastamento, atividades) e parâmetros por unidade.
import { EdicaoItemCatalogo, Mes, mesParaData, mesPorExtenso, NovoItemCatalogo, NovoParametro, type ItemCatalogo, type Parametro } from 'contratos';
import { PARAM_CATALOGO, paramConverter, paramDef } from 'dominio';
import { Hono, type Context } from 'hono';
import { ESCREVE_PARAMETRO, exigirAdministradorRaiz, exigirPapel, exigirSessao, papeisVigentes, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';

/** Chaves editáveis; SECAO_PADRAO saiu (o seletor de unidade substitui). */
export const CHAVES_SISTEMA = ['CARGA_MENSAL_HORAS', 'SALDOS_ADM_POR_MILITAR', 'ADM_CUMPRE_CARGA', 'LINHAS_POR_MILITAR'];

const ordenarPorNome = <T extends { nome: string }>(l: T[]) => l.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/** Ler os catálogos: qualquer papel (escalante, gestor, administrador). */
async function exigirAlgumPapel(c: Context<AmbienteApi>): Promise<Response | null> {
  const papeis = await papeisVigentes(c.get('banco'), c.get('usuarioId'), hojeRecife());
  return papeis.length ? null : c.json({ erro: 'Esta tela é dos escalantes e gestores.' }, 403);
}

function rotasCatalogo(r: Hono<AmbienteApi>, caminho: string, tabela: 'tipo_afastamento' | 'atividade') {
  r.get(caminho, async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const { rows } = await c.get('banco').query<ItemCatalogo>(`select id, nome, ativo from ${tabela}`);
    return c.json(ordenarPorNome(rows));
  });

  r.post(caminho, async (c) => {
    const negado = await exigirAdministradorRaiz(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoItemCatalogo);
    if (!corpo.ok) return corpo.resposta;
    try {
      const item = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) =>
        (await tx.query<ItemCatalogo>(`insert into ${tabela} (nome) values ($1) returning id, nome, ativo`, [corpo.dados.nome])).rows[0]!,
      );
      return c.json(item, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.patch(`${caminho}/:id`, async (c) => {
    const negado = await exigirAdministradorRaiz(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, EdicaoItemCatalogo);
    if (!corpo.ok) return corpo.resposta;
    try {
      const item = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) =>
        (
          await tx.query<ItemCatalogo>(
            `update ${tabela} set nome = coalesce($2, nome), ativo = coalesce($3, ativo)
              where id::text = $1 returning id, nome, ativo`,
            [c.req.param('id'), corpo.dados.nome ?? null, corpo.dados.ativo ?? null],
          )
        ).rows[0],
      );
      return item ? c.json(item) : c.json({ erro: 'Item não encontrado.' }, 404);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });
}

type LinhaParam = { chave: string; vigencia: string; valor: unknown; norma_referencia: string | null; sigla: string; nivel: number; propria: boolean };

/** Valor em vigor no mês: a unidade mais próxima com a chave (vigência <= mês), na maior vigência. */
function resolver(linhas: LinhaParam[], mes: string): Parametro[] {
  return PARAM_CATALOGO.filter((d) => CHAVES_SISTEMA.includes(d.chave)).map((def) => {
    const daChave = linhas.filter((l) => l.chave === def.chave);
    const validas = daChave.filter((l) => l.vigencia <= mes).sort((a, b) => b.nivel - a.nivel || (a.vigencia < b.vigencia ? 1 : -1));
    const v = validas[0];
    const historico = [...daChave]
      .sort((a, b) => (a.vigencia === b.vigencia ? a.nivel - b.nivel : a.vigencia < b.vigencia ? -1 : 1))
      .map((l) => ({ vigencia: l.vigencia, valor: l.valor, normaReferencia: l.norma_referencia, unidadeSigla: l.sigla }));
    return {
      chave: def.chave,
      rotulo: def.rotulo ?? def.chave,
      descricao: def.descricao ?? '',
      tipo: def.tipo,
      valor: (v ? v.valor : def.padrao) as Parametro['valor'],
      vigencia: v ? v.vigencia : '',
      normaReferencia: v ? v.norma_referencia : null,
      origem: !v ? 'padrao' : v.propria ? 'propria' : 'herdada',
      unidadeSigla: v ? v.sigla : null,
      historico,
    };
  });
}

export function rotasConfiguracoes(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/sistema/*', exigirSessao(dep.banco, dep.auth));
  r.use('/unidades/:u/parametros', exigirSessao(dep.banco, dep.auth));

  rotasCatalogo(r, '/sistema/tipos-afastamento', 'tipo_afastamento');
  rotasCatalogo(r, '/sistema/atividades', 'atividade');

  r.get('/unidades/:u/parametros', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, ['escalante', 'gestor', 'administrador']);
    if (negado) return negado;
    const mes = c.req.query('mes') ?? hojeRecife().slice(0, 7);
    if (!Mes.safeParse(mes).success) return c.json({ erro: 'Mês inválido: use o formato aaaa-mm.' }, 400);
    const { rows } = await c.get('banco').query<LinhaParam>(
      `select p.chave, to_char(p.vigencia_desde, 'YYYY-MM') as vigencia, p.valor, p.norma_referencia,
              a.sigla, nlevel(a.caminho) as nivel, a.id = $1 as propria
         from parametro p
         join unidade a on a.id = p.unidade_id
         join unidade u on u.id = $1
        where a.caminho @> u.caminho`,
      [u],
    );
    return c.json(resolver(rows, mes));
  });

  r.post('/unidades/:u/parametros', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, ESCREVE_PARAMETRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoParametro);
    if (!corpo.ok) return corpo.resposta;
    const { chave, valor, vigencia, normaReferencia } = corpo.dados;
    const def = CHAVES_SISTEMA.includes(chave) ? paramDef(chave) : null;
    if (!def) return c.json({ erro: 'Esta configuração não existe.', campos: { chave: 'Esta configuração não existe.' } }, 400);
    const conv = paramConverter(def, valor);
    if (!conv.ok) return c.json({ erro: conv.erro, campos: { valor: conv.erro } }, 400);
    const atual = hojeRecife().slice(0, 7);
    if (vigencia < atual) return c.json({ erro: `Só dá para mudar a partir de ${mesPorExtenso(atual)}.` }, 409);

    await comUsuario(dep.banco, c.get('usuarioId'), (tx) =>
      tx.query(
        `insert into parametro (chave, unidade_id, vigencia_desde, valor, norma_referencia)
         values ($1, $2, $3, $4::jsonb, $5)
         on conflict (chave, unidade_id, vigencia_desde)
         do update set valor = excluded.valor, norma_referencia = excluded.norma_referencia`,
        [def.chave, u, mesParaData(vigencia), JSON.stringify(conv.valor), normaReferencia || null],
      ),
    );
    return c.json({ chave: def.chave, vigencia }, 201);
  });

  return r;
}
