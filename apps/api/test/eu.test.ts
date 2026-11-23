import type { UnidadeDeTrabalho } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste, type Quem } from './apoio-api.ts';

let api: ApiDeTeste;
const inicioDoMes = hojeRecife().slice(0, 7) + '-01';

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

type Resposta = { unidades: UnidadeDeTrabalho[]; lotacao: UnidadeDeTrabalho | null; unidade?: unknown };
const eu = async (quem: Quem): Promise<Resposta> => (await api.pedir(quem, 'GET', '/api/eu')).json();
const siglas = (l: UnidadeDeTrabalho[]) => l.map((u) => u.sigla);
const idDe = async (sigla: string) => (await api.banco.query<{ id: string }>('select id from unidade where sigla = $1', [sigla])).rows[0]!.id;

describe('GET /api/eu: unidades de trabalho e lotação', () => {
  it('o auxiliar da 1ª SB tem só a 1ª SB', async () => {
    const r = await eu('escalante');
    expect(r.unidades).toEqual([{ id: api.ids.secao, sigla: '1ª SB', caminho: expect.arrayContaining(['CBMPE', '2º GB', '1ª SB']), nivel: expect.any(Number) }]);
    const u = r.unidades[0]!;
    expect(u.caminho.at(0)).toBe('CBMPE');
    expect(u.caminho.at(-1)).toBe('1ª SB');
    expect(u.nivel).toBe(u.caminho.length - 1);
    // o campo antigo, da 1ª SB fixa, saiu
    expect(r.unidade).toBeUndefined();
  });

  it('o gestor do 2º GB tem o 2º GB e as sete seções, em ordem', async () => {
    const r = await eu('gestorGb');
    expect(siglas(r.unidades)).toEqual(['2º GB', '1ª SB', '2ª SB', '3ª SB', '4ª SB', '5ª SB', '6ª SB', '7ª SB']);
    expect(r.unidades[0]!.nivel).toBe(r.unidades[1]!.nivel - 1);
  });

  it('o administrador tem todas, a raiz primeiro', async () => {
    const r = await eu('admin');
    const todas = (await api.banco.query<{ n: number }>('select count(*)::int as n from unidade where ate is null')).rows[0]!.n;
    expect(r.unidades).toHaveLength(todas);
    expect(r.unidades[0]).toMatchObject({ sigla: 'CBMPE', nivel: 0, caminho: ['CBMPE'] });
  });

  it('papel em duas seções dá as duas (Review Focus 5)', async () => {
    await inserir(api.banco, 'papel_usuario', { usuario_id: api.usuarios.escalante, unidade_id: await idDe('2ª SB'), papel: 'escalante', desde: inicioDoMes });
    expect(siglas((await eu('escalante')).unidades)).toEqual(['1ª SB', '2ª SB']);
  });

  it('papel que já terminou não dá a unidade', async () => {
    await inserir(api.banco, 'papel_usuario', { usuario_id: api.usuarios.escalante, unidade_id: await idDe('3ª SB'), papel: 'escalante', desde: '2020-01-01', ate: '2020-12-31' });
    expect(siglas((await eu('escalante')).unidades)).not.toContain('3ª SB');
  });

  it('o militar comum tem a lotação de hoje, ou nada', async () => {
    const sem = await eu('semPapel');
    expect(sem).toMatchObject({ unidades: [], lotacao: null });
    const militarId = (await api.banco.query<{ militar_id: string }>('select militar_id from usuario where id = $1', [api.usuarios.semPapel])).rows[0]!.militar_id;
    await inserir(api.banco, 'rastreio', { militar_id: militarId, unidade_id: await idDe('4ª SB'), jornada: 'adm', desde: inicioDoMes });
    const com = await eu('semPapel');
    expect(com.lotacao).toMatchObject({ sigla: '4ª SB' });
    expect(com.unidades).toEqual([com.lotacao]);
  });

  it('quem tem papel também traz a lotação, e ela não entra nas unidades', async () => {
    const r = await eu('gestorGb');
    expect(r.lotacao).toBeNull();
    expect(siglas(r.unidades)).toContain('2º GB');
  });
});

