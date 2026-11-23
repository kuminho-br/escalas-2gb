import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { criarAdmin } from '../src/usuarios/criar-admin.ts';
import { inserir } from './banco-teste.ts';
import { criarMilitar, entrarComo, montarApi, URL_BASE, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.24: o administrador é um nível de acesso, não muda o militar: ele aparece em toda busca, lista e escala como qualquer militar da lotação dele,
// e os poderes de administrador valem na árvore toda. Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
let seq = 0;
const hoje = hojeRecife();
const SENHA = 'senha-de-teste-624';

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

async function entrar(email: string) {
  const r = await api.app.request(`${URL_BASE}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: URL_BASE }, body: JSON.stringify({ email, password: SENHA }) });
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return async (metodo: string, caminho: string, corpo?: unknown): Promise<Response> =>
    api.app.request(`${URL_BASE}${caminho}`, { method: metodo, headers: { Cookie: cookie, Origin: URL_BASE, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
}
/** Um administrador fictício, criado como o comando de instalação cria; `lotacao` é a sigla da seção (opcional). */
async function admin(extra: { posto?: string; lotacao?: string } = {}) {
  seq++;
  const nome = `ADMTESTE${seq}`;
  const email = `admteste${seq}@exemplo.test`;
  const r = await criarAdmin(api.banco, { matricula: `990${String(300 + seq).padStart(3, '0')}-${seq % 10}`, postoSigla: extra.posto ?? 'CEL', nomeGuerra: nome, email, senha: SENHA, hoje, ...(extra.lotacao ? { lotacao: extra.lotacao } : {}) });
  return { ...r, nome, email, pedir: await entrar(email) };
}
const periodos = async (militarId: string) =>
  (await api.banco.query<{ sigla: string; jornada: string; desde: string; quadro: string | null }>(
    `select un.sigla, r.jornada, to_char(r.desde, 'YYYY-MM-DD') as desde, q.sigla as quadro from rastreio r join unidade un on un.id = r.unidade_id left join quadro q on q.id = r.quadro_id where r.militar_id = $1 order by r.desde`, [militarId],
  )).rows;
const darLotacao = (pedir: (m: string, c: string, b?: unknown) => Promise<Response>, militarId: string, extra: Record<string, unknown> = {}) =>
  pedir('POST', `/api/militares/${militarId}/situacao`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: hoje, ...extra });

describe('o administrador criado sem lotação (a causa)', () => {
  it('não tem período de rastreio: não aparece nas listas da 1ª SB, e a ficha dele dá 404 até para ele', async () => {
    const a = await admin();
    expect(await periodos(a.militarId)).toEqual([]);
    const lista: { nomeGuerra: string }[] = await (await api.pedir('admin', 'GET', `/api/unidades/${api.ids.secao}/militares`)).json();
    expect(lista.map((m) => m.nomeGuerra)).not.toContain(a.nome);
    // a consulta mostra o militar sem lotação (o administrador não é filtrado em nenhuma busca)
    const busca: { militares: { nomeGuerra: string; lotacao: string | null }[] } = await (await api.pedir('semPapel', 'GET', `/api/consulta/militares?texto=${encodeURIComponent(a.nome)}`)).json();
    expect(busca.militares.find((m) => m.nomeGuerra === a.nome)).toMatchObject({ lotacao: null });
    // e a ficha de consulta dele leva o atalho da ficha completa para o administrador (e não para quem só consulta)
    expect((await (await api.pedir('admin', 'GET', `/api/consulta/militares/${a.militarId}`)).json()).podeAbrirFichaCompleta).toBe(true);
    expect((await (await api.pedir('escalante', 'GET', `/api/consulta/militares/${a.militarId}`)).json()).podeAbrirFichaCompleta).toBe(false);
    // a ficha: o administrador abre a de qualquer militar, mesmo sem lotação (6.24)
    expect((await a.pedir('GET', `/api/militares/${a.militarId}`)).status).toBe(200);
  });
});

describe('a lotação do administrador na instalação (6.24)', () => {
  it('com a seção informada, o militar nasce lotado nela, desde o dia 1 do mês, e aparece como qualquer militar da 1ª SB', async () => {
    const a = await admin({ lotacao: '1ª SB' });
    expect(await periodos(a.militarId)).toEqual([{ sigla: '1ª SB', jornada: 'adm', desde: `${hoje.slice(0, 7)}-01`, quadro: 'QOC' }]);
    const lista: { nomeGuerra: string }[] = await (await api.pedir('admin', 'GET', `/api/unidades/${api.ids.secao}/militares`)).json();
    expect(lista.map((m) => m.nomeGuerra)).toContain(a.nome);
    // o Pecúlio da 1ª SB (aniversariantes e pendências) e a consulta de militares
    const peculio = await (await api.pedir('admin', 'GET', `/api/unidades/${api.ids.secao}/peculio?mes=${hoje.slice(0, 7)}`)).json();
    expect(JSON.stringify(peculio)).toContain(a.nome);
    const busca: { militares: { nomeGuerra: string; lotacao: string | null }[] } = await (await api.pedir('semPapel', 'GET', `/api/consulta/militares?texto=${encodeURIComponent(a.nome)}`)).json();
    expect(busca.militares.find((m) => m.nomeGuerra === a.nome)).toMatchObject({ lotacao: '1ª SB' });
  });

  it('sendo QOC, entra na rodada da Escala dos oficiais', async () => {
    const a = await admin({ lotacao: '1ª SB', posto: 'CEL' });
    const e = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/oficiais/${hoje.slice(0, 7)}`)).json();
    expect(e.oficiais.map((o: { nomeGuerra: string }) => o.nomeGuerra)).toContain(a.nome);
  });

  it('seção que não existe é erro, e nada é criado', async () => {
    seq++;
    await expect(criarAdmin(api.banco, { matricula: `990${String(300 + seq).padStart(3, '0')}-${seq % 10}`, postoSigla: 'CEL', nomeGuerra: 'SEMSECAO', email: `semsecao${seq}@exemplo.test`, senha: SENHA, hoje, lotacao: 'SEÇÃO QUE NÃO EXISTE' })).rejects.toThrow(/Seção não encontrada/);
    expect((await api.banco.query('select 1 from militar where nome_guerra = $1', ['SEMSECAO'])).rows).toHaveLength(0);
  });

  it('os poderes de administrador valem na árvore toda, com ou sem lotação (nenhum depende dela)', async () => {
    const sem = await admin();
    const com = await admin({ lotacao: '1ª SB' });
    const outraSecao = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
    const alvo = await criarMilitar(api, { matricula: '990399-9', email: null, unidadeId: outraSecao });
    for (const a of [sem, com]) {
      expect((await a.pedir('GET', `/api/militares/${alvo}`)).status, a.nome).toBe(200);
      expect((await a.pedir('PATCH', `/api/militares/${alvo}`, { telefone: '(81) 90000-0624' })).status, a.nome).toBe(200);
      expect((await a.pedir('GET', `/api/unidades/${outraSecao}/militares`)).status, a.nome).toBe(200);
    }
  });
});

