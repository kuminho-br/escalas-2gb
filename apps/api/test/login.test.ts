import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { criarApp } from '../src/app.ts';
import { criarAuth } from '../src/auth.ts';
import type { Banco } from '../src/banco/banco.ts';
import { criarAdmin } from '../src/usuarios/criar-admin.ts';
import { bancoDeTeste } from './banco-teste.ts';

const URL_BASE = 'http://localhost:8787';
const SENHA = 'senha-de-teste-123';
let banco: Banco;
let app: Hono;
let usuarioId: string;

function entrar(email: string, senha: string) {
  return app.request(`${URL_BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: URL_BASE },
    body: JSON.stringify({ email, password: senha }),
  });
}

function cookieDe(r: Response): string {
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

async function usuarios(): Promise<number> {
  return (await banco.query<{ n: number }>('select count(*)::int as n from usuario')).rows[0]!.n;
}

beforeAll(async () => {
  banco = await bancoDeTeste();
  const auth = criarAuth({ banco, segredo: 'segredo-de-teste-com-tamanho-suficiente-123', urlBase: URL_BASE });
  app = criarApp({ banco, auth });
  ({ usuarioId } = await criarAdmin(banco, {
    matricula: '990900-0', postoSigla: 'CAP BM', nomeGuerra: 'ADMIN', email: 'admin@exemplo.test', senha: SENHA, hoje: '2026-11-17',
  }));
});
afterAll(async () => {
  await banco.fechar();
});

describe('login', () => {
  it('entra com senha certa', async () => {
    const r = await entrar('admin@exemplo.test', SENHA);
    expect(r.status).toBe(200);
    expect(cookieDe(r)).toContain('session_token');
  });

  it('senha errada', async () => {
    expect((await entrar('admin@exemplo.test', 'outra-senha-qualquer')).status).toBe(401);
  });

  it('cadastro aberto desligado', async () => {
    const antes = await usuarios();
    const r = await app.request(`${URL_BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: URL_BASE },
      body: JSON.stringify({ email: 'novo@exemplo.test', password: 'senha-nova-12345', name: 'Novo' }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED');
    expect(await usuarios()).toBe(antes);
  });

  it('eu com sessao', async () => {
    const cookie = cookieDe(await entrar('admin@exemplo.test', SENHA));
    const r = await app.request(`${URL_BASE}/api/eu`, { headers: { Cookie: cookie } });
    expect(r.status).toBe(200);
    const eu = await r.json();
    expect(eu.usuario).toMatchObject({ id: usuarioId, email: 'admin@exemplo.test', nome: 'CAP BM ADMIN' });
    expect(eu.militar).toEqual({ matricula: '990900-0', postoGrad: 'CAP BM', nomeGuerra: 'ADMIN' });
    expect(eu.papeis).toHaveLength(1);
    expect(eu.papeis[0]).toMatchObject({ papel: 'administrador', unidadeSigla: 'CBMPE' });
  });

  it('eu sem sessao', async () => {
    expect((await app.request(`${URL_BASE}/api/eu`)).status).toBe(401);
  });

  it('criar admin fica na auditoria', async () => {
    const { rows } = await banco.query<{ tabela: string }>(
      "select distinct tabela from auditoria where acao = 'insert' and tabela in ('militar', 'usuario', 'papel_usuario', 'conta') order by tabela",
    );
    expect(rows.map((r) => r.tabela)).toEqual(['militar', 'papel_usuario', 'usuario']);
  });

  it('admin com email repetido', async () => {
    await expect(
      criarAdmin(banco, { matricula: '990901-1', postoSigla: 'SD BM', nomeGuerra: 'OUTRO', email: 'admin@exemplo.test', senha: SENHA, hoje: '2026-11-17' }),
    ).rejects.toThrow('Já existe usuário com este e-mail');
  });

  it('eu sem papel', async () => {
    const { usuarioId: semPapel } = await criarAdmin(banco, {
      matricula: '990902-2', postoSigla: 'SD BM', nomeGuerra: 'SEMPAPEL', email: 'sempapel@exemplo.test', senha: SENHA, hoje: '2026-11-17',
    });
    await banco.query("update papel_usuario set ate = desde where usuario_id = $1", [semPapel]);
    await banco.query("update papel_usuario set desde = '2020-01-01', ate = '2020-01-31' where usuario_id = $1", [semPapel]);
    const cookie = cookieDe(await entrar('sempapel@exemplo.test', SENHA));
    const r = await app.request(`${URL_BASE}/api/eu`, { headers: { Cookie: cookie } });
    expect(r.status).toBe(200);
    expect((await r.json()).papeis).toEqual([]);
  });

  it('inativo nao entra', async () => {
    await criarAdmin(banco, {
      matricula: '990903-3', postoSigla: 'SD BM', nomeGuerra: 'INATIVO', email: 'inativo@exemplo.test', senha: SENHA, hoje: '2026-11-17',
    });
    await banco.query("update usuario set ativo = false where email = 'inativo@exemplo.test'");
    const r = await entrar('inativo@exemplo.test', SENHA);
    expect(r.status).not.toBe(200);
    expect(cookieDe(r)).not.toContain('session_token');
  });
});
