import { describe, expect, it } from 'vitest';
import { criarAppDoAmbiente } from '../src/app-ambiente.ts';

describe('app do ambiente', () => {
  it('sem banco responde 503', async () => {
    const app = criarAppDoAmbiente({});
    const r = await app.request('/api/eu');
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ erro: 'Ambiente sem banco configurado' });
    expect((await app.request('/api/auth/sign-in/email', { method: 'POST' })).status).toBe(503);
  });

  it('sem banco a saude responde', async () => {
    const r = await criarAppDoAmbiente({}).request('/api/saude');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('com banco monta o app', async () => {
    const app = criarAppDoAmbiente({
      DATABASE_URL: 'postgres://ninguem:nada@127.0.0.1:1/inexistente',
      BETTER_AUTH_SECRET: 'segredo-de-teste-com-tamanho-suficiente-123',
      BETTER_AUTH_URL: 'https://exemplo.test',
      CRON_SECRET: 'cron',
    });
    const r = await app.request('/api/saude');
    expect(r.status).toBe(200);
    // a rota do banco existe e exige o segredo (sem conectar ao banco)
    expect((await app.request('/api/saude/banco')).status).toBe(401);
  });

  it('com banco mas sem segredo do login falha ao montar', () => {
    expect(() => criarAppDoAmbiente({ DATABASE_URL: 'postgres://x@127.0.0.1:1/y' })).toThrow('BETTER_AUTH_SECRET');
  });
});
