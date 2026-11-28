import type { GradeDoMes, Posto } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.13, Task 5: os postos e graduações (sigla e nome) ficam editáveis nas Configurações, só pelo administrador.
// Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
let postos: Posto[];
const mes = hojeRecife().slice(0, 7);
const de = (sigla: string) => postos.find((p) => p.sigla === sigla)!;
const mudar = (id: string, d: unknown, quem: 'admin' | 'gestorGb' | 'escalante' = 'admin') => api.pedir(quem, 'PATCH', `/api/postos/${id}`, d);
const lerPostos = async (): Promise<Posto[]> => (await api.pedir('admin', 'GET', '/api/postos')).json();

beforeAll(async () => {
  api = await montarApi();
  postos = await lerPostos();
  // um 3º sargento e um cabo na mesma equipe, com a mesma antiguidade: o sargento vem primeiro na Grade pelo posto
  const equipe = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', tipo: 'pronto', posicao_ciclo: 1 });
  for (const [mat, posto, nome] of [['990601-1', 'CB', 'CABO'], ['990602-2', '3º SGT', 'SARGENTO']] as const) {
    // a matrícula do cabo vem antes: sem a ordem do posto, o desempate pela matrícula poria o cabo à frente
    const id = await inserir(api.banco, 'militar', { matricula: mat, posto_grad_id: de(posto).id, nome_guerra: nome, antiguidade: 1 });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, equipe_id: equipe, jornada: 'pronto', desde: `${mes}-01` });
  }
});
afterAll(async () => {
  await api.fechar();
});

const ordemNaGrade = async () => {
  const g: GradeDoMes = await (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/grade/${mes}`)).json();
  return g.grupos.flatMap((x) => x.linhas.map((l) => l.nomeGuerra)).filter((n) => n === 'CABO' || n === 'SARGENTO');
};

describe('postos e graduações nas Configurações', () => {
  it('o gestor e o auxiliar recebem 403', async () => {
    for (const quem of ['gestorGb', 'escalante'] as const) expect((await mudar(de('SD').id, { sigla: 'SD', nome: 'Soldado' }, quem)).status).toBe(403);
  });

  it('o administrador muda a sigla e o nome; a ordem não muda; a mudança entra na auditoria', async () => {
    const antes = (await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'posto_grad'")).rows[0]!.n;
    const r = await mudar(de('CB').id, { sigla: 'Cabo', nome: 'Cabo do Corpo' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ id: de('CB').id, sigla: 'Cabo', nome: 'Cabo do Corpo', ordem: de('CB').ordem });
    expect((await lerPostos()).map((p) => p.ordem)).toEqual(postos.map((p) => p.ordem));
    expect((await api.banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'posto_grad'")).rows[0]!.n).toBe(antes + 1);
    const aud = (await api.banco.query<{ usuario: string; depois: { sigla: string } }>(
      "select usuario_id::text as usuario, depois from auditoria where tabela = 'posto_grad' order by id desc limit 1")).rows[0]!;
    expect(aud.usuario).toBe(api.usuarios.admin);
    expect(aud.depois.sigla).toBe('Cabo');
    await mudar(de('CB').id, { sigla: 'CB', nome: 'Cabo' });
  });

  it('sigla repetida, sem diferenciar maiúsculas, é 409 no campo', async () => {
    const r = await mudar(de('CB').id, { sigla: 'sd', nome: 'Cabo' });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erro: 'Já existe um posto com esta sigla.', campos: { sigla: 'Já existe um posto com esta sigla.' } });
  });

  it('sigla ou nome vazios são 400; posto que não existe é 404', async () => {
    expect((await mudar(de('CB').id, { sigla: ' ', nome: 'Cabo' })).status).toBe(400);
    expect((await mudar('00000000-0000-4000-8000-000000000000', { sigla: 'X', nome: 'Y' })).status).toBe(404);
  });

  it('não há rota para criar nem para apagar posto', async () => {
    expect((await api.pedir('admin', 'POST', '/api/postos', { sigla: 'X', nome: 'Y' })).status).toBe(404);
    expect((await api.pedir('admin', 'DELETE', `/api/postos/${de('SD').id}`)).status).toBe(404);
  });

  it('a sigla renomeada não muda a ordem de antiguidade nas escalas (Review Focus 2)', async () => {
    expect(await ordemNaGrade()).toEqual(['SARGENTO', 'CABO']);
    expect((await mudar(de('3º SGT').id, { sigla: '3º SGT', nome: 'Terceiro-Sargento' })).status).toBe(200);
    expect(await ordemNaGrade()).toEqual(['SARGENTO', 'CABO']);
    // uma sigla que o motor não reconhece também não muda a ordem: vale a ordem do posto, e não a sigla
    expect((await mudar(de('3º SGT').id, { sigla: 'Terceiro-Sargento', nome: 'Terceiro-Sargento' })).status).toBe(200);
    expect(await ordemNaGrade()).toEqual(['SARGENTO', 'CABO']);
  });

  it('a importação do Pecúlio reconhece a sigla nova, e a sigla antiga com "BM" não vale mais (a importação é contrato)', async () => {
    const importar = async (posto: string) => {
      const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.gb}/importacao/peculio`, formulario(await planilha({ 'PECÚLIO': [['MATRÍCULA', 'POSTO/GRAD'], ['990602-2', posto]] })));
      return r.json();
    };
    expect((await importar('Terceiro-Sargento')).ignoradas).toEqual([]);
    expect((await importar('CB')).alterados[0].mudancas).toEqual(['posto: Terceiro-Sargento → CB']);
    // sem tolerância ao formato antigo: "CB BM" é um posto que não existe, e a célula é ignorada com o motivo
    const antiga = (await importar('CB BM')).ignoradas;
    expect(antiga).toEqual([expect.objectContaining({ coluna: 'POSTO/GRAD', motivo: expect.stringContaining('não existe') })]);
    expect((await mudar(de('CB').id, { sigla: 'Cabo', nome: 'Cabo' })).status).toBe(200);
    expect((await importar('CB')).ignoradas).toEqual([expect.objectContaining({ coluna: 'POSTO/GRAD' })]);
  });
});
