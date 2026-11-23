import { hashPassword } from 'better-auth/crypto';
import type { AcessoDoMilitar } from 'contratos';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, entrarComo, montarApi, URL_BASE, type ApiDeTeste, type Quem } from './apoio-api.ts';

// Entrega 6.16, Task 2: acabamento das contas e dos níveis de acesso. Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
let seq = 0;
const hoje = hojeRecife();
const inicioDoMes = hoje.slice(0, 7) + '-01';
const mais = (dias: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
const SENHA = 'senha-de-teste-123';

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

const entrar = (email: string, senha: string) =>
  api.app.request(`${URL_BASE}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: URL_BASE }, body: JSON.stringify({ email, password: senha }) });
const cookieDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const como = (cookie: string, metodo: string, caminho: string, corpo?: unknown) =>
  api.app.request(`${URL_BASE}${caminho}`, {
    method: metodo,
    headers: { Cookie: cookie, Origin: URL_BASE, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
const dar = (id: string, corpo: unknown, quem: Quem = 'gestorGb') => api.pedir(quem, 'POST', `/api/militares/${id}/papeis`, corpo);
const acessoDe = async (id: string, quem: Quem = 'gestorGb'): Promise<AcessoDoMilitar> => (await api.pedir(quem, 'GET', `/api/militares/${id}/acesso`)).json();

/** Um militar da 1ª SB, com e-mail novo. */
async function novoMilitar() {
  seq++;
  const matricula = `990${String(600 + seq).padStart(3, '0')}-${seq % 10}`;
  const email = `acesso${seq}@bombeiros.pe.gov.br`;
  return { id: await criarMilitar(api, { matricula, email, unidadeId: api.ids.secao }), email };
}
/** Um militar com conta ativa (senha definitiva), com sessão aberta e, se pedido, um nível de acesso. */
async function comConta(papel?: { papel: 'gestor' | 'escalante' | 'administrador'; unidadeId: string; ate?: string }) {
  const m = await novoMilitar();
  const usuarioId = await inserir(api.banco, 'usuario', { nome: `Conta ${m.id}`, email: m.email, militar_id: m.id });
  await inserir(api.banco, 'conta', { usuario_id: usuarioId, conta_id: usuarioId, provedor_id: 'credential', senha: await hashPassword(SENHA) });
  const papelId = papel ? await inserir(api.banco, 'papel_usuario', { usuario_id: usuarioId, unidade_id: papel.unidadeId, papel: papel.papel, desde: inicioDoMes, ate: papel.ate ?? null }) : null;
  return { m, usuarioId, papelId, cookie: cookieDe(await entrar(m.email, SENHA)) };
}

describe('contas e níveis de acesso: o que o servidor recusa ou aceita (6.16, Task 2)', () => {
  it('item 3: dar nível de acesso numa unidade extinta é 400 "Esta unidade foi extinta.", e ela não vem na lista de escolha', async () => {
    const extinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SEÇÃO EXT', nome: 'Seção extinta', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2025-12-31' });
    const m = await novoMilitar();
    const r = await dar(m.id, { papel: 'escalante', unidadeId: extinta, desde: inicioDoMes });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ erro: 'Esta unidade foi extinta.', campos: { unidadeId: 'Esta unidade foi extinta.' } });
    for (const quem of ['admin', 'gestorGb'] as const) expect((await acessoDe(m.id, quem)).unidadesParaPapel.map((u) => u.id), quem).not.toContain(extinta);
    expect((await api.banco.query('select 1 from papel_usuario pu join usuario u on u.id = pu.usuario_id where u.militar_id = $1', [m.id])).rows).toHaveLength(0);
  });

  it('item 5: com a senha provisória pendente, PATCH /api/eu/telefone é 403 "Crie a sua senha antes de continuar.", e não 401', async () => {
    const m = await novoMilitar();
    const { senha } = await (await api.pedir('escalante', 'POST', `/api/militares/${m.id}/senha-provisoria`)).json();
    const cookie = cookieDe(await entrar(m.email, senha));
    const r = await como(cookie, 'PATCH', '/api/eu/telefone', { telefone: '(81) 90000-0001' });
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Crie a sua senha antes de continuar.');
    expect((await api.banco.query<{ telefone: string | null }>('select telefone from militar where id = $1', [m.id])).rows[0]!.telefone).toBeNull();
  });

  it('item 6: o auxiliar desativa de novo um colega auxiliar já desativado: 200, sem mudar nada', async () => {
    const colega = await comConta({ papel: 'escalante', unidadeId: api.ids.secao });
    const desativar = () => api.pedir('escalante', 'POST', `/api/militares/${colega.m.id}/desativar-acesso`);
    expect((await desativar()).status).toBe(200);
    const antes = (await api.banco.query<{ atualizado_em: string }>('select atualizado_em::text from usuario where id = $1', [colega.usuarioId])).rows[0]!.atualizado_em;
    const r = await desativar();
    expect(r.status).toBe(200);
    expect((await r.json()).situacao).toBe('desativado');
    expect((await api.banco.query<{ atualizado_em: string }>('select atualizado_em::text from usuario where id = $1', [colega.usuarioId])).rows[0]!.atualizado_em).toBe(antes);
  });

  it('item 9: a sessão é conferida uma vez só nas rotas de acesso', async () => {
    const m = await novoMilitar();
    const espiao = vi.spyOn(api.auth.api, 'getSession');
    try {
      expect((await api.pedir('escalante', 'GET', `/api/militares/${m.id}/acesso`)).status).toBe(200);
      expect(espiao).toHaveBeenCalledTimes(1);
      espiao.mockClear();
      expect((await dar(m.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: inicioDoMes })).status).toBe(201);
      expect(espiao).toHaveBeenCalledTimes(1);
    } finally {
      espiao.mockRestore();
    }
  });

  it('item 10: /api/auth/change-password com a senha provisória pendente é recusado; a troca é só pela rota de criar a senha', async () => {
    const m = await novoMilitar();
    const { senha } = await (await api.pedir('escalante', 'POST', `/api/militares/${m.id}/senha-provisoria`)).json();
    const cookie = cookieDe(await entrar(m.email, senha));
    const r = await como(cookie, 'POST', '/api/auth/change-password', { currentPassword: senha, newPassword: 'outra-senha-bem-longa-1' });
    expect(r.status).toBeGreaterThanOrEqual(400);
    // continua pendente, e a senha provisória segue valendo
    expect((await api.banco.query<{ pendente: boolean }>('select senha_provisoria_ate is not null as pendente from usuario where militar_id = $1', [m.id])).rows[0]!.pendente).toBe(true);
    expect((await entrar(m.email, senha)).status).toBe(200);
  });

  it('item 11: "Encerrar" um nível com "até" no futuro vale antes da data: o "até" passa a ser hoje; já passado continua 409', async () => {
    const m = await novoMilitar();
    const acesso: AcessoDoMilitar = await (await dar(m.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: inicioDoMes, ate: mais(30) })).json();
    const id = acesso.papeis[0]!.id;
    const r = await api.pedir('gestorGb', 'POST', `/api/papeis/${id}/encerrar`, { ate: hoje });
    expect(r.status).toBe(200);
    expect((await r.json()).papeis[0].ate).toBe(hoje);
    expect((await api.pedir('gestorGb', 'POST', `/api/papeis/${id}/encerrar`, { ate: hoje })).status).toBe(409);
    // um "até" de ontem já terminou
    const velho: AcessoDoMilitar = await (await dar(m.id, { papel: 'escalante', unidadeId: api.ids.secao, desde: mais(-40), ate: mais(-5) })).json();
    expect((await api.pedir('gestorGb', 'POST', `/api/papeis/${velho.papeis.find((p) => p.ate === mais(-5))!.id}/encerrar`, { ate: hoje })).status).toBe(409);
  });

  it('item 13: o administrador que encerra o próprio último nível de administrador recebe 409; com outro administrador vigente, vale', async () => {
    const unico = await comConta({ papel: 'administrador', unidadeId: api.ids.raiz });
    // o administrador do montarApi também é vigente: para provar o "único", encerra-se esse antes (em um banco de teste só deste caso)
    const outros = (await api.banco.query<{ id: string }>("select id from papel_usuario where papel = 'administrador' and id <> $1 and ate is null", [unico.papelId])).rows.map((x) => x.id);
    await api.banco.query("update papel_usuario set ate = $2::date - 1 where id = any($1::uuid[])", [outros, hoje]);
    const r = await como(unico.cookie, 'POST', `/api/papeis/${unico.papelId}/encerrar`, { ate: hoje });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Você é o único administrador. Dê o nível a outra pessoa antes.');
    expect((await api.banco.query<{ ate: string | null }>('select ate from papel_usuario where id = $1', [unico.papelId])).rows[0]!.ate).toBeNull();
    await api.banco.query('update papel_usuario set ate = null where id = any($1::uuid[])', [outros]);
    expect((await como(unico.cookie, 'POST', `/api/papeis/${unico.papelId}/encerrar`, { ate: hoje })).status).toBe(200);
  });
});

describe('item 7: quem só tem nível de acesso em unidade extinta (6.16, Task 2)', () => {
  it('/api/eu diz que o nível é só de unidade extinta (a tela /sem-lotacao explica); com unidade viva, diz que não', async () => {
    const extinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'SEÇÃO EXT 2', nome: 'Outra seção extinta', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2025-12-31' });
    const so = await entrarComo(api, { matricula: '990691-1', nome: 'SOEXTINTA', nivel: { papel: 'escalante', unidadeId: extinta } });
    expect(await (await so.pedir('GET', '/api/eu')).json()).toMatchObject({ unidades: [], nivelSoEmUnidadeExtinta: true });
    const viva = await entrarComo(api, { matricula: '990692-2', nome: 'COMVIVA', nivel: { papel: 'escalante', unidadeId: api.ids.secao } });
    expect((await (await viva.pedir('GET', '/api/eu')).json()).nivelSoEmUnidadeExtinta).toBe(false);
    const comum = await entrarComo(api, { matricula: '990693-3', nome: 'SEMNIVEL' });
    expect((await (await comum.pedir('GET', '/api/eu')).json()).nivelSoEmUnidadeExtinta).toBe(false);
  });
});

describe('item 13, achado da revisão final: outro administrador com a conta desativada não conta', () => {
  it('o administrador não encerra o próprio nível se o outro administrador está com o acesso desativado', async () => {
    const eu = await comConta({ papel: 'administrador', unidadeId: api.ids.raiz });
    const outro = await comConta({ papel: 'administrador', unidadeId: api.ids.raiz });
    // só os dois são administradores vigentes; o outro perde o acesso, e o nível dele continua valendo no papel
    const demais = (await api.banco.query<{ id: string }>("select id from papel_usuario where papel = 'administrador' and id not in ($1, $2) and (ate is null or ate >= $3::date)", [eu.papelId, outro.papelId, hoje])).rows.map((x) => x.id);
    await api.banco.query('update papel_usuario set ate = $2::date - 1 where id = any($1::uuid[])', [demais, hoje]);
    await api.banco.query('update usuario set ativo = false where id = $1', [outro.usuarioId]);
    const r = await como(eu.cookie, 'POST', `/api/papeis/${eu.papelId}/encerrar`, { ate: hoje });
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Você é o único administrador. Dê o nível a outra pessoa antes.');
  });
});

describe('contas e níveis de acesso: o que a ficha avisa (6.16, Task 2)', () => {
  it('itens 1 e 2: a ficha diz, por nível, se quem olha pode encerrar, e se pode desativar o acesso', async () => {
    // um colega com conta, um nível de auxiliar na 1ª SB e outro de gestor no 2º GB
    const colega = await comConta({ papel: 'escalante', unidadeId: api.ids.secao });
    await inserir(api.banco, 'papel_usuario', { usuario_id: colega.usuarioId, unidade_id: api.ids.gb, papel: 'gestor', desde: inicioDoMes });
    const doAuxiliar = await acessoDe(colega.m.id, 'escalante');
    expect(doAuxiliar.papeis.map((p) => [p.papel, p.podeEncerrar])).toEqual(expect.arrayContaining([['escalante', false], ['gestor', false]]));
    expect(doAuxiliar.podeDesativar).toBe(false);
    const doGestor = await acessoDe(colega.m.id, 'gestorGb');
    expect(doGestor.papeis.every((p) => p.podeEncerrar)).toBe(true);
    expect(doGestor.podeDesativar).toBe(true);
  });

  // uma unidade nova direto abaixo da raiz: sem nenhum gestor acima dela, para o "último gestor" não vir de outro teste
  const unidadeSozinha = (sigla: string) => inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla, nome: `Grupamento ${sigla}`, mae_id: api.ids.raiz, desde: '2020-01-01' });
  const ultimoGestorDe = async (id: string) => (await acessoDe(id)).papeis.find((p) => p.papel === 'gestor')!.ultimoGestorAte ?? null;

  it('item 12: o último gestor vigente de uma unidade, com "até" marcado, vem marcado na ficha; com outro gestor sem fim, não', async () => {
    const u = await unidadeSozinha('G-ULT1');
    const gestor = await comConta({ papel: 'gestor', unidadeId: u, ate: mais(20) });
    expect(await ultimoGestorDe(gestor.m.id)).toBe(mais(20));
    const outro = await comConta({ papel: 'gestor', unidadeId: u });
    expect(await ultimoGestorDe(gestor.m.id)).toBeNull();
    expect(outro.papelId).toBeTruthy();
  });

  it('item 18 (6.18): o aviso não aparece quando há gestor vigente numa unidade acima, que dura mais', async () => {
    const acima = await unidadeSozinha('G-ULT2');
    const abaixo = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: 'S-ULT2', nome: 'Seção ULT2', mae_id: acima, desde: '2020-01-01' });
    const gestor = await comConta({ papel: 'gestor', unidadeId: abaixo, ate: mais(20) });
    expect(await ultimoGestorDe(gestor.m.id)).toBe(mais(20));
    await comConta({ papel: 'gestor', unidadeId: acima });
    expect(await ultimoGestorDe(gestor.m.id)).toBeNull();
  });

  it('item 18 (6.18): conta o gestor que começa no futuro, antes de o nível atual terminar', async () => {
    const u = await unidadeSozinha('G-ULT3');
    const gestor = await comConta({ papel: 'gestor', unidadeId: u, ate: mais(20) });
    expect(await ultimoGestorDe(gestor.m.id)).toBe(mais(20));
    const sucessor = await comConta();
    await inserir(api.banco, 'papel_usuario', { usuario_id: sucessor.usuarioId, unidade_id: u, papel: 'gestor', desde: mais(10), ate: null });
    expect(await ultimoGestorDe(gestor.m.id)).toBeNull();
  });
});
