import type { MetaDoDia, VersaoDaMetaPadrao } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7): modelos ABT, ACO e Resgate na 1ª SB, e um modelo "Alheia" na 2ª SB.
let api: ApiDeTeste;
let outraSecao: string;
let abt: string;
let aco: string;
let resgate: string;
let alheia: string;
const HOJE = hojeRecife();
const dia = (n: number): string => new Date(Date.parse(`${HOJE}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const secao = () => `/api/unidades/${api.ids.secao}`;
const nomes = (m: MetaDoDia) => m.guarnicoes.map((g) => g.nome);
const metaDe = async (data: string, quem: 'admin' | 'escalante' = 'escalante'): Promise<MetaDoDia> => {
  const r = await api.pedir(quem, 'GET', `${secao()}/meta-do-dia/${data}`);
  expect(r.status).toBe(200);
  return r.json();
};
const gravarPadrao = (desde: string, guarnicoes: string[], quem: 'admin' | 'escalante' | 'semPapel' = 'admin') =>
  api.pedir(quem, 'PUT', `${secao()}/meta-padrao`, { desde, guarnicoes });
const gravarDia = (data: string, guarnicoes: string[], ate?: string, quem: 'admin' | 'escalante' = 'admin') =>
  api.pedir(quem, 'PUT', `${secao()}/meta-do-dia/${data}`, ate ? { ate, guarnicoes } : { guarnicoes });

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  const funcao = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  const modelo = async (nome: string) =>
    (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: HOJE.slice(0, 7), versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [{ funcaoId: funcao, minimo: 1, maximo: 1, cnhExigida: null }] } })).json()).id as string;
  abt = await modelo('ABT');
  aco = await modelo('ACO');
  resgate = await modelo('Resgate');
  alheia = await inserir(api.banco, 'guarnicao', { unidade_id: outraSecao, nome: 'Alheia' });
});
afterAll(async () => {
  await api.fechar();
});

describe('sem nada gravado', () => {
  it('o dia vale a meta padrão, que está vazia', async () => {
    expect(await metaDe(dia(1))).toEqual({ data: dia(1), origem: 'padrao', guarnicoes: [] });
    const r = await api.pedir('escalante', 'GET', `${secao()}/meta-padrao`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([]);
  });
});

describe('meta padrão', () => {
  it('o gestor grava desde hoje e o dia seguinte recebe a lista, na ordem', async () => {
    const r = await gravarPadrao(HOJE, [resgate, abt]);
    expect(r.status).toBe(200);
    const versoes: VersaoDaMetaPadrao[] = await r.json();
    expect(versoes).toEqual([{ desde: HOJE, guarnicoes: [{ guarnicaoId: resgate, nome: 'Resgate' }, { guarnicaoId: abt, nome: 'ABT' }] }]);
    const m = await metaDe(dia(1));
    expect(m.origem).toBe('padrao');
    expect(nomes(m)).toEqual(['Resgate', 'ABT']);
  });

  it('uma versão com vigência futura não muda os dias antes dela e muda os de depois', async () => {
    expect((await gravarPadrao(dia(10), [abt])).status).toBe(200);
    expect(nomes(await metaDe(dia(9)))).toEqual(['Resgate', 'ABT']);
    expect(nomes(await metaDe(dia(10)))).toEqual(['ABT']);
    expect(nomes(await metaDe(dia(20)))).toEqual(['ABT']);
  });

  it('gravar de novo no mesmo "desde" substitui a lista, e as versões vêm da mais nova para a mais antiga', async () => {
    const r = await gravarPadrao(dia(10), [aco, abt]);
    const versoes: VersaoDaMetaPadrao[] = await r.json();
    expect(versoes.map((v) => v.desde)).toEqual([dia(10), HOJE]);
    expect(versoes[0]!.guarnicoes.map((g) => g.nome)).toEqual(['ACO', 'ABT']);
    expect(nomes(await metaDe(dia(10)))).toEqual(['ACO', 'ABT']);
    const lida: VersaoDaMetaPadrao[] = await (await api.pedir('escalante', 'GET', `${secao()}/meta-padrao`)).json();
    expect(lida).toEqual(versoes);
  });

  it('desde um dia que já passou é 400 no campo desde', async () => {
    const r = await gravarPadrao(dia(-1), [abt]);
    expect(r.status).toBe(400);
    expect((await r.json()).campos.desde).toBe('A meta padrão muda de hoje em diante.');
  });

  it('modelo de outra seção é 400 no campo guarnicoes', async () => {
    const r = await gravarPadrao(dia(5), [abt, alheia]);
    expect(r.status).toBe(400);
    expect((await r.json()).campos.guarnicoes).toBe('Use modelos de guarnição desta seção.');
    expect(nomes(await metaDe(dia(5)))).toEqual(['Resgate', 'ABT']);
  });

  it('o mesmo modelo duas vezes é 400, e o corpo sem data também', async () => {
    const r = await gravarPadrao(dia(5), [abt, abt]);
    expect(r.status).toBe(400);
    expect((await r.json()).campos.guarnicoes).toBe('Este modelo aparece duas vezes na meta.');
    expect((await api.pedir('admin', 'PUT', `${secao()}/meta-padrao`, { guarnicoes: [] })).status).toBe(400);
  });

  it('a gravação entra na auditoria', async () => {
    const { rows } = await api.banco.query<{ tabela: string }>("select distinct tabela from auditoria where tabela like 'meta_padrao%' order by tabela");
    expect(rows.map((r) => r.tabela)).toEqual(['meta_padrao_item', 'meta_padrao_versao']);
  });
});

describe('dia diferente', () => {
  it('grava os dias do intervalo com a lista própria, e mudar a meta padrão depois não muda esses dias', async () => {
    const r = await gravarDia(dia(40), [aco], dia(42));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: dia(40), origem: 'dia', guarnicoes: [{ guarnicaoId: aco, nome: 'ACO' }] });
    for (const n of [40, 41, 42]) expect(await metaDe(dia(n))).toMatchObject({ origem: 'dia', guarnicoes: [{ nome: 'ACO' }] });
    expect(await metaDe(dia(43))).toMatchObject({ origem: 'padrao' });

    expect((await gravarPadrao(dia(41), [resgate])).status).toBe(200);
    expect(await metaDe(dia(41))).toMatchObject({ origem: 'dia', guarnicoes: [{ nome: 'ACO' }] });
    expect(nomes(await metaDe(dia(43)))).toEqual(['Resgate']);
    expect(nomes(await metaDe(dia(39)))).toEqual(['ACO', 'ABT']);
  });

  it('só a data, sem "até", grava um dia só', async () => {
    expect((await gravarDia(dia(45), [abt, resgate])).status).toBe(200);
    expect(nomes(await metaDe(dia(45)))).toEqual(['ABT', 'Resgate']);
    expect(await metaDe(dia(46))).toMatchObject({ origem: 'padrao' });
  });

  it('gravar de novo no mesmo dia substitui a lista', async () => {
    await gravarDia(dia(45), [resgate]);
    expect(nomes(await metaDe(dia(45)))).toEqual(['Resgate']);
  });

  it('a lista vazia grava um dia sem meta', async () => {
    const r = await gravarDia(dia(50), []);
    expect(r.status).toBe(200);
    expect(await metaDe(dia(50))).toEqual({ data: dia(50), origem: 'dia', guarnicoes: [] });
  });

  it('"Voltar ao padrão" apaga a lista do dia', async () => {
    const r = await api.pedir('admin', 'DELETE', `${secao()}/meta-do-dia/${dia(50)}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ data: dia(50), origem: 'padrao', guarnicoes: [{ nome: 'Resgate' }] });
    expect(await metaDe(dia(50))).toMatchObject({ origem: 'padrao' });
  });

  it('"até" antes do dia é 400 em ate; 32 dias também; 31 dias passam', async () => {
    const antes = await gravarDia(dia(60), [abt], dia(59));
    expect(antes.status).toBe(400);
    expect((await antes.json()).campos.ate).toBe('O último dia não pode ser antes do primeiro.');
    const longo = await gravarDia(dia(60), [abt], dia(91));
    expect(longo.status).toBe(400);
    expect((await longo.json()).campos.ate).toBe('Altere no máximo 31 dias de uma vez.');
    expect((await gravarDia(dia(60), [abt], dia(90))).status).toBe(200);
    expect(await metaDe(dia(90))).toMatchObject({ origem: 'dia' });
    expect(await metaDe(dia(91))).toMatchObject({ origem: 'padrao' });
  });

  it('modelo de outra seção ou repetido é 400 também no dia', async () => {
    expect((await gravarDia(dia(100), [alheia])).status).toBe(400);
    expect((await gravarDia(dia(100), [abt, abt])).status).toBe(400);
    expect(await metaDe(dia(100))).toMatchObject({ origem: 'padrao' });
  });

  it('data inválida na rota é 400', async () => {
    expect((await api.pedir('escalante', 'GET', `${secao()}/meta-do-dia/2026-02-30`)).status).toBe(400);
    expect((await gravarDia('amanha', [])).status).toBe(400);
  });
});

