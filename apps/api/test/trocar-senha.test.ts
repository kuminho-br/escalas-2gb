import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { criarMilitar, montarApi, SEGREDO_DE_TESTE, URL_BASE, type ApiDeTeste } from './apoio-api.ts';

// Trocar a senha estando logado (6.68, Task 5), pela rota change-password do better-auth. Dados fictícios (D7); nenhum teste chama o Brevo.
const SENHA = 'senha-de-teste-123';
const NOVA = 'senha-trocada-456-ok';
let api: ApiDeTeste;
let n = 0;
let ip = 0;
const enviados: { para: string; texto: string }[] = [];

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) =>
    criarApp({
      banco,
      auth,
      segredo: SEGREDO_DE_TESTE,
      enviarEmail: async (m) => {
        enviados.push(m);
      },
      limiteDeBuscas: Infinity,
    }),
  );
});
afterAll(() => api.fechar());

const chamar = (caminho: string, corpo: unknown, cookie?: string, origem?: string) =>
  api.app.request(`${URL_BASE}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: URL_BASE, ...(cookie ? { Cookie: cookie } : {}), ...(origem ? { 'x-forwarded-for': origem } : {}) },
    body: JSON.stringify(corpo),
  });
const entrar = (email: string, senha: string) => chamar('/api/auth/sign-in/email', { email, password: senha });
const cookieDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const trocar = (cookie: string, atual: string, nova: string) => chamar('/api/auth/change-password', { currentPassword: atual, newPassword: nova, revokeOtherSessions: true }, cookie);
const eu = (cookie: string) => api.app.request(`${URL_BASE}/api/eu`, { headers: { Cookie: cookie, Origin: URL_BASE } });

/** Um militar fictício com senha definitiva (ou provisória pendente). */
async function conta(provisoria = false) {
  const email = `sicrano${++n}@bombeiros.pe.gov.br`;
  const id = await criarMilitar(api, { matricula: `99${String(7300 + n).padStart(4, '0')}-1`, email, unidadeId: api.ids.secao });
  const r = await api.pedir('admin', 'POST', `/api/militares/${id}/senha-provisoria`);
  const gerada = ((await r.json()) as { senha: string }).senha;
  if (provisoria) return { id, email, senha: gerada };
  // a senha definitiva de teste: troca pela rota de criar a senha, com a sessão aberta com a provisória
  const sessao = cookieDe(await entrar(email, gerada));
  const ok = await api.app.request(`${URL_BASE}/api/eu/senha`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: URL_BASE, Cookie: sessao }, body: JSON.stringify({ novaSenha: SENHA }) });
  expect(ok.status).toBe(204);
  return { id, email, senha: SENHA };
}

describe('trocar a senha estando logado', () => {
  it('com a senha atual certa, grava a nova: o login com a nova funciona e com a antiga não', async () => {
    const { email } = await conta();
    const cookie = cookieDe(await entrar(email, SENHA));
    expect((await trocar(cookie, SENHA, NOVA)).status).toBe(200);
    expect((await entrar(email, NOVA)).status).toBe(200);
    expect((await entrar(email, SENHA)).status).not.toBe(200);
  });

  it('com a senha atual errada, é recusado e nada muda', async () => {
    const { email } = await conta();
    const cookie = cookieDe(await entrar(email, SENHA));
    const r = await trocar(cookie, 'senha-que-nao-e-a-atual', NOVA);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect((await entrar(email, SENHA)).status).toBe(200);
    expect((await entrar(email, NOVA)).status).not.toBe(200);
  });

  it('com a senha nova curta, é recusado e nada muda', async () => {
    const { email } = await conta();
    const cookie = cookieDe(await entrar(email, SENHA));
    const r = await trocar(cookie, SENHA, 'curta');
    expect(r.status).toBe(400);
    expect((await entrar(email, SENHA)).status).toBe(200);
  });

  it('as outras sessões do militar caem e a desta continua', async () => {
    const { email } = await conta();
    const esta = cookieDe(await entrar(email, SENHA));
    const outra = cookieDe(await entrar(email, SENHA));
    expect((await eu(outra)).status).toBe(200);
    const r = await trocar(esta, SENHA, NOVA);
    expect(r.status).toBe(200);
    // a resposta pode trazer um cookie novo para esta sessão
    const cookieNovo = r.headers.getSetCookie().length ? cookieDe(r) : esta;
    expect((await eu(cookieNovo)).status).toBe(200);
    expect((await eu(outra)).status).toBe(401);
  });

  it('com a senha provisória pendente continua 403 (a guarda de hoje), e a senha não muda', async () => {
    const { email, senha } = await conta(true);
    const cookie = cookieDe(await entrar(email, senha));
    expect((await trocar(cookie, senha, NOVA)).status).toBe(403);
    expect((await entrar(email, senha)).status).toBe(200);
  });

  it('o código de acesso pendente do militar deixa de valer depois da troca', async () => {
    const { id, email } = await conta();
    expect((await chamar('/api/acesso/codigo', { email }, undefined, `192.0.2.${++ip}`)).status).toBe(202);
    for (let i = 0; i < 100 && !enviados.some((m) => m.para === email); i++) await new Promise((r) => setTimeout(r, 10));
    const codigo = /\d{6}/.exec(enviados.find((m) => m.para === email)!.texto)![0];
    expect((await api.banco.query('select 1 from codigo_de_acesso where militar_id = $1', [id])).rows).toHaveLength(1);
    const cookie = cookieDe(await entrar(email, SENHA));
    expect((await trocar(cookie, SENHA, NOVA)).status).toBe(200);
    expect((await api.banco.query('select 1 from codigo_de_acesso where militar_id = $1', [id])).rows).toHaveLength(0);
    expect((await chamar('/api/acesso/senha', { email, codigo, novaSenha: 'outra-senha-qualquer-1' })).status).toBe(400);
  });

  it('a troca recusada não apaga o código pendente', async () => {
    const { id, email } = await conta();
    expect((await chamar('/api/acesso/codigo', { email }, undefined, `192.0.2.${++ip}`)).status).toBe(202);
    for (let i = 0; i < 100 && !enviados.some((m) => m.para === email); i++) await new Promise((r) => setTimeout(r, 10));
    const cookie = cookieDe(await entrar(email, SENHA));
    expect((await trocar(cookie, 'senha-errada-qualquer', NOVA)).status).toBeGreaterThanOrEqual(400);
    expect((await api.banco.query('select 1 from codigo_de_acesso where militar_id = $1', [id])).rows).toHaveLength(1);
  });

  it('se apagar o código pendente falhar, a senha já trocada não vira erro 500 (achado da revisão)', async () => {
    const { email } = await conta();
    const cookie = cookieDe(await entrar(email, SENHA));
    await api.banco.exec('drop table codigo_de_acesso');
    expect((await trocar(cookie, SENHA, NOVA)).status).toBe(200);
    expect((await entrar(email, NOVA)).status).toBe(200);
  });
});
