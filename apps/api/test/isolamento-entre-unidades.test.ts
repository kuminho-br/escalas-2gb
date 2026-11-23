import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { criarRegistrosAlheios, rotasDaVarredura } from './registros-alheios.ts';

// O escalante da 1ª SB não pode ler nem mexer em nada da 2ª SB, em nenhuma rota. Os registros da 2ª SB são criados pelo
// administrador (papel na raiz); a varredura troca :u e :id pelos da 2ª SB e exige 403.
let api: ApiDeTeste;
let hono: Hono;
let outra: string;
let ids: Record<string, string>;

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => (hono = criarApp({ banco, auth })));
  outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '8ª SB', nome: '8ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  ids = await criarRegistrosAlheios(api, outra);
});
afterAll(async () => {
  await api.fechar();
});

describe('isolamento entre unidades', () => {
  it('toda rota com :u ou :id da 2ª SB responde 403 ao escalante da 1ª SB', async () => {
    const rotas = rotasDaVarredura(hono, ids, outra).map((r) => `${r.metodo} ${r.caminho}`);
    expect(new Set(rotas).size).toBeGreaterThan(30);
    const diferentes: string[] = [];
    for (const rota of new Set(rotas)) {
      const [metodo, caminho] = rota.split(' ') as [string, string];
      const r = await api.pedir('escalante', metodo, caminho, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
      if (r.status !== 403) diferentes.push(`${rota} → ${r.status}`);
    }
    expect(diferentes).toEqual([]);
  });
});
