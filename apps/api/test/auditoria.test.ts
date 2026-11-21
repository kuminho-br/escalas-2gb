import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comUsuario, type Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

interface Linha {
  usuario_id: string | null;
  unidade_id: string | null;
  tabela: string;
  registro_id: string;
  acao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

let banco: Banco;
let unidade: string;
let posto: string;
let usuarioId: string;
let seq = 0;

async function linhas(tabela: string, registro: string): Promise<Linha[]> {
  const { rows } = await banco.query<Linha>(
    'select usuario_id, unidade_id, tabela, registro_id, acao, antes, depois from auditoria where tabela = $1 and registro_id = $2 order by id',
    [tabela, registro],
  );
  return rows;
}

function militar() {
  seq++;
  return inserir(banco, 'militar', {
    matricula: `99${String(6000 + seq).padStart(4, '0')}-${seq % 10}`,
    posto_grad_id: posto,
    nome_guerra: `AUD${seq}`,
  });
}

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]?.id
    ?? (await inserir(banco, 'unidade', { tipo: 'corporacao', sigla: 'RAIZ-A', nome: 'Raiz', desde: '2026-11-01' }));
  unidade = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-A', nome: 'Seção', mae_id: raiz, desde: '2026-11-01' });
  posto = await inserir(banco, 'posto_grad', { sigla: 'SD-A', nome: 'Soldado', ordem: 903 });
  const m = await militar();
  usuarioId = await inserir(banco, 'usuario', { nome: 'Usuário', email: 'aud@exemplo.test', militar_id: m });
});
afterAll(async () => {
  await banco.fechar();
});

describe('auditoria', () => {
  it('insert, update e delete geram tres linhas', async () => {
    const m = await militar();
    await banco.query('update militar set nome_guerra = $1 where id = $2', ['NOVO', m]);
    await banco.query('delete from militar where id = $1', [m]);
    const l = await linhas('militar', m);
    expect(l.map((x) => x.acao)).toEqual(['insert', 'update', 'delete']);
    expect(l[0]!.antes).toBeNull();
    expect(l[1]!.antes!.nome_guerra).not.toBe('NOVO');
    expect(l[1]!.depois!.nome_guerra).toBe('NOVO');
    expect(l[2]!.depois).toBeNull();
  });

  it('usuario da transacao', async () => {
    const m = await comUsuario(banco, usuarioId, (tx) =>
      inserir(tx, 'militar', { matricula: '996999-9', posto_grad_id: posto, nome_guerra: 'COMUSR' }),
    );
    expect((await linhas('militar', m))[0]!.usuario_id).toBe(usuarioId);
  });

  it('nao vaza usuario entre transacoes', async () => {
    await comUsuario(banco, usuarioId, (tx) => tx.query('select 1'));
    const m = await militar();
    expect((await linhas('militar', m))[0]!.usuario_id).toBeNull();
  });

  it('unidade direta e pela escala', async () => {
    const s = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
    expect((await linhas('servico', s))[0]!.unidade_id).toBe(unidade);
    const t = await inserir(banco, 'turno', { servico_id: s, letra: 'A', inicio: '08:00', fim: '20:00' });
    const e = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Ord', titulo: 'Ord', militares_doc: 'todos', dias_doc: 'todos' });
    await inserir(banco, 'escala_servico', { escala_id: e, servico_id: s, ordem: 1 }, 'escala_id');
    const m = await militar();
    const a = await inserir(banco, 'alocacao', { militar_id: m, escala_id: e, servico_id: s, turno_id: t, data: '2026-11-05', origem: 'manual' });
    expect((await linhas('alocacao', a))[0]!.unidade_id).toBe(unidade);
    // chave composta
    expect(await linhas('escala_servico', `${e}:${s}`)).toHaveLength(1);
  });

  it('unidade pelo militar, pelo servico, pela guarnicao e pela propria unidade', async () => {
    const m = await militar();
    await inserir(banco, 'rastreio', { militar_id: m, unidade_id: unidade, jornada: 'pronto', desde: '2026-11-01' });
    const af = await inserir(banco, 'afastamento', { militar_id: m, tipo_afastamento_id: (await banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id, inicio: '2026-11-10', fim: '2026-11-20' });
    expect((await linhas('afastamento', af))[0]!.unidade_id).toBe(unidade);
    await banco.query("update militar set nome_guerra = 'MUDOU' where id = $1", [m]);
    expect((await linhas('militar', m)).at(-1)!.unidade_id).toBe(unidade);

    const s = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Bioma', tipo: 'diaria', operacao: 'Op', cor: '#C08A1E' });
    const t = await inserir(banco, 'turno', { servico_id: s, letra: 'A', inicio: '00:00', fim: '08:00' });
    expect((await linhas('turno', t))[0]!.unidade_id).toBe(unidade);

    const g = await inserir(banco, 'guarnicao', { unidade_id: unidade, nome: 'UR' });
    const gv = await inserir(banco, 'guarnicao_versao', { guarnicao_id: g, vigencia_desde: '2026-11-01' });
    expect((await linhas('guarnicao_versao', gv))[0]!.unidade_id).toBe(unidade);
    const f = await inserir(banco, 'funcao', { unidade_id: unidade, nome: 'Chefe' });
    const c = await inserir(banco, 'composicao', { guarnicao_versao_id: gv, funcao_id: f, minimo: 1, maximo: 1 });
    expect((await linhas('composicao', c))[0]!.unidade_id).toBe(unidade);

    const e = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Op', titulo: 'Op', militares_doc: 'todos', dias_doc: 'todos' });
    const v = await inserir(banco, 'escala_vinculo_versao', { escala_id: e, vigencia_desde: '2026-11-01' });
    const eg = await inserir(banco, 'escala_guarnicao', { versao_id: v, guarnicao_id: g, inicio: '08:00', fim: '20:00' });
    expect((await linhas('escala_guarnicao', eg))[0]!.unidade_id).toBe(unidade);

    expect((await linhas('unidade', unidade))[0]!.unidade_id).toBe(unidade);
  });

  it('auditoria nao aceita update', async () => {
    await expect(banco.query("update auditoria set acao = 'x'")).rejects.toThrow(/só de acréscimo/);
  });

  it('auditoria nao aceita delete', async () => {
    await expect(banco.query('delete from auditoria')).rejects.toThrow(/só de acréscimo/);
  });

  it('auditoria nao aceita truncate', async () => {
    await expect(banco.query('truncate auditoria')).rejects.toThrow(/só de acréscimo/);
  });

  it('sessao, verificacao e conta nao sao auditadas', async () => {
    await inserir(banco, 'sessao', { usuario_id: usuarioId, token: 't1', expira_em: '2030-01-01' });
    await inserir(banco, 'verificacao', { identificador: 'i', valor: 'v', expira_em: '2030-01-01' });
    await inserir(banco, 'conta', { usuario_id: usuarioId, conta_id: usuarioId, provedor_id: 'credential', senha: 'hash' });
    const { rows } = await banco.query<{ n: number }>(
      "select count(*)::int as n from auditoria where tabela in ('sessao', 'verificacao', 'conta')",
    );
    expect(rows[0]!.n).toBe(0);
  });
});
