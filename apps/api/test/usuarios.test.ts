import { hashPassword } from 'better-auth/crypto';
import type { AcessoDoMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, montarApi, URL_BASE, type ApiDeTeste, type Quem } from './apoio-api.ts';

let api: ApiDeTeste;
let outraSecao: string;
let seq = 0;

const FORMATO_DA_SENHA = /^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){2}$/;
const MSG_VENCIDA = 'Sua senha provisória venceu. Peça uma senha nova ao auxiliar administrativo da sua seção.';
const MSG_TROCA = 'Crie a sua senha antes de continuar.';

beforeAll(async () => {
  api = await montarApi();
  outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
});
afterAll(async () => {
  await api.fechar();
});

const entrar = (email: string, senha: string) =>
  api.app.request(`${URL_BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: URL_BASE },
    body: JSON.stringify({ email, password: senha }),
  });
const cookieDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
/** Pede com o cookie de uma sessão aberta pela própria pessoa (a do militar que entrou com a senha provisória). */
const como = (cookie: string, metodo: string, caminho: string, corpo?: unknown) =>
  api.app.request(`${URL_BASE}${caminho}`, {
    method: metodo,
    headers: { Cookie: cookie, Origin: URL_BASE, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

/** Um militar fictício da 1ª SB, com e-mail novo a cada chamada (D7: matrícula 990xxx-x). */
async function novoMilitar(extra: { email?: string | null; unidadeId?: string } = {}) {
  seq++;
  const matricula = `990${String(800 + seq).padStart(3, '0')}-${seq % 10}`;
  const email = extra.email === undefined ? `militar${seq}@bombeiros.pe.gov.br` : extra.email;
  const id = await criarMilitar(api, { matricula, email, unidadeId: extra.unidadeId ?? api.ids.secao });
  return { id, email: email as string };
}
const gerar = (id: string, quem: Quem = 'escalante') => api.pedir(quem, 'POST', `/api/militares/${id}/senha-provisoria`);
const acessoDe = async (id: string, quem: Quem = 'escalante'): Promise<AcessoDoMilitar> => (await api.pedir(quem, 'GET', `/api/militares/${id}/acesso`)).json();
/** Gera a senha e abre uma sessão com ela. */
async function entrouComProvisoria(m: { id: string; email: string }) {
  const { senha } = await (await gerar(m.id)).json();
  const r = await entrar(m.email, senha);
  return { senha, cookie: cookieDe(r), status: r.status };
}
/** Dá a um militar com conta um papel de escalante na 1ª SB, para provar que o que o barra é a troca da senha, não a falta de papel. */
async function comPapelNaSecao(militarId: string) {
  const usuarioId = (await api.banco.query<{ id: string }>('select id from usuario where militar_id = $1', [militarId])).rows[0]!.id;
  await inserir(api.banco, 'papel_usuario', { usuario_id: usuarioId, unidade_id: api.ids.secao, papel: 'escalante', desde: hojeRecife().slice(0, 7) + '-01' }, 'id');
  return usuarioId;
}

describe('gerar a senha provisória', () => {
  it('o auxiliar da seção gera a senha e o militar entra com ela', async () => {
    const m = await novoMilitar();
    expect((await acessoDe(m.id)).situacao).toBe('sem-acesso');
    const r = await gerar(m.id);
    expect(r.status).toBe(201);
    const { senha, validaAte } = await r.json();
    expect(senha).toMatch(FORMATO_DA_SENHA);
    // vale 7 dias
    const dias = (Date.parse(validaAte) - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.99);
    expect(dias).toBeLessThan(7.01);
    const login = await entrar(m.email, senha);
    expect(login.status).toBe(200);
    const eu = await como(cookieDe(login), 'GET', '/api/eu');
    expect(eu.status).toBe(200);
    expect(await eu.json()).toMatchObject({ trocarSenha: true, papeis: [] });
    expect(await acessoDe(m.id)).toMatchObject({ situacao: 'provisoria', email: m.email, podeGerarSenha: true, senhaProvisoriaAte: validaAte });
  });

  it('o gestor do 2º GB e o administrador também geram', async () => {
    for (const quem of ['gestorGb', 'admin'] as const) {
      const m = await novoMilitar();
      expect((await gerar(m.id, quem)).status).toBe(201);
    }
  });

  it('sem e-mail na ficha não gera senha', async () => {
    const m = await novoMilitar({ email: null });
    const r = await gerar(m.id);
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Preencha o e-mail institucional para dar acesso.');
    expect(await acessoDe(m.id)).toMatchObject({ situacao: 'sem-acesso', email: null, podeGerarSenha: false });
    expect((await api.banco.query('select 1 from usuario where militar_id = $1', [m.id])).rows).toHaveLength(0);
  });

  it('gerar de novo invalida a anterior e derruba a sessão (Review Focus 1)', async () => {
    const m = await novoMilitar();
    const primeira = await entrouComProvisoria(m);
    expect(primeira.status).toBe(200);
    expect((await como(primeira.cookie, 'GET', '/api/eu')).status).toBe(200);
    const { senha: segunda } = await (await gerar(m.id)).json();
    expect((await entrar(m.email, primeira.senha)).status).toBe(401);
    expect((await como(primeira.cookie, 'GET', '/api/eu')).status).toBe(401);
    expect((await entrar(m.email, segunda)).status).toBe(200);
  });

  it('o militar comum e o auxiliar de outra seção recebem 403', async () => {
    const m = await novoMilitar();
    for (const [metodo, rota] of [['GET', 'acesso'], ['POST', 'senha-provisoria'], ['POST', 'desativar-acesso']] as const) {
      expect((await api.pedir('semPapel', metodo, `/api/militares/${m.id}/${rota}`)).status).toBe(403);
    }
    // o auxiliar da 2ª SB (conta feita direto no banco) não mexe em quem é da 1ª SB
    const dele = await novoMilitar({ unidadeId: outraSecao });
    const usuarioId = await inserir(api.banco, 'usuario', { nome: 'SD BM OUTRA', email: 'outra.secao@bombeiros.pe.gov.br', militar_id: dele.id });
    await inserir(api.banco, 'conta', { usuario_id: usuarioId, conta_id: usuarioId, provedor_id: 'credential', senha: await hashPassword('senha-de-teste-123') });
    await inserir(api.banco, 'papel_usuario', { usuario_id: usuarioId, unidade_id: outraSecao, papel: 'escalante', desde: hojeRecife().slice(0, 7) + '-01' });
    const cookie = cookieDe(await entrar('outra.secao@bombeiros.pe.gov.br', 'senha-de-teste-123'));
    const r = await como(cookie, 'POST', `/api/militares/${m.id}/senha-provisoria`);
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Você não tem permissão nos cadastros de 1ª SB.');
    // o auxiliar também gera a senha de um colega auxiliar da unidade dele (folga de 21/11), e a de um militar sem papel
    const comum = await novoMilitar({ unidadeId: outraSecao });
    expect((await como(cookie, 'POST', `/api/militares/${comum.id}/senha-provisoria`)).status).toBe(201);
    // por último: gerar a própria senha derruba a sessão que pediu
    expect((await como(cookie, 'POST', `/api/militares/${dele.id}/senha-provisoria`)).status).toBe(201);
  });

  it('militar que não existe é 404', async () => {
    expect((await api.pedir('escalante', 'GET', '/api/militares/00000000-0000-4000-8000-000000000000/acesso')).status).toBe(404);
  });
});

describe('a troca obrigatória da senha', () => {
  it('antes de trocar, as rotas respondem 403 (Review Focus 2)', async () => {
    const m = await novoMilitar();
    const { cookie, status } = await entrouComProvisoria(m);
    expect(status).toBe(200);
    // com papel na 1ª SB a lista abriria; é a troca pendente que barra
    await comPapelNaSecao(m.id);
    for (const rota of [`/api/unidades/${api.ids.secao}/militares`, '/api/postos', `/api/militares/${m.id}/acesso`]) {
      const r = await como(cookie, 'GET', rota);
      expect(r.status).toBe(403);
      expect((await r.json()).erro).toBe(MSG_TROCA);
    }
    expect((await como(cookie, 'GET', '/api/eu')).status).toBe(200);
  });

  it('trocar a senha libera a sessão e apaga o prazo', async () => {
    const m = await novoMilitar();
    const { cookie, senha } = await entrouComProvisoria(m);
    const usuarioId = await comPapelNaSecao(m.id);
    // senha curta demais: 400 no campo, e nada muda
    const curta = await como(cookie, 'POST', '/api/eu/senha', { novaSenha: '123456789' });
    expect(curta.status).toBe(400);
    expect((await curta.json()).campos.novaSenha).toBeTruthy();
    expect((await como(cookie, 'GET', '/api/eu')).status).toBe(200);
    expect(await (await como(cookie, 'GET', '/api/eu')).json()).toMatchObject({ trocarSenha: true });

    expect((await como(cookie, 'POST', '/api/eu/senha', { novaSenha: 'senha-nova-12345' })).status).toBe(204);
    expect(await (await como(cookie, 'GET', '/api/eu')).json()).toMatchObject({ trocarSenha: false });
    expect((await como(cookie, 'GET', `/api/unidades/${api.ids.secao}/militares`)).status).toBe(200);
    expect((await api.banco.query<{ ate: string | null }>('select senha_provisoria_ate as ate from usuario where id = $1', [usuarioId])).rows[0]!.ate).toBeNull();
    expect((await entrar(m.email, 'senha-nova-12345')).status).toBe(200);
    expect((await entrar(m.email, senha)).status).toBe(401);
    expect((await acessoDe(m.id)).situacao).toBe('ativo');
    // sem senha provisória pendente, não há o que trocar por aqui
    expect((await como(cookie, 'POST', '/api/eu/senha', { novaSenha: 'outra-senha-12345' })).status).toBe(409);
  });

  it('senha provisória vencida não entra, com a mensagem própria (Review Focus 5)', async () => {
    const m = await novoMilitar();
    const { cookie, senha } = await entrouComProvisoria(m);
    await api.banco.query("update usuario set senha_provisoria_ate = now() - interval '1 minute' where militar_id = $1", [m.id]);
    // com a senha certa, a resposta diz que venceu, e não "e-mail ou senha incorretos"
    const r = await entrar(m.email, senha);
    expect(r.status).toBe(403);
    expect((await r.json()).message).toBe(MSG_VENCIDA);
    expect(await acessoDe(m.id)).toMatchObject({ situacao: 'provisoria-vencida' });
    // a sessão aberta antes de vencer também não consegue mais trocar a senha
    const troca = await como(cookie, 'POST', '/api/eu/senha', { novaSenha: 'senha-nova-12345' });
    expect(troca.status).toBe(403);
    expect((await troca.json()).erro).toBe(MSG_VENCIDA);
    // a senha nova do auxiliar resolve
    const { senha: nova } = await (await gerar(m.id)).json();
    expect((await entrar(m.email, nova)).status).toBe(200);
  });
});

describe('desativar o acesso', () => {
  it('desativar derruba a sessão e gerar de novo reativa', async () => {
    const m = await novoMilitar();
    const { cookie, senha } = await entrouComProvisoria(m);
    const r = await api.pedir('escalante', 'POST', `/api/militares/${m.id}/desativar-acesso`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ situacao: 'desativado' });
    expect((await como(cookie, 'GET', '/api/eu')).status).toBe(401);
    expect((await entrar(m.email, senha)).status).not.toBe(200);
    const nova = await gerar(m.id);
    expect(nova.status).toBe(201);
    expect((await entrar(m.email, (await nova.json()).senha)).status).toBe(200);
    expect((await acessoDe(m.id)).situacao).toBe('provisoria');
  });

  it('quem nunca teve acesso não tem o que desativar', async () => {
    const m = await novoMilitar();
    expect((await api.pedir('escalante', 'POST', `/api/militares/${m.id}/desativar-acesso`)).status).toBe(409);
  });
});

describe('papéis na ficha', () => {
  const inicioDoMes = hojeRecife().slice(0, 7) + '-01';
  const dar = (id: string, corpo: unknown, quem: Quem = 'gestorGb') => api.pedir(quem, 'POST', `/api/militares/${id}/papeis`, corpo);
  const papeisGravados = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from papel_usuario')).rows[0]!.n;
  /** Um militar com conta e um papel, já com sessão aberta (feita direto no banco). */
  async function comoNovo(papel: 'gestor' | 'escalante', unidadeId: string) {
    const m = await novoMilitar();
    const usuarioId = await inserir(api.banco, 'usuario', { nome: `SD BM ${m.id}`, email: m.email, militar_id: m.id });
    await inserir(api.banco, 'conta', { usuario_id: usuarioId, conta_id: usuarioId, provedor_id: 'credential', senha: await hashPassword('senha-de-teste-123') });
    const papelId = await inserir(api.banco, 'papel_usuario', { usuario_id: usuarioId, unidade_id: unidadeId, papel, desde: inicioDoMes });
    const cookie = cookieDe(await entrar(m.email, 'senha-de-teste-123'));
    return { m, usuarioId, papelId, cookie };
  }

  it('o gestor do 2º GB dá papel de auxiliar na 1ª SB', async () => {
    const m = await novoMilitar();
    const r = await dar(m.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: inicioDoMes });
    expect(r.status).toBe(201);
    const acesso: AcessoDoMilitar = await r.json();
    expect(acesso.papeis).toMatchObject([{ papel: 'escalante', unidadeId: api.ids.secao, unidadeSigla: '1ª SB', desde: inicioDoMes, ate: null }]);
  });

  it('o auxiliar não dá papel', async () => {
    const m = await novoMilitar();
    expect((await acessoDe(m.id)).papeisQuePodeDar).toEqual([]);
    expect((await dar(m.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: inicioDoMes }, 'escalante')).status).toBe(403);
    const gestor = await acessoDe(m.id, 'gestorGb');
    expect(gestor.papeisQuePodeDar).toEqual(['gestor', 'escalante']);
    expect(gestor.unidadesParaPapel.some((u) => u.id === api.ids.secao)).toBe(true);
    expect((await acessoDe(m.id, 'admin')).papeisQuePodeDar).toEqual(['administrador', 'gestor', 'escalante']);
  });

  it('gestor fora da unidade ou dando administrador recebe 403 (Review Focus 3)', async () => {
    const m = await novoMilitar();
    const g = await comoNovo('gestor', api.ids.secao);
    const antes = await papeisGravados();
    const corpo = { papel: 'escalante', desde: inicioDoMes };
    expect((await como(g.cookie, 'POST', `/api/militares/${m.id}/papeis`, { ...corpo, unidadeId: api.ids.gb })).status).toBe(403);
    expect((await dar(m.id, { papel: 'administrador', unidadeId: api.ids.raiz, desde: inicioDoMes })).status).toBe(403);
    expect((await como(g.cookie, 'POST', `/api/militares/${m.id}/papeis`, { papel: 'administrador', unidadeId: api.ids.secao, desde: inicioDoMes })).status).toBe(403);
    expect(await papeisGravados()).toBe(antes);
    // o administrador dá administrador, só na raiz
    expect((await dar(m.id, { papel: 'administrador', unidadeId: api.ids.secao, desde: inicioDoMes }, 'admin')).status).toBe(400);
    expect((await dar(m.id, { papel: 'administrador', unidadeId: api.ids.raiz, desde: inicioDoMes }, 'admin')).status).toBe(201);
  });

  it('dar papel a quem não tem conta cria o usuário sem acesso', async () => {
    const m = await novoMilitar();
    expect((await api.banco.query('select 1 from usuario where militar_id = $1', [m.id])).rows).toHaveLength(0);
    const r = await dar(m.id, { papel: 'gestor', unidadeId: api.ids.secao, desde: inicioDoMes });
    expect((await r.json()).situacao).toBe('sem-acesso');
    expect((await api.banco.query('select 1 from usuario where militar_id = $1', [m.id])).rows).toHaveLength(1);
    const sem = await novoMilitar({ email: null });
    const r2 = await dar(sem.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: inicioDoMes });
    expect(r2.status).toBe(400);
    expect((await r2.json()).erro).toBe('Preencha o e-mail institucional para dar acesso.');
  });

  it('encerrar fecha o período e não apaga', async () => {
    const m = await novoMilitar();
    const acesso: AcessoDoMilitar = await (await dar(m.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: inicioDoMes })).json();
    const id = acesso.papeis[0]!.id;
    const hoje = hojeRecife();
    const r = await api.pedir('gestorGb', 'POST', `/api/papeis/${id}/encerrar`, { ate: hoje });
    expect(r.status).toBe(200);
    expect((await r.json()).papeis[0].ate).toBe(hoje);
    expect((await api.banco.query('select 1 from papel_usuario where id = $1', [id])).rows).toHaveLength(1);
    expect((await api.pedir('gestorGb', 'POST', `/api/papeis/${id}/encerrar`, { ate: hoje })).status).toBe(409);
    expect((await api.pedir('escalante', 'POST', `/api/papeis/${id}/encerrar`, { ate: hoje })).status).toBe(403);
  });

  it('ate antes de desde dá 400', async () => {
    const m = await novoMilitar();
    const acesso: AcessoDoMilitar = await (await dar(m.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: inicioDoMes })).json();
    const r = await api.pedir('gestorGb', 'POST', `/api/papeis/${acesso.papeis[0]!.id}/encerrar`, { ate: '2000-01-01' });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.ate).toBeTruthy();
  });

  it('ninguém encerra o próprio último nível de acesso de gestor; o administrador pode', async () => {
    const g = await comoNovo('gestor', api.ids.secao);
    const r = await como(g.cookie, 'POST', `/api/papeis/${g.papelId}/encerrar`, { ate: hojeRecife() });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Você não pode encerrar o seu último nível de acesso de gestor. Peça a outro gestor ou ao administrador.');
    expect((await api.pedir('admin', 'POST', `/api/papeis/${g.papelId}/encerrar`, { ate: hojeRecife() })).status).toBe(200);
    // com outro papel de gestor vigente, encerrar um deles vale
    const h = await comoNovo('gestor', api.ids.secao);
    await inserir(api.banco, 'papel_usuario', { usuario_id: h.usuarioId, unidade_id: outraSecao, papel: 'gestor', desde: inicioDoMes });
    expect((await como(h.cookie, 'POST', `/api/papeis/${h.papelId}/encerrar`, { ate: hojeRecife() })).status).toBe(200);
  });
});

describe('revisão final da 6.1', () => {
  const inicioDoMes = hojeRecife().slice(0, 7) + '-01';
  async function comPapel(papel: 'gestor' | 'escalante' | 'administrador', unidadeId: string) {
    const m = await novoMilitar();
    const usuarioId = await inserir(api.banco, 'usuario', { nome: `SD BM ${m.id}`, email: m.email, militar_id: m.id });
    await inserir(api.banco, 'conta', { usuario_id: usuarioId, conta_id: usuarioId, provedor_id: 'credential', senha: await hashPassword('senha-de-teste-123') });
    await inserir(api.banco, 'papel_usuario', { usuario_id: usuarioId, unidade_id: unidadeId, papel, desde: inicioDoMes });
    return m;
  }

  it('o auxiliar não gera a senha nem desativa o acesso de quem tem papel (tomar a conta de um gestor)', async () => {
    const gestor = await comPapel('gestor', api.ids.secao);
    const auxiliar = await comPapel('escalante', api.ids.secao);
    expect((await gerar(gestor.id, 'escalante')).status).toBe(403);
    expect((await api.pedir('escalante', 'POST', `/api/militares/${gestor.id}/desativar-acesso`)).status).toBe(403);
    // o gestor do 2º GB cuida do auxiliar e do gestor da seção; o administrador, de todos
    expect((await gerar(gestor.id, 'gestorGb')).status).toBe(201);
    expect((await gerar(auxiliar.id, 'gestorGb')).status).toBe(201);
    const admin = await comPapel('administrador', api.ids.raiz);
    expect((await gerar(admin.id, 'escalante')).status).toBe(403);
    expect((await gerar(admin.id, 'gestorGb')).status).toBe(403);
    expect((await gerar(admin.id, 'admin')).status).toBe(201);
  });

  it('o auxiliar da 1ª SB gera a senha de outro auxiliar da 1ª SB (folga decidida em 21/11)', async () => {
    const colega = await comPapel('escalante', api.ids.secao);
    expect((await acessoDe(colega.id)).podeGerarSenha).toBe(true);
    expect((await gerar(colega.id, 'escalante')).status).toBe(201);
  });

  it('o auxiliar da 1ª SB não gera a senha de um auxiliar do 2º GB nem de um gestor', async () => {
    const doGb = await comPapel('escalante', api.ids.gb);
    const gestor = await comPapel('gestor', api.ids.secao);
    for (const alvo of [doGb, gestor]) {
      expect((await acessoDe(alvo.id)).podeGerarSenha).toBe(false);
      const r = await gerar(alvo.id, 'escalante');
      expect(r.status).toBe(403);
      expect((await r.json()).erro).toBe('Só quem pode dar o nível de acesso dessa pessoa mexe no acesso dela.');
    }
    // sem e-mail, o botão continua desligado
    const semEmail = await novoMilitar({ email: null });
    expect((await acessoDe(semEmail.id)).podeGerarSenha).toBe(false);
  });

  it('o auxiliar desativa o acesso de um colega auxiliar da unidade dele', async () => {
    const colega = await comPapel('escalante', api.ids.secao);
    const r = await api.pedir('escalante', 'POST', `/api/militares/${colega.id}/desativar-acesso`);
    expect(r.status).toBe(200);
    expect((await r.json()).situacao).toBe('desativado');
    const doGb = await comPapel('escalante', api.ids.gb);
    expect((await api.pedir('escalante', 'POST', `/api/militares/${doGb.id}/desativar-acesso`)).status).toBe(403);
  });

  describe('conta desativada só volta por quem dá o papel (decisão de 21/11)', () => {
    it('o auxiliar não reativa um colega auxiliar desativado', async () => {
      const colega = await comPapel('escalante', api.ids.secao);
      await api.banco.query('update usuario set ativo = false where militar_id = $1', [colega.id]);
      expect((await acessoDe(colega.id)).podeGerarSenha).toBe(false);
      const r = await gerar(colega.id, 'escalante');
      expect(r.status).toBe(403);
      expect((await r.json()).erro).toBe('Só quem pode dar o nível de acesso dessa pessoa mexe no acesso dela.');
    });

    it('o gestor reativa o auxiliar desativado', async () => {
      const colega = await comPapel('escalante', api.ids.secao);
      await api.banco.query('update usuario set ativo = false where militar_id = $1', [colega.id]);
      expect((await gerar(colega.id, 'gestorGb')).status).toBe(201);
    });

    it('o auxiliar continua gerando a senha de um colega auxiliar ativo', async () => {
      const colega = await comPapel('escalante', api.ids.secao);
      expect((await gerar(colega.id, 'escalante')).status).toBe(201);
    });
  });

  it('criar a senha derruba as outras sessões abertas com a provisória', async () => {
    const m = await novoMilitar();
    const { senha, cookie: a } = await entrouComProvisoria(m);
    const b = cookieDe(await entrar(m.email, senha));
    expect((await como(b, 'GET', '/api/eu')).status).toBe(200);
    expect((await como(a, 'POST', '/api/eu/senha', { novaSenha: 'senha-nova-12345' })).status).toBe(204);
    expect((await como(a, 'GET', '/api/eu')).status).toBe(200);
    expect((await como(b, 'GET', '/api/eu')).status).toBe(401);
  });

  it('e-mail que ficou guardado no usuário de outro militar é 409 no campo, na ficha e ao dar acesso', async () => {
    const guardado = await novoMilitar();
    await gerar(guardado.id);
    await api.banco.query('update usuario set ativo = false where militar_id = $1', [guardado.id]);
    await api.pedir('gestorGb', 'PATCH', `/api/militares/${guardado.id}`, { email: null });
    const b = await comPapel('escalante', api.ids.secao);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${b.id}`, { email: guardado.email });
    expect(r.status).toBe(409);
    expect((await r.json()).campos.email).toBe('Este e-mail já é de outro militar.');
    // a ficha ganhou o e-mail por fora (como uma carga), e só depois alguém dá o acesso
    const outro = await novoMilitar({ email: null });
    await api.banco.query('update militar set email = $2 where id = $1', [outro.id, guardado.email]);
    const g = await gerar(outro.id);
    expect(g.status).toBe(409);
    expect((await g.json()).erro).toBe('Este e-mail já é de outro militar.');
  });
});
