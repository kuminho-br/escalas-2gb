import type { Servico } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
let outraSecao: string;
const secao = () => `/api/unidades/${api.ids.secao}`;
const dados = (nome: string, extra: Record<string, unknown> = {}) => ({ nome, tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B', ...extra });

async function criar(nome: string, extra: Record<string, unknown> = {}): Promise<Servico> {
  const r = await api.pedir('escalante', 'POST', `${secao()}/servicos`, dados(nome, extra));
  expect(r.status).toBe(201);
  return r.json();
}
async function turno(servicoId: string, letra: string, inicio: string, fim: string): Promise<Response> {
  return api.pedir('escalante', 'POST', `/api/servicos/${servicoId}/turnos`, { letra, inicio, fim });
}

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
});
afterAll(async () => {
  await api.fechar();
});

describe('serviços', () => {
  it('cria serviço com turnos e devolve duração e turnos padrão', async () => {
    const s = await criar('Operação Noite', { tipo: 'diaria', operacao: 'Guardiões do Bioma', cor: '#C08A1E' });
    expect(s).toMatchObject({ nome: 'Operação Noite', tipo: 'diaria', operacao: 'Guardiões do Bioma', ativo: true, turnos: [] });
    expect((await turno(s.id, 'C', '16:00', '00:00')).status).toBe(201);
    const r = await turno(s.id, 'A', '00:00', '08:00');
    expect(r.status).toBe(201);
    const com: Servico = await r.json();
    expect(com.turnos.map((t) => t.letra)).toEqual(['A', 'C']);
    expect(com.turnos[1]).toMatchObject({ inicio: '16:00', fim: '00:00', duracaoMinutos: 480, turnosPadrao: [{ dia: 0, turno: 'A' }, { dia: 0, turno: 'B' }] });
    expect(com.turnos[0]).toMatchObject({ duracaoMinutos: 480, turnosPadrao: [{ dia: -1, turno: 'B' }] });
    const lista: Servico[] = await (await api.pedir('escalante', 'GET', `${secao()}/servicos`)).json();
    expect(lista.find((x) => x.id === s.id)?.turnos).toHaveLength(2);
  });

  it('operação em serviço que não é diária é 400 no campo operacao', async () => {
    const r = await api.pedir('escalante', 'POST', `${secao()}/servicos`, dados('Pronto Errado', { operacao: 'X' }));
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toEqual({ operacao: 'Operação só existe em serviço de diária.' });
  });

  it('nome repetido com outra caixa ou acento é 409', async () => {
    await criar('PE SEGURO', { tipo: 'diaria' });
    const r = await api.pedir('escalante', 'POST', `${secao()}/servicos`, dados('Pé Seguro', { tipo: 'diaria' }));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe o serviço "PE SEGURO".');
    const outro = await criar('Outro Nome');
    const p = await api.pedir('escalante', 'PATCH', `/api/servicos/${outro.id}`, dados('pe seguro'));
    expect(p.status).toBe(409);
  });

  it('editar o serviço muda os dados e aceita mudar só a caixa do próprio nome', async () => {
    const s = await criar('Saldo Teste');
    const r = await api.pedir('escalante', 'PATCH', `/api/servicos/${s.id}`, dados('SALDO TESTE', { rotuloImpressao: 'SALDO', cor: '#2B7BB9' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ nome: 'SALDO TESTE', rotuloImpressao: 'SALDO', cor: '#2B7BB9' });
  });

  it('letra repetida no serviço é 409 legível', async () => {
    const s = await criar('Letras');
    expect((await turno(s.id, 'A', '08:00', '20:00')).status).toBe(201);
    const r = await turno(s.id, 'A', '09:00', '21:00');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Este serviço já tem o turno A.');
  });

  it('editar e remover turno sem alocação', async () => {
    const s = await criar('Editável');
    const t = ((await (await turno(s.id, 'A', '08:00', '16:00')).json()) as Servico).turnos[0]!;
    const e = await api.pedir('escalante', 'PATCH', `/api/turnos/${t.id}`, { letra: 'A', inicio: '07:00', fim: '19:00' });
    expect(e.status).toBe(200);
    expect(((await e.json()) as Servico).turnos[0]).toMatchObject({ inicio: '07:00', fim: '19:00', duracaoMinutos: 720 });
    const d = await api.pedir('escalante', 'DELETE', `/api/turnos/${t.id}`);
    expect(d.status).toBe(200);
    expect(((await d.json()) as Servico).turnos).toEqual([]);
  });

  it('apagar turno com alocação é 409 legível', async () => {
    const s = await criar('Com Gente');
    const t = ((await (await turno(s.id, 'A', '08:00', '20:00')).json()) as Servico).turnos[0]!;
    const escala = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome: 'Esc Gente', titulo: 'ESCALA', militares_doc: 'todos', dias_doc: 'todos' });
    await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [escala, s.id]);
    const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-S', nome: 'Soldado S', ordem: 950 });
    const militar = await inserir(api.banco, 'militar', { matricula: '990999-1', posto_grad_id: posto, nome_guerra: 'TESTE' });
    await inserir(api.banco, 'alocacao', { militar_id: militar, escala_id: escala, servico_id: s.id, turno_id: t.id, data: '2026-12-01', origem: 'manual' });
    const r = await api.pedir('escalante', 'DELETE', `/api/turnos/${t.id}`);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('O turno A de Com Gente já tem militares escalados. Ele pode mudar de horário, mas não pode ser removido.');
  });

  it('desativar e reativar o serviço', async () => {
    const s = await criar('Temporário');
    const d = await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/situacao`, { ativo: false });
    expect(d.status).toBe(200);
    expect((await d.json()).ativo).toBe(false);
    const lista: Servico[] = await (await api.pedir('escalante', 'GET', `${secao()}/servicos`)).json();
    expect(lista.find((x) => x.id === s.id)?.ativo).toBe(false);
    const r = await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/situacao`, { ativo: true });
    expect((await r.json()).ativo).toBe(true);
  });

  it('sem papel na unidade: 403 em criar, editar, situação e turnos', async () => {
    const s = await criar('Protegido');
    const t = ((await (await turno(s.id, 'A', '08:00', '20:00')).json()) as Servico).turnos[0]!;
    expect((await api.pedir('escalante', 'POST', `/api/unidades/${outraSecao}/servicos`, dados('Alheio'))).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `${secao()}/servicos`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `${secao()}/servicos`, dados('Sem'))).status).toBe(403);
    expect((await api.pedir('semPapel', 'PATCH', `/api/servicos/${s.id}`, dados('Protegido'))).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `/api/servicos/${s.id}/situacao`, { ativo: false })).status).toBe(403);
    expect((await api.pedir('semPapel', 'POST', `/api/servicos/${s.id}/turnos`, { letra: 'B', inicio: '20:00', fim: '08:00' })).status).toBe(403);
    expect((await api.pedir('semPapel', 'PATCH', `/api/turnos/${t.id}`, { letra: 'A', inicio: '08:00', fim: '20:00' })).status).toBe(403);
    expect((await api.pedir('semPapel', 'DELETE', `/api/turnos/${t.id}`)).status).toBe(403);
  });

  it('serviço inexistente é 404 antes de 403', async () => {
    const nada = '00000000-0000-0000-0000-000000000000';
    expect((await api.pedir('semPapel', 'GET', `/api/servicos/${nada}`)).status).toBe(404);
    expect((await api.pedir('semPapel', 'PATCH', `/api/turnos/${nada}`, { letra: 'A', inicio: '08:00', fim: '20:00' })).status).toBe(404);
  });

  it('quem tem papel deixa o próprio usuario_id na auditoria', async () => {
    const s = await criar('Auditado');
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'servico' and registro_id = $1", [s.id]);
    expect(rows[0]?.usuario_id).toBe(api.usuarios.escalante);
  });

  it('a letra U não existe mais', async () => {
    const s = await criar('Sem Unico');
    const r = await turno(s.id, 'U', '08:00', '16:00');
    expect(r.status).toBe(400);
    expect((await r.json()).campos).toHaveProperty('letra');
  });
});