describe('acesso', () => {
  it('o escalante lê e não grava', async () => {
    expect((await api.pedir('escalante', 'GET', `${secao()}/meta-padrao`)).status).toBe(200);
    expect((await gravarPadrao(dia(200), [abt], 'escalante')).status).toBe(403);
    expect((await gravarDia(dia(200), [abt], undefined, 'escalante')).status).toBe(403);
    expect((await api.pedir('escalante', 'DELETE', `${secao()}/meta-do-dia/${dia(40)}`)).status).toBe(403);
    expect(await metaDe(dia(200))).toMatchObject({ origem: 'padrao' });
  });

  it('o militar sem papel não lê nem grava', async () => {
    expect((await api.pedir('semPapel', 'GET', `${secao()}/meta-padrao`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `${secao()}/meta-do-dia/${dia(1)}`)).status).toBe(403);
    expect((await gravarPadrao(dia(200), [abt], 'semPapel')).status).toBe(403);
  });

  it('outra seção é 403 para o escalante da 1ª SB', async () => {
    const o = `/api/unidades/${outraSecao}`;
    expect((await api.pedir('escalante', 'GET', `${o}/meta-padrao`)).status).toBe(403);
    expect((await api.pedir('escalante', 'GET', `${o}/meta-do-dia/${dia(1)}`)).status).toBe(403);
    expect((await api.pedir('escalante', 'PUT', `${o}/meta-padrao`, { desde: dia(1), guarnicoes: [] })).status).toBe(403);
  });
});
