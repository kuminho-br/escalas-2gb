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
