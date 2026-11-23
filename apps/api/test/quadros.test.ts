import type { FichaMilitar, Quadro } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { quadroParaOPosto } from '../src/cadastros/quadros.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Dados fictícios (D7).
let api: ApiDeTeste;
let alfa: string;
const posto: Record<string, string> = {};
const quadro: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const MSG_FORA = 'Este posto-graduação não existe nesse quadro.';

const novo = (matricula: string, postoSigla: string, extra: Record<string, unknown> = {}) => ({
  matricula, postoGradId: posto[postoSigla], nomeCompleto: `Fulano de Tal ${matricula}`, nomeGuerra: `TESTE${matricula.slice(3, 6)}`, antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
  lotacao: { equipeId: alfa, jornada: 'pronto', desde: `${atual}-01` }, ...extra,
});
const criar = (matricula: string, postoSigla: string, extra: Record<string, unknown> = {}) =>
  api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novo(matricula, postoSigla, extra));
const ficha = async (id: string): Promise<FichaMilitar> => (await api.pedir('gestorGb', 'GET', `/api/militares/${id}`)).json();
const alterar = (id: string, corpo: Record<string, unknown>) => api.pedir('gestorGb', 'PATCH', `/api/militares/${id}`, corpo);
const siglaDoQuadro = async (id: string | null) => (id === null ? null : (await api.banco.query<{ sigla: string }>('select sigla from quadro where id = $1', [id])).rows[0]!.sigla);

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
});
afterAll(async () => {
  await api.fechar();
});

describe('quadroParaOPosto', () => {
  const escolher = (postoSigla: string, pedido: string | null | undefined, atualSigla: string | null) =>
    quadroParaOPosto(api.banco, posto[postoSigla]!, pedido === undefined || pedido === null ? pedido : quadro[pedido]!, atualSigla ? quadro[atualSigla]! : null);

  it('pedido que contém o posto vale', async () => {
    expect(await escolher('CAP BM', 'QOA', null)).toEqual({ quadroId: quadro.QOA });
  });
  it('pedido fora do posto é erro', async () => {
    expect(await escolher('CAP BM', 'QBMG', null)).toEqual({ erro: MSG_FORA });
  });
  it('sem pedido, o atual fica se tiver o posto', async () => {
    expect(await escolher('2º TEN BM', undefined, 'QOC')).toEqual({ quadroId: quadro.QOC });
    expect(await escolher('2º TEN BM', undefined, 'QOA')).toEqual({ quadroId: quadro.QOA });
  });
  it('sem pedido, posto de um quadro só', async () => {
    expect(await escolher('CEL BM', undefined, 'QOA')).toEqual({ quadroId: quadro.QOC });
    expect(await escolher('SD BM', undefined, null)).toEqual({ quadroId: quadro.QBMG });
  });
  it('sem pedido, ambíguo e o atual não serve', async () => {
    expect(await escolher('MAJ BM', undefined, 'QBMG')).toEqual({ quadroId: null });
    expect(await escolher('MAJ BM', undefined, null)).toEqual({ quadroId: null });
  });
  it('pedido null limpa', async () => {
    expect(await escolher('MAJ BM', null, 'QOA')).toEqual({ quadroId: null });
  });
});

describe('GET /api/quadros', () => {
  it('responde a quem tem sessão, na ordem QOC, QOA, QBMG, com os postos de cada um', async () => {
    const r = await api.pedir('gestorGb', 'GET', '/api/quadros');
    expect(r.status).toBe(200);
    const quadros: Quadro[] = await r.json();
    expect(quadros.map((q) => q.sigla)).toEqual(['QOC', 'QOA', 'QBMG']);
    expect(quadros[1]).toMatchObject({ id: quadro.QOA, nome: 'Quadro de Oficiais da Administração' });
    expect([...quadros[1]!.postoGradIds].sort()).toEqual(['2º TEN BM', '1º TEN BM', 'CAP BM', 'MAJ BM'].map((s) => posto[s]!).sort());
  });
  it('até quem não tem papel lê (a lista não é sigilosa; sem sessão, o teste de acesso às rotas confere o 401)', async () => {
    expect((await api.pedir('semPapel', 'GET', '/api/quadros')).status).toBe(200);
  });
});

