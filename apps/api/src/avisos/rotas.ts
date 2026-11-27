// O quadro de avisos (6.56): GET /api/avisos (os visíveis à conta), POST (publicar), PATCH /:id (editar e fixar) e POST /:id/retirar. As gravações levam a conta à auditoria (`comUsuario`).
import { MudarAviso, NovoAviso, type Aviso, type QuadroDeAvisos } from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirSessao, temPapel, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo } from '../erros.ts';
import { avisosVisiveis, podePublicarEmAlgumaUnidade, umAviso } from './avisos.ts';

const SEM_NIVEL = 'Você não tem nível de acesso nesta unidade.';
const NAO_ACHADO = 'Aviso não encontrado.';
const DATA_PASSADA = { erro: 'Confira os campos destacados.', campos: { valeAte: 'A data já passou.' } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `agora`: o relógio (os testes o trocam). */
export function rotasAvisos(dep: { banco: Banco; auth: Auth; agora?: () => Date }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/avisos', exigirSessao(dep.banco, dep.auth));
  r.use('/avisos/*', exigirSessao(dep.banco, dep.auth));
  const hoje = () => hojeRecife(dep.agora?.());

  r.get('/avisos', async (c) => {
    const usuarioId = c.get('usuarioId');
    const quadro: QuadroDeAvisos = { avisos: await avisosVisiveis(dep.banco, usuarioId, hoje()), podePublicar: await podePublicarEmAlgumaUnidade(dep.banco, usuarioId, hoje()) };
    return c.json(quadro);
  });

  r.post('/avisos', async (c) => {
    const corpo = await lerCorpo(c, NovoAviso);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const usuarioId = c.get('usuarioId');
    const dia = hoje();
    const unidade = (await dep.banco.query<{ extinta: boolean }>('select (ate is not null and ate < $2::date) as extinta from unidade where id = $1', [d.unidadeId, dia])).rows[0];
    if (!unidade) return c.json({ erro: 'Unidade não encontrada.' }, 404);
    if (unidade.extinta) return c.json({ erro: 'Esta unidade não existe mais.' }, 400);
    if (!(await temPapel(dep.banco, usuarioId, d.unidadeId, CADASTRO, dia))) return c.json({ erro: SEM_NIVEL }, 403);
    if (d.valeAte && d.valeAte < dia) return c.json(DATA_PASSADA, 400);
    const id = await comUsuario(dep.banco, usuarioId, async (tx) =>
      (await tx.query<{ id: string }>('insert into aviso (unidade_id, autor_id, titulo, texto, fixado, vale_ate) values ($1, $2, $3, $4, $5, $6::date) returning id', [d.unidadeId, usuarioId, d.titulo, d.texto, d.fixado, d.valeAte ?? null])).rows[0]!.id,
    );
    return c.json(await umAviso(dep.banco, usuarioId, dia, id), 201);
  });

  /** O aviso e a permissão de alterá-lo: 404 se não existe ou foi retirado, 403 se a conta não é a autora nem tem nível de acesso na unidade (ou acima). */
  async function doAviso(c: Context<AmbienteApi>, id: string): Promise<{ resposta: Response } | { aviso: Aviso }> {
    if (!UUID.test(id)) return { resposta: c.json({ erro: NAO_ACHADO }, 404) };
    const aviso = await umAviso(dep.banco, c.get('usuarioId'), hoje(), id);
    if (!aviso) return { resposta: c.json({ erro: NAO_ACHADO }, 404) };
    if (!aviso.podeAlterar) return { resposta: c.json({ erro: SEM_NIVEL }, 403) };
    return { aviso };
  }

  r.patch('/avisos/:id', async (c) => {
    const acesso = await doAviso(c, c.req.param('id'));
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, MudarAviso);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    if (d.valeAte && d.valeAte < hoje()) return c.json(DATA_PASSADA, 400);
    const usuarioId = c.get('usuarioId');
    const atual = acesso.aviso;
    // editar sem mudar nada (corpo vazio, ou os mesmos valores) não grava: a auditoria só recebe mudança de verdade
    const muda = (d.titulo !== undefined && d.titulo !== atual.titulo) || (d.texto !== undefined && d.texto !== atual.texto) || (d.fixado !== undefined && d.fixado !== atual.fixado) || (d.valeAte !== undefined && d.valeAte !== atual.valeAte);
    if (!muda) return c.json(atual);
    // `retirado_em is null`: se a retirada chegou entre a leitura e a gravação, o aviso retirado não é alterado
    const gravou = await comUsuario(dep.banco, usuarioId, (tx) =>
      tx.query(
        `update aviso set titulo = coalesce($2::text, titulo), texto = coalesce($3::text, texto), fixado = coalesce($4::boolean, fixado),
                vale_ate = case when $5::boolean then $6::date else vale_ate end where id = $1 and retirado_em is null returning id`,
        [atual.id, d.titulo ?? null, d.texto ?? null, d.fixado ?? null, d.valeAte !== undefined, d.valeAte ?? null],
      ),
    );
    if (!gravou.rows.length) return c.json({ erro: NAO_ACHADO }, 404);
    return c.json(await umAviso(dep.banco, usuarioId, hoje(), atual.id));
  });

  r.post('/avisos/:id/retirar', async (c) => {
    const acesso = await doAviso(c, c.req.param('id'));
    if ('resposta' in acesso) return acesso.resposta;
    const usuarioId = c.get('usuarioId');
    const retirou = await comUsuario(dep.banco, usuarioId, (tx) => tx.query('update aviso set retirado_em = now(), retirado_por = $2 where id = $1 and retirado_em is null returning id', [acesso.aviso.id, usuarioId]));
    // duas retiradas ao mesmo tempo: a que chegou depois acha o aviso já retirado
    if (!retirou.rows.length) return c.json({ erro: NAO_ACHADO }, 404);
    return c.body(null, 204);
  });

  return r;
}
