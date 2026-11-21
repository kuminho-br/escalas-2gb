import type { FichaMilitar, Posto } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
let militarId: string;
let sd: string;
let cb: string;
const atual = hojeRecife().slice(0, 7);

beforeAll(async () => {
  api = await montarApi();
  const postos: Posto[] = await (await api.pedir('escalante', 'GET', '/api/postos')).json();
  sd = postos.find((p) => p.sigla === 'SD BM')!.id;
  cb = postos.find((p) => p.sigla === 'CB BM')!.id;
  const alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, {
    matricula: '990950-1', postoGradId: sd, nomeCompleto: 'Fulano de Tal Entrada', nomeGuerra: 'ENTRADA', antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
    lotacao: { equipeId: alfa, jornada: 'pronto', desde: atual },
  });
  expect(r.status).toBe(201);
  militarId = ((await r.json()) as FichaMilitar).id;
});
afterAll(async () => {
  await api.fechar();
});

describe('entradas que davam 500', () => {
  it('PATCH do militar com ?mes inválido dá 400 e não grava nada', async () => {
    const r = await api.pedir('escalante', 'PATCH', `/api/militares/${militarId}?mes=2026-13`, { postoGradId: cb });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erro: 'Mês inválido: use o formato aaaa-mm.' });
    const ficha: FichaMilitar = await (await api.pedir('escalante', 'GET', `/api/militares/${militarId}`)).json();
    expect(ficha.postoGradId).toBe(sd);
  });

  it.each(['constructor', '__proto__', 'toString'])('importação chamada "%s" dá 404, não 500', async (nome) => {
    const modelo = await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/importacao/${nome}/modelo`);
    expect(modelo.status).toBe(404);
    expect(await modelo.json()).toEqual({ erro: 'Importação desconhecida.' });
    const envio = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/${nome}`, new FormData());
    expect(envio.status).toBe(404);
  });
});