describe('o quadro na ficha', () => {
  it('militar novo de posto único recebe o quadro; de posto ambíguo fica sem, com a pendência', async () => {
    const sd = await (await criar('990601-1', 'SD BM')).json();
    expect(sd.quadro).toMatchObject({ sigla: 'QBMG' });
    expect(sd.pendencias).not.toContain('Sem quadro');
    const maj = await (await criar('990602-2', 'MAJ BM')).json();
    expect(maj.quadro).toBeNull();
    expect(maj.pendencias).toContain('Sem quadro');
  });

  it('criar já com o quadro pedido', async () => {
    const f = await (await criar('990603-3', 'MAJ BM', { quadroId: quadro.QOA })).json();
    expect(f.quadro).toMatchObject({ id: quadro.QOA, sigla: 'QOA' });
    expect(f.pendencias).not.toContain('Sem quadro');
  });

  it('trocar o posto de MAJ do QOA para CEL passa a QOC sozinho', async () => {
    const f = await (await criar('990604-4', 'MAJ BM', { quadroId: quadro.QOA })).json();
    const r = await alterar(f.id, { postoGradId: posto['CEL BM'] });
    expect(r.status).toBe(200);
    expect((await r.json()).quadro).toMatchObject({ sigla: 'QOC' });
  });

  it('trocar o posto de 2º TEN do QOC para CAP mantém o QOC', async () => {
    const f = await (await criar('990605-5', '2º TEN BM', { quadroId: quadro.QOC })).json();
    const r = await alterar(f.id, { postoGradId: posto['CAP BM'] });
    expect((await r.json()).quadro).toMatchObject({ sigla: 'QOC' });
  });

  it('escolher QBMG para um CAP: 400 no campo', async () => {
    const f = await (await criar('990606-6', 'CAP BM', { quadroId: quadro.QOA })).json();
    const r = await alterar(f.id, { quadroId: quadro.QBMG });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.quadroId).toBe(MSG_FORA);
    expect((await ficha(f.id)).quadro).toMatchObject({ sigla: 'QOA' });
  });

  it('criar com quadro que não contém o posto: 400 no campo', async () => {
    const r = await criar('990607-7', 'CAP BM', { quadroId: quadro.QBMG });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.quadroId).toBe(MSG_FORA);
  });

  it('trocar o posto para um que o quadro pedido não tem: 400, sem 500', async () => {
    const f = await (await criar('990608-8', 'CAP BM', { quadroId: quadro.QOA })).json();
    const r = await alterar(f.id, { postoGradId: posto['SD BM'], quadroId: quadro.QOA });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.quadroId).toBe(MSG_FORA);
  });

  it('pedido null limpa o quadro e a pendência aparece', async () => {
    const f = await (await criar('990609-9', 'CAP BM', { quadroId: quadro.QOA })).json();
    const r = await alterar(f.id, { quadroId: null });
    expect(r.status).toBe(200);
    const depois = await r.json();
    expect(depois.quadro).toBeNull();
    expect(depois.pendencias).toContain('Sem quadro');
  });

  it('o quadro é do Pecúlio: quem só tem papel na seção não altera', async () => {
    const f = await (await criar('990610-1', 'CAP BM')).json();
    const r = await api.pedir('escalante', 'PATCH', `/api/militares/${f.id}`, { quadroId: quadro.QOA });
    expect(r.status).toBe(403);
  });

  it('a linha da lista traz o quadro', async () => {
    const lista: { matricula: string; quadro: { sigla: string } | null }[] = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/militares`)).json();
    expect(lista.find((m) => m.matricula === '990601-1')!.quadro).toMatchObject({ sigla: 'QBMG' });
    expect(lista.find((m) => m.matricula === '990602-2')!.quadro).toBeNull();
  });
});

describe('correções da revisão final', () => {
  it('o militar do administrador criado na instalação já tem o quadro do posto', async () => {
    const q = (await api.banco.query<{ sigla: string | null }>(
      'select q.sigla from usuario u join militar m on m.id = u.militar_id left join quadro q on q.id = m.quadro_id where u.id = $1', [api.usuarios.admin])).rows[0]!.sigla;
    expect(q).toBe('QBMG');
  });

  it('um campo da escala (voluntário JES) não preenche o quadro, que é do Pecúlio', async () => {
    const f = await (await criar('990620-1', 'CEL BM')).json();
    await api.banco.query('update militar set quadro_id = null where id = $1', [f.id]);
    const r = await api.pedir('escalante', 'PATCH', `/api/militares/${f.id}`, { voluntarioJes: true });
    expect(r.status).toBe(200);
    expect((await r.json()).quadro).toBeNull();
  });
});
