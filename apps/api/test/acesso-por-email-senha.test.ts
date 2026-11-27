import { MSG_CODIGO_INVALIDO } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EmailParaEnviar } from '../src/acesso-por-email/enviar-email.ts';
import { criarApp } from '../src/app.ts';
import { criarMilitar, montarApi, SEGREDO_DE_TESTE, URL_BASE, type ApiDeTeste } from './apoio-api.ts';

// Dados fictícios (D7): e-mails do domínio institucional, de militares inventados. Nenhum teste chama o Brevo: o envio é falso.
const DOMINIO = 'bombeiros.pe.gov.br';
const SENHA_NOVA = 'minha-senha-nova-123';

let api: ApiDeTeste;
let relogio = new Date();
const enviados: EmailParaEnviar[] = [];
let n = 0;
let ip = 0;

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) =>
    criarApp({
      banco,
      auth,
      segredo: SEGREDO_DE_TESTE,
      enviarEmail: async (m) => {
        enviados.push(m);
      },
      agora: () => relogio,
      limiteDeBuscas: Infinity,
    }),
  );
});
afterAll(() => api.fechar());

const publico = (caminho: string, corpo: unknown, origem?: string) =>
  api.app.request(`${URL_BASE}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: URL_BASE, ...(origem ? { 'x-forwarded-for': origem } : {}) },
    body: JSON.stringify(corpo),
  });
const pedirCodigo = (email: string) => publico('/api/acesso/codigo', { email }, `198.51.100.${++ip}`);
const criarSenha = (email: string, codigo: string, novaSenha = SENHA_NOVA) => publico('/api/acesso/senha', { email, codigo, novaSenha });
const entrar = (email: string, senha: string) => publico('/api/auth/sign-in/email', { email, password: senha });
const cookieDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const eu = (cookie: string) => api.app.request(`${URL_BASE}/api/eu`, { headers: { Cookie: cookie, Origin: URL_BASE } });

/** Pede o código e devolve o que chegou no e-mail. */
async function pedirEObter(email: string): Promise<string> {
  const antes = enviados.filter((m) => m.para === email).length;
  expect((await pedirCodigo(email)).status).toBe(202);
  for (let i = 0; i < 100 && enviados.filter((m) => m.para === email).length === antes; i++) await new Promise((r) => setTimeout(r, 10));
  const m = enviados.filter((x) => x.para === email).at(-1)!;
  return /\d{6}/.exec(m.texto)![0];
}
const outroCodigo = (certo: string) => String((Number(certo) + 1) % 1_000_000).padStart(6, '0');
async function militar(estado: 'sem-acesso' | 'provisoria' | 'ativo' | 'desativado') {
  const email = `beltrano${++n}@${DOMINIO}`;
  const id = await criarMilitar(api, { matricula: `99${String(7100 + n).padStart(4, '0')}-1`, email, unidadeId: api.ids.secao });
  let provisoria: string | null = null;
  if (estado !== 'sem-acesso') {
    const r = await api.pedir('admin', 'POST', `/api/militares/${id}/senha-provisoria`);
    expect(r.status).toBe(201);
    provisoria = ((await r.json()) as { senha: string }).senha;
    if (estado === 'ativo' || estado === 'desativado') await api.banco.query("update usuario set senha_provisoria_ate = null where militar_id = $1", [id]);
    if (estado === 'desativado') await api.banco.query('update usuario set ativo = false where militar_id = $1', [id]);
  }
  return { id, email, provisoria };
}
const pedido = async (id: string) => (await api.banco.query<{ situacao: string; concluido_em: Date | null }>('select situacao, concluido_em from pedido_de_codigo where militar_id = $1 order by criado_em desc limit 1', [id])).rows[0]!;
const codigoVivo = async (id: string) => (await api.banco.query('select 1 from codigo_de_acesso where militar_id = $1', [id])).rows.length === 1;

describe('criar a senha com o código', () => {
  it('militar sem acesso: o código cria o usuário e a conta, e o login com a senha nova funciona', async () => {
    const { id, email } = await militar('sem-acesso');
    expect((await api.banco.query('select 1 from usuario where militar_id = $1', [id])).rows).toHaveLength(0);
    const codigo = await pedirEObter(email);
    const r = await criarSenha(email, codigo);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect((await api.banco.query('select 1 from usuario where militar_id = $1 and ativo', [id])).rows).toHaveLength(1);
    const login = await entrar(email, SENHA_NOVA);
    expect(login.status).toBe(200);
    expect((await eu(cookieDe(login))).status).toBe(200);
  });

  it('militar ativo que esqueceu a senha: a antiga deixa de entrar e a nova entra', async () => {
    const { email } = await militar('ativo');
    const antiga = (await api.banco.query<{ id: string }>("select id from usuario where email = $1", [email])).rows[0]!.id;
    expect(antiga).toBeTruthy();
    const codigo = await pedirEObter(email);
    expect((await criarSenha(email, codigo)).status).toBe(200);
    expect((await entrar(email, SENHA_NOVA)).status).toBe(200);
  });

  it('com a senha provisória pendente: o código grava a senha, a provisória deixa de valer e a sessão aberta com ela cai', async () => {
    const { id, email, provisoria } = await militar('provisoria');
    const sessao = cookieDe(await entrar(email, provisoria!));
    expect((await eu(sessao)).status).toBe(200);
    const codigo = await pedirEObter(email);
    expect((await criarSenha(email, codigo)).status).toBe(200);
    expect((await api.banco.query<{ ate: Date | null }>('select senha_provisoria_ate as ate from usuario where militar_id = $1', [id])).rows[0]!.ate).toBeNull();
    expect((await eu(sessao)).status).toBe(401);
    expect((await entrar(email, provisoria!)).status).not.toBe(200);
    const nova = await entrar(email, SENHA_NOVA);
    expect(nova.status).toBe(200);
    // entra como quem tem senha definitiva: não é mandado para a tela de criar a senha
    expect(((await (await eu(cookieDe(nova))).json()) as { trocarSenha: boolean }).trocarSenha).toBe(false);
  });

  it('o código serve uma vez só', async () => {
    const { email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    expect((await criarSenha(email, codigo)).status).toBe(200);
    const segunda = await criarSenha(email, codigo, 'outra-senha-nova-456');
    expect(segunda.status).toBe(400);
    expect((await entrar(email, 'outra-senha-nova-456')).status).not.toBe(200);
    expect((await entrar(email, SENHA_NOVA)).status).toBe(200);
  });

  it('vale até 15 minutos; aos 15 min e 1 s está vencido', async () => {
    const { email } = await militar('ativo');
    relogio = new Date('2026-12-03T12:00:00Z');
    const codigo = await pedirEObter(email);
    relogio = new Date('2026-12-03T12:15:01Z');
    const r = await criarSenha(email, codigo);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ erro: MSG_CODIGO_INVALIDO });
    const outro = await (async () => {
      relogio = new Date('2026-12-03T14:00:00Z');
      return pedirEObter(email);
    })();
    relogio = new Date('2026-12-03T14:14:59Z');
    expect((await criarSenha(email, outro)).status).toBe(200);
    relogio = new Date();
  });

  it('a quinta tentativa errada mata o código, e o certo depois disso dá 400', async () => {
    const { id, email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    const errado = outroCodigo(codigo);
    for (let i = 0; i < 5; i++) expect((await criarSenha(email, errado)).status).toBe(400);
    expect(await codigoVivo(id)).toBe(false);
    expect((await criarSenha(email, codigo)).status).toBe(400);
    expect((await entrar(email, SENHA_NOVA)).status).not.toBe(200);
  });

  it('quatro tentativas erradas ainda deixam o código certo valer', async () => {
    const { email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    for (let i = 0; i < 4; i++) expect((await criarSenha(email, outroCodigo(codigo))).status).toBe(400);
    expect((await criarSenha(email, codigo)).status).toBe(200);
  });

  it('dois pedidos seguidos: só o código do segundo funciona', async () => {
    const { email } = await militar('ativo');
    const primeiro = await pedirEObter(email);
    const segundo = await pedirEObter(email);
    expect(segundo).not.toBe(primeiro);
    expect((await criarSenha(email, primeiro)).status).toBe(400);
    expect((await criarSenha(email, segundo)).status).toBe(200);
  });

  it('gerar uma senha provisória pelo auxiliar invalida o código pendente', async () => {
    const { id, email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    expect(await codigoVivo(id)).toBe(true);
    expect((await api.pedir('admin', 'POST', `/api/militares/${id}/senha-provisoria`)).status).toBe(201);
    expect(await codigoVivo(id)).toBe(false);
    expect((await criarSenha(email, codigo)).status).toBe(400);
  });

  it('o pedido fica concluído, com a data da conclusão, e o código some', async () => {
    const { id, email } = await militar('ativo');
    relogio = new Date('2026-12-04T09:00:00Z');
    const codigo = await pedirEObter(email);
    relogio = new Date('2026-12-04T09:05:00Z');
    expect((await criarSenha(email, codigo)).status).toBe(200);
    const p = await pedido(id);
    expect(p.situacao).toBe('concluido');
    expect(new Date(p.concluido_em!).toISOString()).toBe('2026-12-04T09:05:00.000Z');
    expect(await codigoVivo(id)).toBe(false);
    relogio = new Date();
  });

  it('acesso desativado entre o pedido e o uso: 400, a mesma frase', async () => {
    const { id, email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    await api.banco.query('update usuario set ativo = false where militar_id = $1', [id]);
    const r = await criarSenha(email, codigo);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ erro: MSG_CODIGO_INVALIDO });
    expect((await entrar(email, SENHA_NOVA)).status).not.toBe(200);
  });

  it('código errado, vencido, usado e e-mail sem código dão a mesma resposta, byte a byte', async () => {
    const { email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    const errado = await criarSenha(email, outroCodigo(codigo));
    const semCodigo = await criarSenha(`ninguem${++n}@${DOMINIO}`, '123456');
    const corpo = await errado.text();
    expect(errado.status).toBe(400);
    expect(semCodigo.status).toBe(400);
    expect(await semCodigo.text()).toBe(corpo);
    expect(JSON.parse(corpo)).toEqual({ erro: MSG_CODIGO_INVALIDO, campos: { codigo: MSG_CODIGO_INVALIDO } });
  });

  it('senha curta: 400 no campo da senha, e a tentativa não é gasta', async () => {
    const { email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    const r = await criarSenha(email, codigo, 'curta');
    expect(r.status).toBe(400);
    expect(((await r.json()) as { campos: Record<string, string> }).campos.novaSenha).toBe('Use pelo menos 10 caracteres.');
    expect((await criarSenha(email, codigo)).status).toBe(200);
  });

  it('código que não tem 6 números: 400 com a frase do código', async () => {
    const { email } = await militar('ativo');
    const r = await criarSenha(email, '12ab');
    expect(r.status).toBe(400);
    expect(((await r.json()) as { campos: Record<string, string> }).campos.codigo).toBe(MSG_CODIGO_INVALIDO);
  });

  it('dois usos do mesmo código ao mesmo tempo: só um passa', async () => {
    const { email } = await militar('ativo');
    const codigo = await pedirEObter(email);
    const [a, b] = await Promise.all([criarSenha(email, codigo, 'senha-da-corrida-aaa'), criarSenha(email, codigo, 'senha-da-corrida-bbb')]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  it('nada do código, do resumo dele nem da senha nova aparece na auditoria', async () => {
    const { email } = await militar('sem-acesso');
    const codigo = await pedirEObter(email);
    const resumo = (await api.banco.query<{ codigo_resumo: string }>('select codigo_resumo from codigo_de_acesso where militar_id = (select id from militar where lower(email) = $1)', [email])).rows[0]!.codigo_resumo;
    expect((await criarSenha(email, codigo, 'senha-que-nao-deve-vazar-9')).status).toBe(200);
    const auditoria = JSON.stringify((await api.banco.query('select * from auditoria')).rows);
    expect(auditoria).not.toContain(resumo);
    expect(auditoria).not.toContain('senha-que-nao-deve-vazar-9');
    expect(auditoria).not.toMatch(new RegExp(`"${codigo}"`));
  });
});

describe('o limite de tentativas de criar a senha (achado da revisão)', () => {
  const comOrigem = (origem: string, email: string, codigo: string) =>
    api.app.request(`${URL_BASE}/api/acesso/senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: URL_BASE, 'x-forwarded-for': origem },
      body: JSON.stringify({ email, codigo, novaSenha: SENHA_NOVA }),
    });

  it('a 21ª tentativa da mesma origem na hora é 429, para qualquer e-mail e código; outra origem não é afetada', async () => {
    const origem = '203.0.113.200';
    for (let i = 0; i < 20; i++) expect((await comOrigem(origem, `ninguem${i}@${DOMINIO}`, '000000')).status).toBe(400);
    const r = await comOrigem(origem, `ninguem99@${DOMINIO}`, '000000');
    expect(r.status).toBe(429);
    expect(((await r.json()) as { erro: string }).erro).toBe('Muitas tentativas. Tente de novo daqui a uma hora.');
    expect((await comOrigem('203.0.113.201', `ninguem0@${DOMINIO}`, '000000')).status).toBe(400);
  });

  it('passada a hora, a origem volta a poder tentar', async () => {
    const origem = '203.0.113.202';
    relogio = new Date('2026-12-05T10:00:00Z');
    for (let i = 0; i < 20; i++) await comOrigem(origem, `ninguem${i}@${DOMINIO}`, '000000');
    expect((await comOrigem(origem, `ninguem@${DOMINIO}`, '000000')).status).toBe(429);
    relogio = new Date('2026-12-05T11:00:01Z');
    expect((await comOrigem(origem, `ninguem@${DOMINIO}`, '000000')).status).toBe(400);
    relogio = new Date();
  });
});
