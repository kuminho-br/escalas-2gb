import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { URL_BASE, entrarComo, montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.59, Task 1: a sessão no Laboratório (a conta real escolhe um dos cinco perfis de teste do espelho). Dados fictícios (D7).
let api: ApiDeTeste;
const NIVEIS = ['administrador', 'gestor', 'gestor_lateral', 'escalante', 'militar'];

beforeAll(async () => {
  api = await montarApi(undefined, { espelho: true });
}, 240000);
afterAll(async () => {
  await api.fechar();
});

const perfis = async () => (await (await api.pedir('semPapel', 'GET', '/api/laboratorio/perfis')).json()) as { perfilId: string; nome: string; nivel: string }[];
const linhas = async () => (await api.banco.query<{ usuario_id: string; perfil_id: string }>('select usuario_id, perfil_id from laboratorio_sessao order by usuario_id')).rows;

describe('os perfis de teste e a sessão no Laboratório', () => {
  it('lista os cinco perfis, com o nome e o nível de cada um, para quem tem conta (qualquer nível)', async () => {
    const p = await perfis();
    expect(p.map((x) => x.nivel)).toEqual(NIVEIS);
    expect(p.map((x) => x.nome)).toEqual(['Administrador de teste', 'Gestor de teste', 'Quinto nível de teste', 'Auxiliar administrativo de teste', 'Militar de teste']);
    expect(p.every((x) => /^[0-9a-f-]{36}$/.test(x.perfilId))).toBe(true);
  });

  it('sem login, 401 em todas as rotas', async () => {
    for (const [metodo, caminho] of [['GET', '/api/laboratorio/perfis'], ['PUT', '/api/laboratorio/perfil'], ['DELETE', '/api/laboratorio/perfil'], ['GET', '/api/laboratorio/eu']] as const) {
      expect((await api.app.request(`${URL_BASE}${caminho}`, { method: metodo, headers: { Origin: URL_BASE } })).status, `${metodo} ${caminho}`).toBe(401);
    }
  });

  it('entra com cada um dos cinco perfis: a conta ganha uma linha só, e o /eu diz o perfil em uso', async () => {
    for (const perfil of await perfis()) {
      const r = await api.pedir('semPapel', 'PUT', '/api/laboratorio/perfil', { perfilId: perfil.perfilId });
      expect(r.status, perfil.nome).toBe(200);
      expect(await r.json()).toEqual({ perfilId: perfil.perfilId, nome: perfil.nome });
      expect(await (await api.pedir('semPapel', 'GET', '/api/laboratorio/eu')).json()).toEqual(perfil);
      expect(await linhas()).toEqual([{ usuario_id: api.usuarios.semPapel, perfil_id: perfil.perfilId }]);
    }
  });

  it('perfil que não existe: 400 com a frase fixa e nada gravado; id malformado também recusa', async () => {
    const antes = await linhas();
    const r = await api.pedir('escalante', 'PUT', '/api/laboratorio/perfil', { perfilId: randomUUID() });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erro: 'Perfil de teste não encontrado.' });
    expect((await api.pedir('escalante', 'PUT', '/api/laboratorio/perfil', { perfilId: 'x' })).status).toBe(400);
    expect(await linhas()).toEqual(antes);
  });

  it('o usuário comum do real (um id de conta real) não é perfil de teste', async () => {
    const r = await api.pedir('escalante', 'PUT', '/api/laboratorio/perfil', { perfilId: api.usuarios.admin });
    expect(r.status).toBe(400);
  });

  it('sair apaga a sessão; sem sessão o /eu diz null', async () => {
    const [primeiro] = await perfis();
    await api.pedir('gestorGb', 'PUT', '/api/laboratorio/perfil', { perfilId: primeiro!.perfilId });
    expect(await (await api.pedir('gestorGb', 'GET', '/api/laboratorio/eu')).json()).toMatchObject({ nivel: 'administrador' });
    expect((await api.pedir('gestorGb', 'DELETE', '/api/laboratorio/perfil')).status).toBe(200);
    expect(await (await api.pedir('gestorGb', 'GET', '/api/laboratorio/eu')).json()).toBeNull();
    expect((await linhas()).some((l) => l.usuario_id === api.usuarios.gestorGb)).toBe(false);
  });

  it('conta apagada leva a sessão junto (cascade)', async () => {
    const [primeiro] = await perfis();
    const pessoa = await entrarComo(api, { matricula: '990931-1', nome: 'EFEMERO' });
    expect((await pessoa.pedir('PUT', '/api/laboratorio/perfil', { perfilId: primeiro!.perfilId })).status).toBe(200);
    expect((await linhas()).some((l) => l.usuario_id === pessoa.usuarioId)).toBe(true);
    await api.banco.query('delete from sessao where usuario_id = $1', [pessoa.usuarioId]);
    await api.banco.query('delete from conta where usuario_id = $1', [pessoa.usuarioId]);
    await api.banco.query('delete from usuario where id = $1', [pessoa.usuarioId]);
    expect((await linhas()).some((l) => l.usuario_id === pessoa.usuarioId)).toBe(false);
  });
});
