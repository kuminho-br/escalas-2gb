import type { ItemDoPeculio, LinhaMilitar, ListaDoPeculio } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, montarApi, URL_BASE, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.18, Task 7: acabamento da API. Dados fictícios (D7): matrículas 9908xx-x.
let api: ApiDeTeste;
let seq = 0;
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
async function novoMilitar() {
  seq++;
  const matricula = `9908${String(10 + seq).padStart(2, '0')}-${seq % 10}`;
  const email = `api618${seq}@bombeiros.pe.gov.br`;
  return { id: await criarMilitar(api, { matricula, email, unidadeId: api.ids.secao }), email };
}

describe('item 3: o 403 vem antes do 400 do contrato', () => {
  it('criar unidade sem nível de gestão com um corpo malformado: 403 (não 400)', async () => {
    for (const quem of ['escalante', 'semPapel'] as const) {
      const r = await api.pedir(quem, 'POST', '/api/unidades', { sigla: '' });
      expect(r.status, quem).toBe(403);
    }
    // com nível de gestão, o corpo malformado continua sendo 400
    expect((await api.pedir('gestorGb', 'POST', '/api/unidades', { sigla: '' })).status).toBe(400);
  });

  it('o telefone da Minha ficha com a senha provisória pendente e um corpo malformado: 403 "Crie a sua senha…" (não 400)', async () => {
    const m = await novoMilitar();
    const { senha } = await (await api.pedir('escalante', 'POST', `/api/militares/${m.id}/senha-provisoria`)).json();
    const cookie = cookieDe(await entrar(m.email, senha));
    const r = await como(cookie, 'PATCH', '/api/eu/telefone', { telefone: '' });
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Crie a sua senha antes de continuar.');
  });
});

describe('item 4: e-mail com tab ou quebra de linha é 400 no campo, e não 500', () => {
  it('PATCH da ficha recusa o e-mail com tab, quebra de linha e espaço', async () => {
    const m = await novoMilitar();
    for (const email of ['a\tb@bombeiros.pe.gov.br', 'a\nb@bombeiros.pe.gov.br', 'a\rb@bombeiros.pe.gov.br', 'a b@bombeiros.pe.gov.br']) {
      const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { email });
      expect(r.status, JSON.stringify(email)).toBe(400);
      expect(await r.json()).toMatchObject({ campos: { email: 'Use o e-mail institucional (@bombeiros.pe.gov.br).' } });
    }
    expect((await api.banco.query<{ email: string }>('select email from militar where id = $1', [m.id])).rows[0]!.email).toBe(m.email);
  });
});

describe('item 16: as listas dizem "Lotação a partir de" para quem só começa a ser lotado depois do dia de referência', () => {
  it('a lista de Militares e a do Pecúlio trazem a data do período que ainda não começou; o militar já lotado traz null', async () => {
    const proximoMes = somarDias(`${hojeRecife().slice(0, 7)}-28`, 10).slice(0, 7);
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const futuro = await inserir(api.banco, 'militar', { matricula: '990890-0', posto_grad_id: posto, nome_guerra: 'FUTURO' });
    await inserir(api.banco, 'rastreio', { militar_id: futuro, unidade_id: api.ids.secao, jornada: 'adm', desde: `${proximoMes}-15` });
    const antigo = await criarMilitar(api, { matricula: '990891-1', email: null, unidadeId: api.ids.secao });
    const lista: LinhaMilitar[] = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/militares?mes=${proximoMes}`)).json();
    expect(lista.find((m) => m.id === futuro)!.lotacaoAPartirDe).toBe(`${proximoMes}-15`);
    expect(lista.find((m) => m.id === antigo)!.lotacaoAPartirDe ?? null).toBeNull();
    const peculio: ListaDoPeculio = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.secao}/peculio?mes=${proximoMes}`)).json();
    const item = (id: string): ItemDoPeculio => peculio.militares.find((m) => m.militarId === id)!;
    expect(item(futuro).lotacaoAPartirDe).toBe(`${proximoMes}-15`);
    expect(item(antigo).lotacaoAPartirDe ?? null).toBeNull();
  });
});

describe('item 17: nascimento em 29/02 pede o ano', () => {
  it('29/02 sem ano no PATCH da ficha é 400 "Informe o ano…", e o ano gravado não se apaga; com ano bissexto vale', async () => {
    const m = await novoMilitar();
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { nascimento: { dia: 10, mes: 3, ano: 1993 } })).status).toBe(200);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { nascimento: { dia: 29, mes: 2 } });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ erro: 'Informe o ano: 29/02 só existe em ano bissexto.', campos: { nascimento: 'Informe o ano: 29/02 só existe em ano bissexto.' } });
    const gravado = (await api.banco.query<{ nascimento_dia: number; nascimento_mes: number; nascimento_ano: number }>('select nascimento_dia, nascimento_mes, nascimento_ano from militar where id = $1', [m.id])).rows[0]!;
    expect(gravado).toEqual({ nascimento_dia: 10, nascimento_mes: 3, nascimento_ano: 1993 });
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { nascimento: { dia: 29, mes: 2, ano: 1992 } })).status).toBe(200);
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${m.id}`, { nascimento: { dia: 29, mes: 2, ano: 1993 } })).status).toBe(400);
  });
});
