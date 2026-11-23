import type { TipoDeUnidadeComUso } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.25, Task 2: o cadastro de tipos de unidade (grupamento, divisão, seção…). Qualquer conta lê; só o administrador muda. Dados fictícios (D7).
let api: ApiDeTeste;

const lista = async () => (await (await api.pedir('semPapel', 'GET', '/api/tipos-de-unidade')).json()) as TipoDeUnidadeComUso[];
const criar = (corpo: unknown, quem: 'admin' | 'gestorGb' | 'escalante' | 'semPapel' = 'admin') => api.pedir(quem, 'POST', '/api/tipos-de-unidade', corpo);
const alterar = (id: string, corpo: unknown, quem: 'admin' | 'gestorGb' = 'admin') => api.pedir(quem, 'PATCH', `/api/tipos-de-unidade/${id}`, corpo);
const excluir = (id: string, quem: 'admin' | 'gestorGb' = 'admin') => api.pedir(quem, 'DELETE', `/api/tipos-de-unidade/${id}`);

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('os tipos de unidade', () => {
  it('qualquer conta lê, na ordem, com quantas unidades usam cada tipo', async () => {
    const tipos = await lista();
    expect(tipos.map((t) => t.codigo)).toEqual(['corporacao', 'diretoria_geral', 'diretoria_integrada', 'grupamento', 'divisao', 'secao']);
    expect(tipos.find((t) => t.codigo === 'divisao')).toMatchObject({ nome: 'Divisão', ordem: 4, unidades: 2, id: expect.any(String) });
    expect(tipos.find((t) => t.codigo === 'corporacao')!.unidades).toBe(1);
  });

  it('o administrador cria: o código sai do nome, sem acento, em minúsculas e com "_"; a ordem padrão é a última', async () => {
    const r = await criar({ nome: 'Pelotão de Serviço' });
    expect(r.status).toBe(201);
    const novo: TipoDeUnidadeComUso = await r.json();
    expect(novo).toMatchObject({ codigo: 'pelotao_de_servico', nome: 'Pelotão de Serviço', ordem: 6, unidades: 0 });
    const auditoria = (await api.banco.query<{ usuario_id: string; acao: string }>("select usuario_id::text, acao from auditoria where tabela = 'tipo_unidade' and registro_id = $1", [novo.id])).rows;
    expect(auditoria).toEqual([{ usuario_id: api.usuarios.admin, acao: 'insert' }]);
    // a ordem pode repetir
    const mesmaOrdem = await criar({ nome: 'Subseção', ordem: 5 });
    expect(mesmaOrdem.status).toBe(201);
    expect((await mesmaOrdem.json()).ordem).toBe(5);
  });

  it('o nome repetido (sem diferenciar maiúsculas e acentos), vazio ou longo é recusado', async () => {
    const repetido = await criar({ nome: 'secao' });
    expect(repetido.status).toBe(409);
    expect(await repetido.json()).toEqual({ erro: 'Já existe um tipo com este nome.', campos: { nome: 'Já existe um tipo com este nome.' } });
    expect((await criar({ nome: 'Seção' })).status).toBe(409);
    expect((await criar({ nome: ' ' })).status).toBe(400);
    expect((await criar({ nome: 'x'.repeat(41) })).status).toBe(400);
  });

  it('renomeia e muda a ordem, e o código não muda; as unidades do tipo continuam ligadas a ele', async () => {
    const divisao = (await lista()).find((t) => t.codigo === 'divisao')!;
    const r = await alterar(divisao.id, { nome: 'Divisão Setorial', ordem: 7 });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ codigo: 'divisao', nome: 'Divisão Setorial', ordem: 7, unidades: 2 });
    expect((await alterar(divisao.id, { nome: 'Seção' })).status).toBe(409);
    expect((await alterar(divisao.id, {})).status).toBe(400);
    expect((await alterar('00000000-0000-4000-8000-000000000000', { nome: 'X' })).status).toBe(404);
    await alterar(divisao.id, { nome: 'Divisão', ordem: 4 });
  });

  it('só se exclui o tipo que nenhuma unidade usa, nem extinta', async () => {
    const usado = (await lista()).find((t) => t.codigo === 'secao')!;
    const r = await excluir(usado.id);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Há unidades deste tipo.');
    // uma unidade extinta também prende o tipo
    const livre = (await (await criar({ nome: 'Destacamento' })).json()) as TipoDeUnidadeComUso;
    await inserir(api.banco, 'unidade', { tipo: livre.codigo, sigla: 'DEST', nome: 'Destacamento 1', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2020-12-31' });
    expect((await excluir(livre.id)).status).toBe(409);
    const outro = (await (await criar({ nome: 'Brigada' })).json()) as TipoDeUnidadeComUso;
    expect((await excluir(outro.id)).status).toBe(204);
    expect((await lista()).map((t) => t.codigo)).not.toContain('brigada');
    expect((await excluir(outro.id)).status).toBe(404);
  });

  it('quem não é o administrador recebe 403 em todas as mudanças', async () => {
    const divisao = (await lista()).find((t) => t.codigo === 'divisao')!;
    for (const quem of ['gestorGb', 'escalante', 'semPapel'] as const) expect((await criar({ nome: 'Negado' }, quem)).status).toBe(403);
    expect((await alterar(divisao.id, { nome: 'Negado' }, 'gestorGb')).status).toBe(403);
    expect((await excluir(divisao.id, 'gestorGb')).status).toBe(403);
    expect((await lista()).map((t) => t.nome)).not.toContain('Negado');
  });
});
