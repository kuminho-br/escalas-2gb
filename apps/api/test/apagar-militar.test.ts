import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.13, Task 4: o administrador apaga um militar, com tudo o que é dele. Dados fictícios (D7): matrículas 990xxx-x.
// O militar apagado é o do usuário "semPapel" (tem conta e sessão aberta): depois, o pedido seguinte dele é recusado.
let api: ApiDeTeste;
let alvo: string;
let matricula: string;
let outro: string;
let alocacaoDoOutro: string;
let alocDoOutroNaPermuta: string;

const exclusao = (id: string) => `/api/militares/${id}/exclusao`;
const apagar = (id: string, mat: string, quem: 'admin' | 'gestorGb' | 'escalante' = 'admin') => api.pedir(quem, 'DELETE', `/api/militares/${id}`, { matricula: mat });

/** As tabelas que apontam para `militar` e para `usuario`, pelo catálogo do banco (para o teste não envelhecer quando nascer uma tabela nova). */
async function referencias() {
  return (
    await api.banco.query<{ tabela: string; coluna: string; alvo: string }>(
      `select c.conrelid::regclass::text as tabela, a.attname as coluna, c.confrelid::regclass::text as alvo
         from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.contype = 'f' and c.confrelid::regclass::text in ('militar', 'usuario')`,
    )
  ).rows;
}

