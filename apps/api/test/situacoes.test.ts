import type { SituacaoDoMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// O catálogo "Situações do militar": só o administrador edita; todos com nível de acesso leem (como os tipos de afastamento).
let api: ApiDeTeste;
beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

const lista = async (quem: Parameters<ApiDeTeste['pedir']>[0] = 'escalante'): Promise<SituacaoDoMilitar[]> => (await api.pedir(quem, 'GET', '/api/situacoes-do-militar')).json();

describe('situações do militar', () => {
  it('a carga traz Ativa, Reserva, Agregado, Adido e Desativado, em ordem de nome; só a Ativa pode ser escalada', async () => {
    const l = await lista();
    expect(l.map((s) => [s.nome, s.escalavel, s.ativo])).toEqual([
      ['Adido', false, true], ['Agregado', false, true], ['Ativa', true, true], ['Desativado', false, true], ['Reserva', false, true],
    ]);
  });

  it('o militar sem nível de acesso não lê, e o auxiliar não edita', async () => {
    expect((await api.pedir('semPapel', 'GET', '/api/situacoes-do-militar')).status).toBe(403);
    expect((await api.pedir('escalante', 'POST', '/api/situacoes-do-militar', { nome: 'Licenciado', escalavel: false })).status).toBe(403);
    expect((await api.pedir('gestorGb', 'POST', '/api/situacoes-do-militar', { nome: 'Licenciado', escalavel: false })).status).toBe(403);
  });

  it('o administrador cria, renomeia, liga e desliga "pode ser escalado" e desativa', async () => {
    const criada = await api.pedir('admin', 'POST', '/api/situacoes-do-militar', { nome: 'Licença especial', escalavel: false });
    expect(criada.status).toBe(201);
    const s: SituacaoDoMilitar = await criada.json();
    expect(s).toMatchObject({ nome: 'Licença especial', escalavel: false, ativo: true });
    const edit = (corpo: unknown) => api.pedir('admin', 'PATCH', `/api/situacoes-do-militar/${s.id}`, corpo);
    expect(await (await edit({ nome: 'Licença' })).json()).toMatchObject({ nome: 'Licença' });
    expect(await (await edit({ escalavel: true })).json()).toMatchObject({ escalavel: true });
    expect(await (await edit({ ativo: false })).json()).toMatchObject({ ativo: false });
  });

  it('nome repetido (sem caixa) é 409, e um item que não existe é 404', async () => {
    expect((await api.pedir('admin', 'POST', '/api/situacoes-do-militar', { nome: 'reserva', escalavel: false })).status).toBe(409);
    expect((await api.pedir('admin', 'PATCH', '/api/situacoes-do-militar/00000000-0000-4000-8000-000000000000', { ativo: false })).status).toBe(404);
  });

  it('nome vazio é 400 no campo', async () => {
    const r = await api.pedir('admin', 'POST', '/api/situacoes-do-militar', { nome: '  ', escalavel: false });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.nome).toBeTruthy();
  });
});
