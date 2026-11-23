// O catálogo "Funções do militar" (entrega 6.15): Chefe de seção, Instrutor… Todo nível de acesso lê; só o administrador altera. A função do militar não é
// a função da guarnição (tabela `funcao`, que continua como está): é o cargo que o militar exerce, e vem daqui até o QOD ser modelado.
import { EdicaoDaFuncaoDoMilitar, NovaFuncaoDoMilitar, type FuncaoDoMilitar } from 'contratos';
import { Hono } from 'hono';
import { exigirAdministradorRaiz, exigirAlgumPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';

const MSG_NOME = { '23505': 'Já existe uma função com esse nome.' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function rotasFuncoesDoMilitar(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  for (const caminho of ['/funcoes-do-militar', '/funcoes-do-militar/*']) r.use(caminho, exigirSessao(dep.banco, dep.auth));

  r.get('/funcoes-do-militar', async (c) => {
    const negado = await exigirAlgumPapel(c);
    if (negado) return negado;
    const { rows } = await c.get('banco').query<FuncaoDoMilitar>('select id, nome, ativo from funcao_militar');
    return c.json(rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
  });

  r.post('/funcoes-do-militar', async (c) => {
    const negado = await exigirAdministradorRaiz(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaFuncaoDoMilitar);
    if (!corpo.ok) return corpo.resposta;
    try {
      const nova = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) =>
        (await tx.query<FuncaoDoMilitar>('insert into funcao_militar (nome) values ($1) returning id, nome, ativo', [corpo.dados.nome])).rows[0]!,
      );
      return c.json(nova, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_NOME);
    }
  });

  r.patch('/funcoes-do-militar/:id', async (c) => {
    const negado = await exigirAdministradorRaiz(c);
    if (negado) return negado;
    const corpo = await lerCorpo(c, EdicaoDaFuncaoDoMilitar);
    if (!corpo.ok) return corpo.resposta;
    const id = c.req.param('id');
    if (!UUID.test(id)) return c.json({ erro: 'Função não encontrada.' }, 404);
    try {
      const item = await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) =>
        (await tx.query<FuncaoDoMilitar>(
          'update funcao_militar set nome = coalesce($2, nome), ativo = coalesce($3, ativo) where id = $1 returning id, nome, ativo',
          [id, corpo.dados.nome ?? null, corpo.dados.ativo ?? null],
        )).rows[0],
      );
      return item ? c.json(item) : c.json({ erro: 'Função não encontrada.' }, 404);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, MSG_NOME);
    }
  });

  return r;
}
