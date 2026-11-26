import type { ResultadoDaBusca } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { menorCaminhoUnico, rotulosDasUnidades, unidadesDoCaminho, type UnidadeDoCaminho } from '../src/importacao/caminho-da-unidade.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// 6.62, Task 3: a unidade dos militares na busca pelo menor caminho que a identifica ("2º GB / 1ª SB"). Dados fictícios (D7).
let api: ApiDeTeste;
const hoje = hojeRecife();
const dia1 = `${hoje.slice(0, 7)}-01`;
const buscar = async (texto: string): Promise<ResultadoDaBusca> => (await api.pedir('admin', 'POST', '/api/consulta/militares/buscar', { texto })).json();

beforeAll(async () => {
  api = await montarApi();
  // um 3º GB, irmão do 2º GB, com uma "1ª SB" também: a sigla se repete na corporação
  const mae = (await api.banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [api.ids.gb])).rows[0]!.mae_id;
  const gb3 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '3º GB', nome: 'Terceiro Grupamento', mae_id: mae, desde: '2020-01-01' });
  const sb3 = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '1ª SB', nome: 'Primeira Seção do 3º GB', mae_id: gb3, desde: '2020-01-01' });
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const militar = async (nome: string, matricula: string, unidade: string) => {
    const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: posto, nome_guerra: nome, antiguidade: 1 });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: unidade, jornada: 'adm', desde: dia1 });
  };
  await militar('NOGB2', '990801-1', api.ids.secao);
  await militar('NOGB3', '990802-2', sb3);
  await militar('NOGB', '990803-3', api.ids.gb);
  const sem = await inserir(api.banco, 'militar', { matricula: '990804-4', posto_grad_id: posto, nome_guerra: 'SEMLOTA', antiguidade: 1 });
  expect(sem).toBeTruthy();
});
afterAll(async () => {
  await api.fechar();
});

describe('a unidade pelo menor caminho na busca', () => {
  it('Review Focus 4: duas "1ª SB" em GBs diferentes saem distintas ("2º GB / 1ª SB" e "3º GB / 1ª SB"); a sigla única continua só a sigla', async () => {
    const r = await buscar('NOGB');
    const de = (n: string) => r.militares.find((m) => m.nomeGuerra === n)!;
    expect(de('NOGB2').lotacaoCaminho).toBe('2º GB / 1ª SB');
    expect(de('NOGB3').lotacaoCaminho).toBe('3º GB / 1ª SB');
    expect(de('NOGB').lotacaoCaminho).toBe('2º GB');
    // a `lotacao` de hoje continua como era (a sigla só)
    expect(de('NOGB2').lotacao).toBe('1ª SB');
  });

  it('sem lotação hoje, o caminho é null', async () => {
    const r = await buscar('SEMLOTA');
    expect(r.militares[0]).toMatchObject({ nomeGuerra: 'SEMLOTA', lotacao: null, lotacaoCaminho: null });
  });

  it('o caminho é o mesmo da exportação (menorCaminhoUnico) para cada unidade', async () => {
    const todas = await unidadesDoCaminho(api.banco, hoje);
    const r = await buscar('NOGB');
    for (const m of r.militares) {
      const u = todas.find((x) => x.id === m.unidadeId)!;
      expect(m.lotacaoCaminho).toBe(menorCaminhoUnico(u, todas));
    }
  });
});

describe('rotulosDasUnidades (o menorCaminhoUnico de todas de uma vez)', () => {
  const u = (id: string, ...siglas: string[]): UnidadeDoCaminho => ({ id, siglas });
  const TODAS = [
    u('r', 'CBMPE'), u('d', 'CBMPE', 'DGO'), u('i', 'CBMPE', 'DGO', 'DInter/1'), u('g2', 'CBMPE', 'DGO', 'DInter/1', '2º GB'), u('s2', 'CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'),
    u('c2', 'CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB', '1ª Seção'), u('g3', 'CBMPE', 'DGO', 'DInter/1', '3º GB'), u('s3', 'CBMPE', 'DGO', 'DInter/1', '3º GB', '1ª SB'),
    u('c3', 'CBMPE', 'DGO', 'DInter/1', '3º GB', '1ª SB', '1ª Seção'), u('x', 'CBMPE', 'DGO', 'DInter/1', '3º GB', '1ª sb', 'Outra'),
  ];

  it('dá a cada unidade o mesmo rótulo que menorCaminhoUnico daria', () => {
    const rotulos = rotulosDasUnidades(TODAS);
    expect(rotulos.size).toBe(TODAS.length);
    for (const unidade of TODAS) expect(rotulos.get(unidade.id), unidade.id).toBe(menorCaminhoUnico(unidade, TODAS));
    expect(rotulos.get('s2')).toBe('2º GB / 1ª SB');
    expect(rotulos.get('r')).toBe('CBMPE');
  });
});
