// O catálogo "Situações do militar" (Ativa, Reserva, Agregado, Adido…): cada uma diz se quem está nela pode ser escalado. Como os tipos de afastamento,
// todos com nível de acesso leem e só o administrador edita.
import { EdicaoDaSituacaoDoMilitar, NovaSituacaoDoMilitar, type SituacaoDoMilitar } from 'contratos';
import { Hono } from 'hono';
import { exigirAdministradorRaiz, exigirAlgumPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';

const MSG_NOME = { '23505': 'Já existe uma situação com esse nome.' };

const MSG_PADRAO = 'Esta é a situação dos períodos novos: ela não pode ser desativada nem deixar de poder ser escalada.';

export function rotasSituacoes(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/situacoes-do-militar', exigirSessao(dep.banco, dep.auth));
  r.use('/situacoes-do-militar/*', exigirSessao(dep.banco, dep.auth));

  r.get('/situacoes-do-militar', async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const { rows } = await c.get('banco').query<SituacaoDoMilitar>('select id, nome, escalavel, ativo from situacao_militar');
    return c.json(rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
  });

  r.post('/situacoes-do-militar', async (c) => {
    const negado = await exigirAdministradorRaiz(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaSituacaoDoMilitar);
    if (!corpo.ok) return corpo.resposta;
    try {
      const nova = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) =>
        (await tx.query<SituacaoDoMilitar>('insert into situacao_militar (nome, escalavel) values ($1, $2) returning id, nome, escalavel, ativo', [corpo.dados.nome, corpo.dados.escalavel])).rows[0]!,
      );
      return c.json(nova, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_NOME);
    }
  });

  r.patch('/situacoes-do-militar/:id', async (c) => {
    const negado = await exigirAdministradorRaiz(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, EdicaoDaSituacaoDoMilitar);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    // a situação dos períodos novos precisa continuar valendo e escalável: senão, o militar novo nasceria fora das escalas
    if (d.ativo === false || d.escalavel === false) {
      const { rows } = await c.get('banco').query<{ padrao: boolean }>('select padrao from situacao_militar where id::text = $1', [c.req.param('id')]);
      if (rows[0]?.padrao) return c.json({ erro: MSG_PADRAO }, 409);
    }
    try {
      const item = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) =>
        (
          await tx.query<SituacaoDoMilitar>(
            `update situacao_militar set nome = coalesce($2, nome), escalavel = coalesce($3, escalavel), ativo = coalesce($4, ativo)
              where id::text = $1 returning id, nome, escalavel, ativo`,
            [c.req.param('id'), d.nome ?? null, d.escalavel ?? null, d.ativo ?? null],
          )
        ).rows[0],
      );
      return item ? c.json(item) : c.json({ erro: 'Situação não encontrada.' }, 404);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_NOME);
    }
  });

  return r;
}