describe('a própria ficha: GET /api/eu/ficha e PATCH /api/eu/telefone', () => {
  const ficha = async (quem: Quem) => (await api.pedir(quem, 'GET', '/api/eu/ficha')).json();
  const telefoneDe = async (matricula: string) => (await api.banco.query<{ t: string | null }>('select telefone as t from militar where matricula = $1', [matricula])).rows[0]!.t;

  it('o militar comum lê a própria ficha', async () => {
    const r = await api.pedir('semPapel', 'GET', '/api/eu/ficha');
    expect(r.status).toBe(200);
    const f = await r.json();
    expect(f).toMatchObject({ matricula: '990903-3', nomeGuerra: 'COMUM', postoGrad: 'SD BM', telefone: null, voluntarioJes: expect.any(Boolean), cnh: expect.any(Array) });
    expect(f).not.toHaveProperty('podeEditar');
    expect(f).not.toHaveProperty('antiguidade');
  });

  it('o auxiliar lê a própria ficha, não a de outro', async () => {
    const f = await ficha('escalante');
    expect(f.matricula).toBe('990902-2');
    expect(f.nomeGuerra).toBe('ESCALANTE');
    expect((await ficha('admin')).matricula).toBe('990901-1');
  });

  it('a situação de hoje vem da lotação', async () => {
    const m = (await api.banco.query<{ id: string }>("select id from militar where matricula = '990903-3'")).rows[0]!.id;
    await api.banco.query('delete from rastreio where militar_id = $1', [m]);
    await inserir(api.banco, 'rastreio', { militar_id: m, unidade_id: api.ids.secao, jornada: 'adm', desde: inicioDoMes });
    expect((await ficha('semPapel')).situacao).toMatchObject({ lotacao: '1ª SB', equipe: null, jornada: 'adm' });
  });

  it('traz o CPF, o endereço, o quadro e a situação de hoje, só para leitura', async () => {
    const m = (await api.banco.query<{ id: string }>("select id from militar where matricula = '990903-3'")).rows[0]!.id;
    await api.banco.query(
      "update militar set cpf = '52998224725', cep = '50030230', logradouro = 'Rua Fictícia', numero = '10', cidade = 'Recife', uf = 'PE', nascimento_ano = 1990, nascimento_dia = 5, nascimento_mes = 3 where id = $1",
      [m],
    );
    const f = await ficha('semPapel');
    expect(f.cpf).toBe('52998224725');
    expect(f.endereco).toEqual({ cep: '50030230', logradouro: 'Rua Fictícia', numero: '10', complemento: null, bairro: null, cidade: 'Recife', uf: 'PE' });
    expect(f.nascimento).toEqual({ dia: 5, mes: 3, ano: 1990 });
    const emHoje = await ficha('semPapel');
    expect(emHoje.situacao).toMatchObject({ situacaoDoMilitar: 'Ativa' });
    expect(emHoje.situacao).toHaveProperty('quadro');
  });

  it('altera o próprio telefone e fica na auditoria', async () => {
    const r = await api.pedir('semPapel', 'PATCH', '/api/eu/telefone', { telefone: '(81) 99999-0000' });
    expect(r.status).toBe(200);
    expect((await r.json()).telefone).toBe('(81) 99999-0000');
    expect(await telefoneDe('990903-3')).toBe('(81) 99999-0000');
    const { rows } = await api.banco.query<{ n: number }>(
      "select count(*)::int as n from auditoria where tabela = 'militar' and usuario_id = $1",
      [api.usuarios.semPapel],
    );
    expect(rows[0]!.n).toBeGreaterThan(0);
    // null limpa
    expect((await api.pedir('semPapel', 'PATCH', '/api/eu/telefone', { telefone: null })).status).toBe(200);
    expect(await telefoneDe('990903-3')).toBeNull();
  });

  it('telefone inválido é 400 no campo e não grava', async () => {
    for (const telefone of ['', '   ', '1'.repeat(21)]) {
      const r = await api.pedir('semPapel', 'PATCH', '/api/eu/telefone', { telefone });
      expect(r.status).toBe(400);
      expect(Object.keys((await r.json()).campos)).toEqual(['telefone']);
    }
    expect(await telefoneDe('990903-3')).toBeNull();
  });

  it('o corpo com outro campo além do telefone é 400', async () => {
    const r = await api.pedir('semPapel', 'PATCH', '/api/eu/telefone', { telefone: '123', nomeGuerra: 'OUTRO' });
    expect(r.status).toBe(400);
    expect((await api.banco.query<{ n: string }>("select nome_guerra as n from militar where matricula = '990903-3'")).rows[0]!.n).toBe('COMUM');
    expect(await telefoneDe('990903-3')).toBeNull();
  });

  it('sem sessão é 401', async () => {
    expect((await api.app.request('http://localhost:8787/api/eu/ficha')).status).toBe(401);
    expect((await api.app.request('http://localhost:8787/api/eu/telefone', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' }, body: '{"telefone":"1"}' })).status).toBe(401);
  });
});