describe('a primeira lotação pela ficha, pelo administrador (6.24)', () => {
  it('um militar sem lotação: o administrador abre a ficha e dá a primeira lotação (inclusive com quadro e situação), sem o 409', async () => {
    const adm = await admin({ lotacao: '1ª SB' });
    const semLotacao = await inserir(api.banco, 'militar', { matricula: '990398-8', posto_grad_id: (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id, nome_guerra: 'SEMLOTACAO' });
    const ficha = await adm.pedir('GET', `/api/militares/${semLotacao}`);
    expect(ficha.status).toBe(200);
    const f = await ficha.json();
    expect(f.rastreio).toEqual([]);
    expect(f.podeEditar.peculio).toBe(true);
    const quadro = (await api.banco.query<{ id: string }>("select id from quadro where sigla = 'QBMG'")).rows[0]!.id;
    const r = await darLotacao(adm.pedir, semLotacao, { quadroId: quadro });
    expect(r.status, JSON.stringify(await r.clone().json())).toBe(201);
    expect(await periodos(semLotacao)).toEqual([{ sigla: '1ª SB', jornada: 'adm', desde: hoje, quadro: 'QBMG' }]);
  });

  it('o administrador dá a lotação a si mesmo (o que foi criado sem ela)', async () => {
    const a = await admin();
    const r = await darLotacao(a.pedir, a.militarId);
    expect(r.status, JSON.stringify(await r.clone().json())).toBe(201);
    expect((await periodos(a.militarId))[0]).toMatchObject({ sigla: '1ª SB' });
    const lista: { nomeGuerra: string }[] = await (await api.pedir('admin', 'GET', `/api/unidades/${api.ids.secao}/militares`)).json();
    expect(lista.map((m) => m.nomeGuerra)).toContain(a.nome);
  });

  it('quem não é administrador não vê nem dá lotação a militar sem lotação: 404 como antes', async () => {
    const semLotacao = await inserir(api.banco, 'militar', { matricula: '990397-7', posto_grad_id: (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id, nome_guerra: 'SEMLOTACAO2' });
    const gestor = await entrarComo(api, { matricula: '990396-6', nome: 'GESTORAQUI', nivel: { papel: 'gestor', unidadeId: api.ids.gb } });
    expect((await gestor.pedir('GET', `/api/militares/${semLotacao}`)).status).toBe(404);
    expect((await gestor.pedir('POST', `/api/militares/${semLotacao}/situacao`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: hoje })).status).toBe(404);
  });
});
