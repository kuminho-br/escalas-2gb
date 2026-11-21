import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CADASTRO, exigirPapel, exigirSessao, temPapel, temPapelAcima, unidadeDoRegistro, type AmbienteApi } from '../src/acesso.ts';
import { respostaDoErroDoBanco } from '../src/erros.ts';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

let api: ApiDeTeste;
const hoje = hojeRecife();

beforeAll(async () => {
  // app só com uma rota de teste protegida, sobre o mesmo banco e login
  api = await montarApi(({ banco, auth }) => {
    const app = new Hono<AmbienteApi>();
    app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
    app.use('/api/teste/*', exigirSessao(banco, auth));
    app.get('/api/teste/:u', async (c) => (await exigirPapel(c, c.req.param('u'), CADASTRO)) ?? c.json({ ok: true }));
    app.post('/api/teste/conflito', async (c) => {
      try {
        await banco.query("insert into atividade (nome) values ('APH')");
        return c.json({ ok: true });
      } catch (e) {
        return respostaDoErroDoBanco(c, e);
      }
    });
    return app;
  });
});
afterAll(async () => {
  await api.fechar();
});

describe('papéis por unidade', () => {
  it('escalante da 1ª SB pode escrever na 1ª SB e não no 2º GB', async () => {
    const { banco, usuarios, ids } = api;
    expect(await temPapel(banco, usuarios.escalante, ids.secao, CADASTRO, hoje)).toBe(true);
    expect(await temPapel(banco, usuarios.escalante, ids.gb, CADASTRO, hoje)).toBe(false);
  });

  it('gestor do 2º GB pode escrever na 1ª SB', async () => {
    const { banco, ids } = api;
    const gestor = await inserir(banco, 'usuario', { nome: 'GESTOR', email: 'gestor@exemplo.test', militar_id: await inserir(banco, 'militar', {
      matricula: '990904-4', posto_grad_id: (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'CAP BM'")).rows[0]!.id, nome_guerra: 'GESTOR',
    }) });
    await inserir(banco, 'papel_usuario', { usuario_id: gestor, unidade_id: ids.gb, papel: 'gestor', desde: '2026-01-01' });
    expect(await temPapel(banco, gestor, ids.secao, CADASTRO, hoje)).toBe(true);
    expect(await temPapel(banco, gestor, ids.raiz, CADASTRO, hoje)).toBe(false);
  });

  it('administrador da raiz pode tudo', async () => {
    const { banco, usuarios, ids } = api;
    for (const u of [ids.raiz, ids.gb, ids.secao]) expect(await temPapel(banco, usuarios.admin, u, ['administrador'], hoje)).toBe(true);
  });

  // dono do bloco do Pecúlio: papel numa unidade ACIMA da lotação (a unidade mãe ou mais alta), nunca na própria
  it('papel acima: o gestor do 2º GB e o administrador valem para a 1ª SB; o escalante da 1ª SB não vale para a 1ª SB', async () => {
    const { banco, usuarios, ids } = api;
    expect(await temPapelAcima(banco, usuarios.escalante, ids.secao, CADASTRO, hoje)).toBe(false);
    expect(await temPapelAcima(banco, usuarios.gestorGb, ids.secao, CADASTRO, hoje)).toBe(true);
    expect(await temPapelAcima(banco, usuarios.gestorGb, ids.gb, CADASTRO, hoje)).toBe(false);
    expect(await temPapelAcima(banco, usuarios.admin, ids.secao, CADASTRO, hoje)).toBe(true);
    expect(await temPapelAcima(banco, usuarios.admin, ids.gb, CADASTRO, hoje)).toBe(true);
    // a raiz não tem unidade acima
    expect(await temPapelAcima(banco, usuarios.admin, ids.raiz, CADASTRO, hoje)).toBe(false);
  });

  it('papel acima vencido não vale', async () => {
    const { banco, usuarios, ids } = api;
    expect(await temPapelAcima(banco, usuarios.gestorGb, ids.secao, CADASTRO, '2020-01-15')).toBe(false);
  });

  it('papel vencido não vale', async () => {
    const { banco, usuarios, ids } = api;
    expect(await temPapel(banco, usuarios.escalante, ids.secao, CADASTRO, '2020-01-15')).toBe(false);
  });
});

describe('rotas protegidas', () => {
  it('sem sessão é 401', async () => {
    expect((await api.app.request(`http://localhost:8787/api/teste/${api.ids.secao}`)).status).toBe(401);
  });

  it('militar comum entra mas não tem papel de cadastro', async () => {
    const r = await api.pedir('semPapel', 'GET', `/api/teste/${api.ids.secao}`);
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Esta tela é dos auxiliares administrativos e gestores.');
  });

  it('escalante fora da unidade dele é 403 com a sigla', async () => {
    const r = await api.pedir('escalante', 'GET', `/api/teste/${api.ids.gb}`);
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toBe('Você não tem permissão nos cadastros de 2º GB.');
  });

  it('escalante na unidade dele passa', async () => {
    expect((await api.pedir('escalante', 'GET', `/api/teste/${api.ids.secao}`)).status).toBe(200);
  });

  it('unidade inexistente é 404', async () => {
    expect((await api.pedir('admin', 'GET', '/api/teste/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('nome repetido vira 409 legível', async () => {
    const r = await api.pedir('admin', 'POST', '/api/teste/conflito');
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Já existe um cadastro com esse nome.');
  });
});

describe('unidade do registro', () => {
  it('unidadeDoRegistro de militar usa a lotação mais recente', async () => {
    const { banco, ids } = api;
    const m = (await banco.query<{ id: string }>("select id from militar where matricula = '990903-3'")).rows[0]!.id;
    await inserir(banco, 'rastreio', { militar_id: m, unidade_id: ids.gb, jornada: 'adm', desde: '2026-01-01', ate: '2026-10-31' });
    await inserir(banco, 'rastreio', { militar_id: m, unidade_id: ids.secao, jornada: 'pronto', desde: '2026-11-01' });
    expect(await unidadeDoRegistro(banco, 'militar', m)).toBe(ids.secao);
    expect(await unidadeDoRegistro(banco, 'militar', '00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('eu', () => {
  it('eu traz as unidades acessíveis e a lotação (o militar comum sem lotação não tem nenhuma)', async () => {
    const api2 = await montarApi();
    try {
      const r = await api2.pedir('semPapel', 'GET', '/api/eu');
      expect(r.status).toBe(200);
      const eu = await r.json();
      expect(eu.papeis).toEqual([]);
      expect(eu).toMatchObject({ unidades: [], lotacao: null });
      const dela = await (await api2.pedir('escalante', 'GET', '/api/eu')).json();
      expect(dela.unidades).toEqual([{ id: api2.ids.secao, sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4 }]);
    } finally {
      await api2.fechar();
    }
  });
});
