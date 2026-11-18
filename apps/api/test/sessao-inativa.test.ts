import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('usuário desativado com a sessão aberta', () => {
  it('perde o acesso a todas as rotas, não só ao /api/eu', async () => {
    const lista = `/api/unidades/${api.ids.secao}/militares`;
    expect((await api.pedir('escalante', 'GET', lista)).status).toBe(200);
    await api.banco.query('update usuario set ativo = false where id = $1', [api.usuarios.escalante]);
    const r = await api.pedir('escalante', 'GET', lista);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: 'Entre no sistema para continuar.' });
    expect((await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/feriados`, { data: '2026-12-25', descricao: 'Natal', fixo: true })).status).toBe(401);
    expect((await api.pedir('escalante', 'GET', '/api/eu')).status).toBe(401);
  });

  it('reativado, volta a entrar', async () => {
    await api.banco.query('update usuario set ativo = true where id = $1', [api.usuarios.escalante]);
    expect((await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/militares`)).status).toBe(200);
  });
});
