import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { criarApp } from '../src/app.ts';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste } from './banco-teste.ts';

let banco: Banco;
let app: Hono;

beforeAll(async () => {
  banco = await bancoDeTeste();
  app = criarApp({ banco, cronSecret: 'segredo-do-cron' });
});
afterAll(async () => {
  await banco.fechar();
});

describe('saude', () => {
  it('saude responde ok', async () => {
    const r = await app.request('/api/saude');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('saude do banco exige segredo', async () => {
    expect((await app.request('/api/saude/banco')).status).toBe(401);
    const errado = await app.request('/api/saude/banco', { headers: { Authorization: 'Bearer outro' } });
    expect(errado.status).toBe(401);
  });

  it('saude do banco sem segredo configurado fica fechada', async () => {
    const semSegredo = criarApp({ banco });
    const r = await semSegredo.request('/api/saude/banco', { headers: { Authorization: 'Bearer undefined' } });
    expect(r.status).toBe(401);
  });

  it('saude do banco com segredo', async () => {
    const r = await app.request('/api/saude/banco', { headers: { Authorization: 'Bearer segredo-do-cron' } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, banco: 'ok' });
  });
});