beforeAll(async () => {
  api = await montarApi();
  const u = api.ids.secao;
  const usuario = api.usuarios.semPapel;
  const m = (await api.banco.query<{ militar_id: string; matricula: string }>('select u.militar_id, m.matricula from usuario u join militar m on m.id = u.militar_id where u.id = $1', [usuario])).rows[0]!;
  alvo = m.militar_id;
  matricula = m.matricula;
  outro = await inserir(api.banco, 'militar', { matricula: '990501-1', posto_grad_id: (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id, nome_guerra: 'OUTRO' });

  // três períodos de rastreio
  await api.banco.query('delete from rastreio where militar_id = $1', [alvo]);
  for (const [desde, ate] of [['2026-01-01', '2026-03-31'], ['2026-04-01', '2026-06-30'], ['2026-07-01', null]]) {
    await inserir(api.banco, 'rastreio', { militar_id: alvo, unidade_id: u, jornada: 'pronto', desde, ate });
  }
  await inserir(api.banco, 'rastreio', { militar_id: outro, unidade_id: u, jornada: 'pronto', desde: '2026-01-01' });
  // escala com alocação, remoção e acúmulo; o outro militar também tem alocação na mesma escala
  const servico = await inserir(api.banco, 'servico', { unidade_id: u, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  const turno = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'A', inicio: '08:00', fim: '20:00' });
  const escala = await inserir(api.banco, 'escala', { unidade_id: u, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(api.banco, 'escala_servico', { escala_id: escala, servico_id: servico, ordem: 1 }, 'escala_id');
  const guarnicao = await inserir(api.banco, 'guarnicao', { unidade_id: u, nome: 'ABT' });
  const funcao = await inserir(api.banco, 'funcao', { unidade_id: u, nome: 'Chefe' });
  const aloc = await inserir(api.banco, 'alocacao', { militar_id: alvo, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-01', origem: 'manual' });
  const aloc2 = await inserir(api.banco, 'alocacao', { militar_id: alvo, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-02', origem: 'manual' });
  await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: aloc, guarnicao_id: guarnicao, funcao_id: funcao });
  await inserir(api.banco, 'remocao', { militar_id: alvo, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-03' });
  // a alocação do outro militar foi marcada pelo usuário que vai sumir: a linha fica, sem o autor
  alocacaoDoOutro = await inserir(api.banco, 'alocacao', { militar_id: outro, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-01', origem: 'manual', presenca_por: usuario });
  // uma permuta entre ele e o outro militar (a permuta precisa de exatamente 2 itens): ela sai inteira, e a alocação do outro fica
  alocDoOutroNaPermuta = await inserir(api.banco, 'alocacao', { militar_id: outro, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-02', origem: 'permuta' });
  await api.banco.transacao(async (tx) => {
    const permuta = (await tx.query<{ id: string }>("insert into permuta (mes) values ('2026-12-01') returning id")).rows[0]!.id;
    await tx.query('insert into permuta_item (permuta_id, alocacao_id, militar_original_id) values ($1, $2, $3), ($1, $4, $5)', [permuta, aloc2, alvo, alocDoOutroNaPermuta, outro]);
  });
  // afastamento, voluntariado e disponibilidade
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento limit 1')).rows[0]!.id;
  await inserir(api.banco, 'afastamento', { militar_id: alvo, tipo_afastamento_id: tipo, inicio: '2026-11-01', fim: '2026-11-05' });
  await inserir(api.banco, 'voluntariado_lancamento', { militar_id: alvo, mes: '2026-12-01' });
  await inserir(api.banco, 'disponibilidade', { militar_id: alvo, data: '2026-12-10', inicio_min: 480, fim_min: 1200, origem: 'manual' });
  // dois níveis de acesso
  await inserir(api.banco, 'papel_usuario', { usuario_id: usuario, unidade_id: u, papel: 'escalante', desde: '2026-01-01', ate: '2026-06-30' });
  await inserir(api.banco, 'papel_usuario', { usuario_id: usuario, unidade_id: api.ids.gb, papel: 'escalante', desde: '2026-01-01', ate: '2026-03-31' });
  // escala dos oficiais: cota, saldo e um turno com ele e outro de que ele saiu
  const servicoOf = await inserir(api.banco, 'servico', { unidade_id: api.ids.gb, nome: 'Oficial', tipo: 'ordinario', cor: '#2F8F5B' });
  const turnoOf = await inserir(api.banco, 'turno', { servico_id: servicoOf, letra: 'A', inicio: '07:00', fim: '19:00' });
  const mes = await inserir(api.banco, 'oficiais_mes', { unidade_id: api.ids.gb, mes: '2026-12-01', servico_id: servicoOf, cotas_em: '2026-11-28T10:00:00Z' });
  await inserir(api.banco, 'oficiais_cota', { mes_id: mes, militar_id: alvo, ordem: 1, dias: 31, devido: 31, cota: 31, sobra: false }, 'mes_id');
  await inserir(api.banco, 'oficiais_turno', { mes_id: mes, dia: '2026-12-01', turno_id: turnoOf, militar_id: alvo });
  await inserir(api.banco, 'oficiais_turno', { mes_id: mes, dia: '2026-12-02', turno_id: turnoOf, militar_id: outro, saiu_militar_id: alvo });
  await inserir(api.banco, 'oficiais_saldo', { unidade_id: api.ids.gb, militar_id: alvo, tipo: 'ajuste', valor: 1, motivo: 'teste', usuario_id: api.usuarios.admin });
});
afterAll(async () => {
  await api.fechar();
});

describe('apagar um militar', () => {
  it('o gestor e o auxiliar recebem 403 com o texto, no GET e no DELETE', async () => {
    for (const quem of ['gestorGb', 'escalante'] as const) {
      const g = await api.pedir(quem, 'GET', exclusao(alvo));
      expect(g.status).toBe(403);
      expect((await g.json()).erro).toBe('Só o administrador do sistema apaga um militar.');
      expect((await apagar(alvo, matricula, quem)).status).toBe(403);
    }
  });

  it('o GET diz o que vai junto', async () => {
    const r = await api.pedir('admin', 'GET', exclusao(alvo));
    expect(r.status).toBe(200);
    // outros: remoção, acúmulo, voluntariado, disponibilidade, cota e saldo dos oficiais, e a permuta com os dois itens (a conta tem linha própria:
    // a sessão e a senha dela não entram em "outros")
    expect(await r.json()).toEqual({ alocacoes: 2, afastamentos: 1, periodosDoRastreio: 3, temConta: true, niveisDeAcesso: 2, outros: 9 });
  });

  it('a matrícula digitada errada é 400, e nada é apagado', async () => {
    const r = await apagar(alvo, '990000-0');
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Digite a matrícula para confirmar.');
    expect((await api.banco.query('select 1 from militar where id = $1', [alvo])).rows).toHaveLength(1);
  });

  it('o administrador não apaga o próprio militar (409)', async () => {
    const meu = (await api.banco.query<{ militar_id: string; matricula: string }>('select u.militar_id, m.matricula from usuario u join militar m on m.id = u.militar_id where u.id = $1', [api.usuarios.admin])).rows[0]!;
    const r = await apagar(meu.militar_id, meu.matricula);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Você não pode apagar o seu próprio cadastro.');
  });

  it('militar que não existe é 404', async () => {
    expect((await api.pedir('admin', 'GET', exclusao('00000000-0000-4000-8000-000000000000'))).status).toBe(404);
  });

  it('com uma falha no meio, nada some (uma transação só)', async () => {
    await api.banco.exec(`
      create or replace function falhar_no_teste() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'; end $$;
      create trigger falhar_no_teste before delete on afastamento for each row execute function falhar_no_teste();`);
    try {
      const r = await apagar(alvo, matricula);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect((await api.banco.query('select 1 from militar where id = $1', [alvo])).rows).toHaveLength(1);
      expect((await api.banco.query('select 1 from alocacao where militar_id = $1', [alvo])).rows).toHaveLength(2);
      expect((await api.banco.query('select 1 from usuario where militar_id = $1', [alvo])).rows).toHaveLength(1);
    } finally {
      await api.banco.exec('drop trigger falhar_no_teste on afastamento; drop function falhar_no_teste();');
    }
  });

  it('o administrador apaga: 204, e nenhuma tabela fica com linha dele; a sessão dele é recusada no pedido seguinte (Review Focus 4)', async () => {
    const usuario = api.usuarios.semPapel;
    expect((await api.pedir('semPapel', 'GET', '/api/eu')).status).toBe(200);
    const contagens = await (await api.pedir('admin', 'GET', exclusao(alvo))).json();
    const antes = (await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'militar' and acao = 'delete'")).rows[0]!.n;
    expect((await apagar(alvo, matricula)).status).toBe(204);

    for (const ref of await referencias()) {
      const id = ref.alvo === 'militar' ? alvo : usuario;
      const { rows } = await api.banco.query<{ n: number }>(`select count(*)::int as n from ${ref.tabela} where ${ref.coluna}::text = $1`, [id]);
      expect(rows[0]!.n, `${ref.tabela}.${ref.coluna}`).toBe(0);
    }
    expect((await api.banco.query('select 1 from militar where id = $1', [alvo])).rows).toHaveLength(0);
    expect((await api.banco.query('select 1 from usuario where id = $1', [usuario])).rows).toHaveLength(0);
    // onde a coluna aceita vazio, a linha fica e o militar sai dela
    expect((await api.banco.query<{ militar_id: string | null; saiu: string | null }>("select militar_id, saiu_militar_id as saiu from oficiais_turno where dia = '2026-12-02'")).rows).toEqual([{ militar_id: outro, saiu: null }]);
    expect((await api.banco.query<{ militar_id: string | null }>("select militar_id from oficiais_turno where dia = '2026-12-01'")).rows).toEqual([{ militar_id: null }]);
    // o outro militar da mesma escala continua com a alocação dele (sem o autor que sumiu)
    expect((await api.banco.query<{ presenca_por: string | null }>('select presenca_por from alocacao where id = $1', [alocacaoDoOutro])).rows).toEqual([{ presenca_por: null }]);
    // a auditoria guarda o delete do militar, com o administrador como autor
    const aud = (await api.banco.query<{ n: number; autor: string }>(
      "select count(*)::int as n, max(usuario_id::text) as autor from auditoria where tabela = 'militar' and acao = 'delete'")).rows[0]!;
    expect(aud.n).toBe(antes + 1);
    expect(aud.autor).toBe(api.usuarios.admin);
    // a sessão aberta do militar apagado não vale mais
    expect((await api.pedir('semPapel', 'GET', '/api/eu')).status).toBe(401);
    const r = await api.pedir('semPapel', 'GET', `/api/unidades/${api.ids.secao}/militares`);
    expect(r.status).toBe(401);
    expect((await r.json()).erro).toBe('Entre no sistema para continuar.');
    expect(contagens.alocacoes).toBe(2);
    // a permuta saiu inteira; a alocação do outro militar ficou
    expect((await api.banco.query('select 1 from permuta')).rows).toHaveLength(0);
    expect((await api.banco.query('select 1 from alocacao where id = $1', [alocDoOutroNaPermuta])).rows).toHaveLength(1);
  });
});
