// Serviços (de onde vem a hora) e os turnos de cada um. Excluir serviço é desativar; turno se remove
// enquanto ninguém foi escalado nele.
import { DadosTurno, EdicaoServico, NovoServico, SituacaoServico, type LetraTurno, type Servico, type TurnoSalvo } from 'contratos';
import { duracaoMinutos, normalizar, turnosPadraoExigidos } from 'dominio';
import { Hono, type Context } from 'hono';
import { CADASTRO, exigirPapel, exigirSessao, unidadeDoRegistro, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';

type Ctx = Context<AmbienteApi>;
const ORDEM_LETRAS: LetraTurno[] = ['A', 'B', 'C'];

type LinhaServico = { id: string; nome: string; tipo: Servico['tipo']; operacao: string | null; rotulo_impressao: string | null; cor: string; ativo: boolean };

/** Turno como a tela mostra: duração e turnos padrão calculados pelo horário. */
export function turnoSalvo(t: { id: string; letra: LetraTurno; inicio: string; fim: string }): TurnoSalvo {
  return { ...t, duracaoMinutos: duracaoMinutos(t.inicio, t.fim), turnosPadrao: turnosPadraoExigidos(t.inicio, t.fim) };
}

/** Serviços pedidos (da unidade, ou pelos ids), com os turnos na ordem A, B, C. */
export async function carregarServicos(c: Consulta, filtro: { unidadeId: string } | { ids: string[] }): Promise<Servico[]> {
  const { rows } = await c.query<LinhaServico>(
    `select id, nome, tipo, operacao, rotulo_impressao, cor, ativo from servico where ${'unidadeId' in filtro ? 'unidade_id = $1' : 'id = any($1)'}`,
    ['unidadeId' in filtro ? filtro.unidadeId : filtro.ids],
  );
  const turnos = rows.length
    ? (
        await c.query<{ id: string; servico_id: string; letra: LetraTurno; inicio: string; fim: string }>(
          `select id, servico_id, letra, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from turno where servico_id = any($1)`,
          [rows.map((s) => s.id)],
        )
      ).rows
    : [];
  return rows
    .map((s) => ({
      id: s.id,
      nome: s.nome,
      tipo: s.tipo,
      operacao: s.operacao,
      rotuloImpressao: s.rotulo_impressao,
      cor: s.cor,
      ativo: s.ativo,
      turnos: turnos
        .filter((t) => t.servico_id === s.id)
        .sort((a, b) => ORDEM_LETRAS.indexOf(a.letra) - ORDEM_LETRAS.indexOf(b.letra))
        .map(({ servico_id: _s, ...t }) => turnoSalvo(t)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function carregarServico(c: Consulta, id: string): Promise<Servico> {
  return (await carregarServicos(c, { ids: [id] }))[0]!;
}

/** O serviço da unidade com o mesmo nome (sem caixa nem acento), fora o próprio. */
async function servicoComNome(c: Consulta, unidadeId: string, nome: string, exceto?: string): Promise<string | null> {
  const { rows } = await c.query<{ id: string; nome: string }>('select id, nome from servico where unidade_id = $1', [unidadeId]);
  return rows.find((s) => s.id !== exceto && normalizar(s.nome) === normalizar(nome))?.nome ?? null;
}

export function rotasServicos(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/servicos', '/servicos/*', '/turnos/*']) r.use(caminho, sessao);

  /** Papel de cadastro na unidade do registro; 404 se ele não existe. */
  async function doRegistro(c: Ctx, tabela: 'servico' | 'turno', id: string): Promise<{ resposta: Response } | { unidadeId: string }> {
    const unidadeId = await unidadeDoRegistro(dep.banco, tabela, id);
    if (!unidadeId) return { resposta: c.json({ erro: tabela === 'servico' ? 'Serviço não encontrado.' : 'Turno não encontrado.' }, 404) };
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    return negado ? { resposta: negado } : { unidadeId };
  }

  r.get('/unidades/:u/servicos', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    return c.json(await carregarServicos(dep.banco, { unidadeId: u }));
  });

  r.post('/unidades/:u/servicos', async (c) => {
    const u = c.req.param('u');
    const negado = await exigirPapel(c, u, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovoServico);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const igual = await servicoComNome(dep.banco, u, d.nome);
    if (igual) return c.json({ erro: `Já existe o serviço "${igual}".` }, 409);
    try {
      const s = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const id = (
          await tx.query<{ id: string }>(
            'insert into servico (unidade_id, nome, tipo, operacao, rotulo_impressao, cor) values ($1, $2, $3, $4, $5, $6) returning id',
            [u, d.nome, d.tipo, d.operacao, d.rotuloImpressao, d.cor],
          )
        ).rows[0]!.id;
        return carregarServico(tx, id);
      });
      return c.json(s, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.get('/servicos/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await doRegistro(c, 'servico', id);
    if ('resposta' in acesso) return acesso.resposta;
    return c.json(await carregarServico(dep.banco, id));
  });

  r.patch('/servicos/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await doRegistro(c, 'servico', id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, EdicaoServico);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    const igual = await servicoComNome(dep.banco, acesso.unidadeId, d.nome, id);
    if (igual) return c.json({ erro: `Já existe o serviço "${igual}".` }, 409);
    // cota só existe para PJES e diária: virar ordinário deixaria cotas que ninguém consegue editar nem copiar
    if (d.tipo === 'ordinario') {
      const n = (await dep.banco.query<{ n: number }>('select count(*)::int as n from cota where servico_id = $1', [id])).rows[0]!.n;
      if (n > 0) {
        const [cotas, aCota] = n === 1 ? ['cota', 'a cota'] : ['cotas', 'as cotas'];
        return c.json({ erro: `O serviço "${d.nome}" tem ${n} ${cotas} de operações. Apague ${aCota} na tela de Cotas antes de mudar o tipo para Ordinário.` }, 409);
      }
    }
    try {
      const s = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('update servico set nome = $2, tipo = $3, operacao = $4, rotulo_impressao = $5, cor = $6 where id = $1', [
          id, d.nome, d.tipo, d.operacao, d.rotuloImpressao, d.cor,
        ]);
        return carregarServico(tx, id);
      });
      return c.json(s);
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
  });

  r.post('/servicos/:id/situacao', async (c) => {
    const id = c.req.param('id');
    const acesso = await doRegistro(c, 'servico', id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, SituacaoServico);
    if (!corpo.ok) return corpo.resposta;
    const s = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      await tx.query('update servico set ativo = $2 where id = $1', [id, corpo.dados.ativo]);
      return carregarServico(tx, id);
    });
    return c.json(s);
  });

  r.post('/servicos/:id/turnos', async (c) => {
    const id = c.req.param('id');
    const acesso = await doRegistro(c, 'servico', id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, DadosTurno);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    try {
      const s = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('insert into turno (servico_id, letra, inicio, fim) values ($1, $2, $3, $4)', [id, d.letra, d.inicio, d.fim]);
        return carregarServico(tx, id);
      });
      return c.json(s, 201);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, { '23505': `Este serviço já tem o turno ${d.letra}.` });
    }
  });

  r.patch('/turnos/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await doRegistro(c, 'turno', id);
    if ('resposta' in acesso) return acesso.resposta;
    const corpo = await lerCorpo(c, DadosTurno);
    if (!corpo.ok) return corpo.resposta;
    const d = corpo.dados;
    // com militares escalados no turno, mudar a letra ou o horário desfaria a escala: o escalante remove antes
    const atual = (
      await dep.banco.query<{ letra: string; inicio: string; fim: string; servico: string }>(
        `select t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, s.nome as servico from turno t join servico s on s.id = t.servico_id where t.id = $1`,
        [id],
      )
    ).rows[0]!;
    if (atual.letra !== d.letra || atual.inicio !== d.inicio || atual.fim !== d.fim) {
      const n = (await dep.banco.query<{ n: number }>('select count(*)::int as n from alocacao where turno_id = $1', [id])).rows[0]!.n;
      if (n > 0) {
        const um = n === 1;
        return c.json({ erro: `O turno ${atual.letra} de ${atual.servico} tem ${n} ${um ? 'militar escalado' : 'militares escalados'}. Remova-${um ? 'o' : 'os'} antes de mudar o horário ou a letra.` }, 409);
      }
    }
    try {
      const s = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        const servicoId = (
          await tx.query<{ servico_id: string }>('update turno set letra = $2, inicio = $3, fim = $4 where id = $1 returning servico_id', [id, d.letra, d.inicio, d.fim])
        ).rows[0]!.servico_id;
        return carregarServico(tx, servicoId);
      });
      return c.json(s);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, { '23505': `Este serviço já tem o turno ${d.letra}.` });
    }
  });

  r.delete('/turnos/:id', async (c) => {
    const id = c.req.param('id');
    const acesso = await doRegistro(c, 'turno', id);
    if ('resposta' in acesso) return acesso.resposta;
    const t = (
      await dep.banco.query<{ servico_id: string; letra: string; servico: string }>(
        'select t.servico_id, t.letra, s.nome as servico from turno t join servico s on s.id = t.servico_id where t.id = $1',
        [id],
      )
    ).rows[0]!;
    try {
      const s = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await tx.query('delete from turno where id = $1', [id]);
        return carregarServico(tx, t.servico_id);
      });
      return c.json(s);
    } catch (e) {
      return respostaDoErroDoBanco(c, e, {
        '23503': `O turno ${t.letra} de ${t.servico} já tem militares escalados. Ele pode mudar de horário, mas não pode ser removido.`,
      });
    }
  });

  return r;
}
