import type { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { montarApi, URL_BASE, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
let hono: Hono;

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => (hono = criarApp({ banco, auth })));
});
afterAll(async () => {
  await api.fechar();
});

describe('acesso às rotas', () => {
  it('toda rota de /api, fora saude e auth, responde 401 sem sessão', async () => {
    const vistas = new Set<string>();
    for (const r of hono.routes) {
      if (r.method === 'ALL' || !r.path.startsWith('/api/')) continue;
      if (r.path.startsWith('/api/saude') || r.path.startsWith('/api/auth')) continue;
      // o Laboratório (/api/lab) tem a varredura dele (cabeçalho, login e perfil), em laboratorio-isolamento.test.ts
      if (r.path.startsWith('/api/lab/')) continue;
      vistas.add(`${r.method} ${r.path.replace(/:[A-Za-z]+/g, 'x').replace(/\*/g, 'x')}`);
    }
    // se a lista vier vazia o teste não prova nada
    expect(vistas.size).toBeGreaterThan(40);
    const diferentes: string[] = [];
    for (const rota of vistas) {
      const [metodo, caminho] = rota.split(' ') as [string, string];
      const r = await hono.request(`${URL_BASE}${caminho}`, { method: metodo, headers: { Origin: URL_BASE } });
      if (r.status !== 401) diferentes.push(`${rota} → ${r.status}`);
    }
    expect(diferentes).toEqual([]);
  });
});
