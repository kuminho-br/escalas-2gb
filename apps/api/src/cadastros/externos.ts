// O militar externo (6.33): um militar de outra unidade que o gestor traz para a escala desta unidade, para tirar serviço extra (JES, Diária, PJES).
// O vínculo (`vinculo_externo`) vale "até alguém tirar": o fim vazio é o vínculo aberto, e tirar grava o fim. A lotação do militar não muda.
import { NovoExterno, Id, type MilitarExterno } from 'contratos';
import { Hono } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, GESTAO, temPapel, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife, somarDias } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';

const FRASE_DO_GESTOR = 'Trazer e tirar militar externo é do gestor da unidade.';
const FRASE_DA_UNIDADE = 'Este militar já é desta unidade.';
const SEM_LOTACAO = 'Este militar ainda não tem lotação.';

/** Os externos vigentes na unidade no dia (o vínculo cobre o dia), do posto mais alto para o mais baixo, e por antiguidade dentro do posto. */
export async function externosVigentes(c: Consulta, unidadeId: string, dia: string): Promise<MilitarExterno[]> {
  const { rows } = await c.query<MilitarExterno>(
    `select ve.id as "vinculoId", m.id as "militarId", p.sigla as posto, m.nome_guerra as "nomeGuerra", m.matricula,
            un.sigla as "lotacaoSigla", to_char(ve.desde, 'YYYY-MM-DD') as desde
       from vinculo_externo ve
       join militar m on m.id = ve.militar_id
       join posto_grad p on p.id = m.posto_grad_id
       join lateral (select r.unidade_id from rastreio r where r.militar_id = m.id
                      order by (r.desde <= $2::date and (r.ate is null or r.ate >= $2::date)) desc, r.desde desc limit 1) l on true
       join unidade un on un.id = l.unidade_id
      where ve.unidade_id = $1 and ve.desde <= $2::date and (ve.ate is null or ve.ate >= $2::date)
      order by p.ordem desc, m.antiguidade nulls last, m.nome_guerra`,
    [unidadeId, dia],
  );
  return rows;
}

export function rotasExternos(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/externos', '/unidades/:u/externos/*']) r.use(caminho, sessao);

  /** null se quem pede é gestor na unidade que recebe ou acima; senão a resposta (404 da unidade, 403 com a frase fixa). */
  async function soGestor(c: import('hono').Context<AmbienteApi>, unidadeId: string): Promise<Response | null> {
    // a unidade que não existe é 404 e quem não é de cadastro nenhum é 403 (a resposta de sempre); o auxiliar passa por aqui e cai na frase do gestor
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    return (await temPapel(dep.banco, c.get('usuarioId'), unidadeId, GESTAO, hojeRecife())) ? null : c.json({ erro: FRASE_DO_GESTOR }, 403);
  }

  r.get('/unidades/:u/externos', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    return c.json(await externosVigentes(dep.banco, u, hojeRecife()));
  });

  r.post('/unidades/:u/externos', async (c) => {
    const u = c.req.param('u');
    const negado = await soGestor(c, u);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoExterno);
    if (!corpo.ok) return corpo.resposta;
    const { militarId } = corpo.dados;
    const hoje = hojeRecife();
    const militar = (await dep.banco.query<{ id: string }>('select id from militar where id = $1', [militarId])).rows[0];
    if (!militar) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const siglaDaUnidade = (await dep.banco.query<{ sigla: string }>('select sigla from unidade where id = $1', [u])).rows[0]!.sigla;
    // a lotação de hoje (ou a mais recente): quem já é da unidade, ou de uma de baixo dela, não é externo
    const lotacao = (
      await dep.banco.query<{ da_unidade: boolean }>(
        `select un.caminho <@ alvo.caminho as da_unidade
           from rastreio r join unidade un on un.id = r.unidade_id join unidade alvo on alvo.id = $2
          where r.militar_id = $1 order by (r.desde <= $3::date and (r.ate is null or r.ate >= $3::date)) desc, r.desde desc limit 1`,
        [militarId, u, hoje],
      )
    ).rows[0];
    if (!lotacao) return c.json({ erro: SEM_LOTACAO }, 400);
    if (lotacao.da_unidade) return c.json({ erro: FRASE_DA_UNIDADE }, 400);
    const jaEsta = `Já está na escala de ${siglaDaUnidade}.`;
    const aberto = (await dep.banco.query('select 1 from vinculo_externo where militar_id = $1 and unidade_id = $2 and (ate is null or ate >= $3::date)', [militarId, u, hoje])).rows.length > 0;
    if (aberto) return c.json({ erro: jaEsta }, 409);
    try {
      const vinculoId = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) =>
        (await tx.query<{ id: string }>('insert into vinculo_externo (militar_id, unidade_id, desde) values ($1, $2, $3::date) returning id', [militarId, u, hoje])).rows[0]!.id,
      );
      const criado = (await externosVigentes(dep.banco, u, hoje)).find((e) => e.vinculoId === vinculoId)!;
      return c.json(criado, 201);
    } catch (e) {
      // duas pessoas trazendo ao mesmo tempo: a tabela recusa a sobreposição, e a resposta é a mesma do vínculo aberto
      return respostaDoErroDoBanco(c, e, { '23P01': jaEsta });
    }
  });

  r.delete('/unidades/:u/externos/:vinculoId', async (c) => {
    const u = c.req.param('u');
    const negado = await soGestor(c, u);
    if (negado) return negado;
    const vinculoId = c.req.param('vinculoId');
    const hoje = hojeRecife();
    const vinculo = Id.safeParse(vinculoId).success
      ? (await dep.banco.query<{ desde: string }>("select to_char(desde, 'YYYY-MM-DD') as desde from vinculo_externo where id = $1 and unidade_id = $2 and (ate is null or ate >= $3::date)", [vinculoId, u, hoje])).rows[0]
      : undefined;
    if (!vinculo) return c.json({ erro: 'Vínculo não encontrado.' }, 404);
    await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      // sai hoje: o último dia dele foi ontem. Trazido hoje, nenhum dia chegou a valer, e o vínculo some (os lançamentos já feitos ficam, são das alocações)
      if (vinculo.desde >= hoje) await tx.query('delete from vinculo_externo where id = $1', [vinculoId]);
      else await tx.query('update vinculo_externo set ate = $2::date where id = $1', [vinculoId, somarDias(hoje, -1)]);
    });
    return c.body(null, 204);
  });

  return r;
}
