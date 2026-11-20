import type { EfetivoDoDia, MetaDoDia, VersaoDaMetaPadrao } from 'contratos';
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
const gravarDia = (data: string, guarnicoes: string[], quem: 'admin' | 'escalante' | 'semPapel' = 'admin') =>
  api.pedir(quem, 'PUT', `${secao()}/meta-do-dia/${data}`, { guarnicoes });
const desativar = (data: string, guarnicaoId: string, quem: 'admin' | 'escalante' | 'semPapel' = 'escalante') =>
  api.pedir(quem, 'POST', `${secao()}/meta-do-dia/${data}/desativar`, { guarnicaoId });
const desfazer = (data: string, corpo: unknown, quem: 'admin' | 'escalante' | 'semPapel' = 'escalante') =>
  api.pedir(quem, 'POST', `${secao()}/meta-do-dia/${data}/desfazer-desativacao`, corpo);

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  const funcao = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  const modelo = async (nome: string) =>
    (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: HOJE.slice(0, 7), versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [{ funcaoId: funcao, minimo: 1, maximo: 3, cnhExigida: null }] } })).json()).id as string;
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
  it('grava o dia com a lista própria, e mudar a meta padrão depois não muda esse dia', async () => {
    const r = await gravarDia(dia(41), [aco]);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ data: dia(41), origem: 'dia', guarnicoes: [{ guarnicaoId: aco, nome: 'ACO' }] });
    expect(await metaDe(dia(42))).toMatchObject({ origem: 'padrao' });

    expect((await gravarPadrao(dia(41), [resgate])).status).toBe(200);
    expect(await metaDe(dia(41))).toMatchObject({ origem: 'dia', guarnicoes: [{ nome: 'ACO' }] });
    expect(nomes(await metaDe(dia(43)))).toEqual(['Resgate']);
    expect(nomes(await metaDe(dia(39)))).toEqual(['ACO', 'ABT']);
  });

  it('"até" no corpo é ignorado: grava só o dia da rota', async () => {
    const r = await api.pedir('admin', 'PUT', `${secao()}/meta-do-dia/${dia(60)}`, { ate: dia(62), guarnicoes: [abt] });
    expect(r.status).toBe(200);
    expect(await metaDe(dia(60))).toMatchObject({ origem: 'dia' });
    expect(await metaDe(dia(61))).toMatchObject({ origem: 'padrao' });
  });

  it('grava um dia só', async () => {
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
  it('o escalante lê, grava a meta do dia e volta ao padrão, mas não grava a meta padrão', async () => {
    expect((await api.pedir('escalante', 'GET', `${secao()}/meta-padrao`)).status).toBe(200);
    expect((await gravarPadrao(dia(200), [abt], 'escalante')).status).toBe(403);
    expect((await gravarDia(dia(200), [abt], 'escalante')).status).toBe(200);
    expect(await metaDe(dia(200))).toMatchObject({ origem: 'dia' });
    expect((await api.pedir('escalante', 'DELETE', `${secao()}/meta-do-dia/${dia(200)}`)).status).toBe(200);
    expect(await metaDe(dia(200))).toMatchObject({ origem: 'padrao' });
  });

  it('o militar sem papel não lê nem grava', async () => {
    expect((await api.pedir('semPapel', 'GET', `${secao()}/meta-padrao`)).status).toBe(403);
    expect((await api.pedir('semPapel', 'GET', `${secao()}/meta-do-dia/${dia(1)}`)).status).toBe(403);
    expect((await gravarPadrao(dia(200), [abt], 'semPapel')).status).toBe(403);
    expect((await gravarDia(dia(200), [abt], 'semPapel')).status).toBe(403);
    expect((await desativar(dia(200), abt, 'semPapel')).status).toBe(403);
    expect((await desfazer(dia(200), {}, 'semPapel')).status).toBe(403);
  });

  it('outra seção é 403 para o escalante da 1ª SB', async () => {
    const o = `/api/unidades/${outraSecao}`;
    expect((await api.pedir('escalante', 'GET', `${o}/meta-padrao`)).status).toBe(403);
    expect((await api.pedir('escalante', 'GET', `${o}/meta-do-dia/${dia(1)}`)).status).toBe(403);
    expect((await api.pedir('escalante', 'PUT', `${o}/meta-padrao`, { desde: dia(1), guarnicoes: [] })).status).toBe(403);
  });
});

describe('desativar e desfazer (Review Focus 1 a 4)', () => {
  let escala: string;
  let pronto: string;
  let turno: string;
  let funcao: string;
  let cheia: string;
  const militares: Record<string, string> = {};
  const alocar = (militar: string, data: string, guarnicao: string | null) =>
    inserir(api.banco, 'alocacao', { militar_id: militares[militar], escala_id: escala, servico_id: pronto, turno_id: turno, data, guarnicao_id: guarnicao, funcao_id: guarnicao ? funcao : null, origem: 'manual' });
  const existe = async (tabela: string, id: string) => (await api.banco.query(`select 1 from ${tabela} where id = $1`, [id])).rows.length === 1;
  /** onde o militar está no dia: [guarnição, função]; sem alocação, null */
  const alocacaoDe = async (militar: string, data: string) =>
    (await api.banco.query<{ id: string; guarnicao_id: string | null }>('select id, guarnicao_id from alocacao where militar_id = $1 and data = $2::date', [militares[militar], data])).rows[0] ?? null;
  const acumulosDe = async (militar: string, data: string) =>
    (
      await api.banco.query<{ guarnicao_id: string }>(
        'select x.guarnicao_id from alocacao_acumulo x join alocacao a on a.id = x.alocacao_id where a.militar_id = $1 and a.data = $2::date order by x.guarnicao_id',
        [militares[militar], data],
      )
    ).rows.map((r) => r.guarnicao_id);
  const marcas = async (militar: string, data: string) => (await api.banco.query('select 1 from remocao where militar_id = $1 and data = $2::date', [militares[militar], data])).rows.length;
  const corpoDe = async (r: Response) =>
    (await r.json()) as { efetivo: EfetivoDoDia; desfazer: { alocacoes: unknown[]; acumulos: unknown[]; promovidas: unknown[]; metaAntes: { origem: string; guarnicoes: string[] } } };

  beforeAll(async () => {
    // a partir do dia 300, a meta padrão é [ABT, Resgate]
    expect((await gravarPadrao(dia(300), [abt, resgate])).status).toBe(200);
    funcao = (await api.banco.query<{ id: string }>("select id from funcao where unidade_id = $1 and nome = 'Motorista'", [api.ids.secao])).rows[0]!.id;
    pronto = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Plantão', tipo: 'ordinario', cor: '#2F8F5B' });
    turno = await inserir(api.banco, 'turno', { servico_id: pronto, letra: 'A', inicio: '08:00', fim: '20:00' });
    escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id as string;
    expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [pronto] })).status).toBe(200);
    const posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-M', nome: 'Soldado M', ordem: 930 });
    for (const [i, nome] of ['ALFA', 'BRAVO', 'CHARLIE'].entries()) {
      militares[nome] = await inserir(api.banco, 'militar', { matricula: `99091${i}-${i}`, posto_grad_id: posto, nome_guerra: nome });
      await inserir(api.banco, 'lotacao', { militar_id: militares[nome], unidade_id: api.ids.secao, jornada: 'pronto', desde: '2026-01-01' });
    }
    // quem é de outra seção (para o corpo forjado do "Desfazer")
    militares.FORA = await inserir(api.banco, 'militar', { matricula: '990919-9', posto_grad_id: posto, nome_guerra: 'FORA' });
    await inserir(api.banco, 'lotacao', { militar_id: militares.FORA, unidade_id: outraSecao, jornada: 'pronto', desde: '2026-01-01' });
    // um modelo de uma vaga só e os vínculos de todos à faixa 08–20 da escala (o "Desfazer" passa pelas regras de escalar)
    const c = await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, {
      nome: 'Cheia', vigencia: HOJE.slice(0, 7), versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [{ funcaoId: funcao, minimo: 1, maximo: 1, cnhExigida: null }] },
    });
    cheia = (await c.json()).id as string;
    const v = await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/vinculos/${HOJE.slice(0, 7)}`, { itens: [abt, aco, resgate, cheia].map((guarnicaoId) => ({ guarnicaoId, inicio: '08:00', fim: '20:00' })) });
    expect(v.status).toBe(200);
  });

  it('desativar sem ninguém: o dia que seguia o padrão passa a ter meta própria sem ela, e o dia seguinte não muda', async () => {
    const r = await desativar(dia(301), abt);
    expect(r.status).toBe(200);
    const c = await corpoDe(r);
    expect(c.desfazer.alocacoes).toEqual([]);
    expect(c.desfazer.metaAntes.origem).toBe('padrao');
    expect(await metaDe(dia(301))).toMatchObject({ origem: 'dia', guarnicoes: [{ nome: 'Resgate' }] });
    expect(nomes(await metaDe(dia(302)))).toEqual(['ABT', 'Resgate']);
  });

  it('desativar a última guarnição deixa o dia sem meta', async () => {
    expect((await gravarDia(dia(303), [abt])).status).toBe(200);
    expect((await desativar(dia(303), abt)).status).toBe(200);
    expect(await metaDe(dia(303))).toEqual({ data: dia(303), origem: 'dia', guarnicoes: [] });
  });

  it('guarnição que não está na meta do dia é 409 com o motivo', async () => {
    expect((await gravarDia(dia(307), [resgate])).status).toBe(200);
    const r = await desativar(dia(307), abt);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Esta guarnição não está na meta deste dia.');
  });

  // Regra do usuário (20/11/2026): desativar tira o militar só da guarnição desativada, nos dois sentidos; a original e a acumulada têm o mesmo peso
  it('desativar a original tira o militar só dela: o acúmulo passa a ser a vaga dele', async () => {
    const d = dia(320);
    expect((await gravarDia(d, [abt, resgate])).status).toBe(200);
    const alfa = await alocar('ALFA', d, abt);
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alfa, guarnicao_id: resgate, funcao_id: funcao });
    const r = await desativar(d, abt);
    expect(r.status).toBe(200);
    const c = await corpoDe(r);
    expect(await alocacaoDe('ALFA', d)).toEqual({ id: alfa, guarnicao_id: resgate });
    expect(await acumulosDe('ALFA', d)).toEqual([]);
    expect(await marcas('ALFA', d)).toBe(0);
    expect(c.desfazer.alocacoes).toEqual([]);
    expect(c.desfazer.acumulos).toEqual([]);
    expect(c.desfazer.promovidas).toEqual([{ alocacaoId: alfa, guarnicaoId: abt, funcaoId: funcao, acumuloGuarnicaoId: resgate, acumuloFuncaoId: funcao }]);
    expect(nomes(await metaDe(d))).toEqual(['Resgate']);
  });

  it('desativar a acumulada tira só o acúmulo', async () => {
    const d = dia(321);
    expect((await gravarDia(d, [abt, resgate])).status).toBe(200);
    const bravo = await alocar('BRAVO', d, resgate);
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: bravo, guarnicao_id: abt, funcao_id: funcao });
    const c = await corpoDe(await desativar(d, abt));
    expect(await alocacaoDe('BRAVO', d)).toEqual({ id: bravo, guarnicao_id: resgate });
    expect(await acumulosDe('BRAVO', d)).toEqual([]);
    expect(await marcas('BRAVO', d)).toBe(0);
    expect(c.desfazer.alocacoes).toEqual([]);
    expect(c.desfazer.promovidas).toEqual([]);
    expect(c.desfazer.acumulos).toEqual([{ alocacaoId: bravo, guarnicaoId: abt, funcaoId: funcao }]);
  });

  it('quem está só na desativada sai, com a marca de remoção', async () => {
    const d = dia(322);
    expect((await gravarDia(d, [abt, resgate])).status).toBe(200);
    await alocar('CHARLIE', d, abt);
    const c = await corpoDe(await desativar(d, abt));
    expect(await alocacaoDe('CHARLIE', d)).toBeNull();
    expect(await marcas('CHARLIE', d)).toBe(1);
    expect(c.desfazer.alocacoes).toHaveLength(1);
    expect(c.desfazer.promovidas).toEqual([]);
  });

  it('com dois acúmulos fora, o primeiro (na ordem da composição da meta) vira a vaga e o outro continua acúmulo', async () => {
    const d = dia(323);
    expect((await gravarDia(d, [abt, resgate, aco])).status).toBe(200);
    const alfa = await alocar('ALFA', d, abt);
    // o ACO é gravado antes do Resgate: a ordem que vale é a da meta (Resgate vem antes do ACO), não a da gravação
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alfa, guarnicao_id: aco, funcao_id: funcao });
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alfa, guarnicao_id: resgate, funcao_id: funcao });
    const c = await corpoDe(await desativar(d, abt));
    expect(await alocacaoDe('ALFA', d)).toEqual({ id: alfa, guarnicao_id: resgate });
    expect(await acumulosDe('ALFA', d)).toEqual([aco]);
    expect(c.desfazer.promovidas).toEqual([{ alocacaoId: alfa, guarnicaoId: abt, funcaoId: funcao, acumuloGuarnicaoId: resgate, acumuloFuncaoId: funcao }]);
  });

  it('desfazer devolve cada um onde estava (Review Focus 1)', async () => {
    const d = dia(324);
    expect((await gravarDia(d, [abt, resgate])).status).toBe(200);
    const alfa = await alocar('ALFA', d, abt);
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alfa, guarnicao_id: resgate, funcao_id: funcao });
    const bravo = await alocar('BRAVO', d, resgate);
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: bravo, guarnicao_id: abt, funcao_id: funcao });
    await alocar('CHARLIE', d, abt);
    const c = await corpoDe(await desativar(d, abt));
    const r = await desfazer(d, c.desfazer);
    expect(r.status).toBe(200);
    expect(await alocacaoDe('ALFA', d)).toEqual({ id: alfa, guarnicao_id: abt });
    expect(await acumulosDe('ALFA', d)).toEqual([resgate]);
    expect(await alocacaoDe('BRAVO', d)).toEqual({ id: bravo, guarnicao_id: resgate });
    expect(await acumulosDe('BRAVO', d)).toEqual([abt]);
    expect((await alocacaoDe('CHARLIE', d))?.guarnicao_id).toBe(abt);
    expect(await marcas('ALFA', d)).toBe(0);
    expect(await marcas('CHARLIE', d)).toBe(0);
    expect(await metaDe(d)).toMatchObject({ origem: 'dia' });
    expect(nomes(await metaDe(d))).toEqual(['ABT', 'Resgate']);
    expect(((await r.json()) as EfetivoDoDia).meta.total).toBe(2);
  });

  it('desfazer com a vaga de antes ocupada é 409 e nada muda', async () => {
    const d = dia(325);
    expect((await gravarDia(d, [cheia, resgate])).status).toBe(200);
    const alfa = await alocar('ALFA', d, cheia);
    await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: alfa, guarnicao_id: resgate, funcao_id: funcao });
    const c = await corpoDe(await desativar(d, cheia));
    // a vaga da Cheia é só uma: enquanto isso, CHARLIE a ocupou
    const charlie = await alocar('CHARLIE', d, cheia);
    const r = await desfazer(d, c.desfazer);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Não deu para desfazer: alguém já ocupa um desses lugares.');
    expect(await alocacaoDe('ALFA', d)).toEqual({ id: alfa, guarnicao_id: resgate });
    expect(await acumulosDe('ALFA', d)).toEqual([]);
    expect(await existe('alocacao', charlie)).toBe(true);
    expect(nomes(await metaDe(d))).toEqual(['Resgate']);
  });

  it('desfazer num dia que seguia o padrão volta a seguir o padrão, não uma cópia dele (Review Focus 4)', async () => {
    const d = dia(310);
    const c = await corpoDe(await desativar(d, abt));
    expect((await metaDe(d)).origem).toBe('dia');
    expect((await desfazer(d, c.desfazer)).status).toBe(200);
    expect(await metaDe(d)).toMatchObject({ origem: 'padrao' });
    expect(nomes(await metaDe(d))).toEqual(['ABT', 'Resgate']);
  });

  it('desfazer com o lugar ocupado é 409 com a frase, e nada muda (nem a meta) (Review Focus 2)', async () => {
    const d = dia(311);
    expect((await gravarDia(d, [abt, resgate])).status).toBe(200);
    await alocar('ALFA', d, abt);
    const c = await corpoDe(await desativar(d, abt));
    // enquanto isso, alguém escalou o mesmo militar no mesmo serviço e turno
    const intruso = await alocar('ALFA', d, null);
    const r = await desfazer(d, c.desfazer);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('Não deu para desfazer: alguém já ocupa um desses lugares.');
    expect(nomes(await metaDe(d))).toEqual(['Resgate']);
    expect(await existe('alocacao', intruso)).toBe(true);
  });

  it('desfazer com escala de outra seção é 400', async () => {
    const d = dia(312);
    expect((await gravarDia(d, [abt])).status).toBe(200);
    await alocar('ALFA', d, abt);
    const c = await corpoDe(await desativar(d, abt));
    const alheia = (await (await api.pedir('admin', 'POST', `/api/unidades/${outraSecao}/escalas`, { nome: 'Alheia' })).json()).id as string;
    const adulterado = { ...c.desfazer, alocacoes: (c.desfazer.alocacoes as { escalaId: string }[]).map((x) => ({ ...x, escalaId: alheia })) };
    expect((await desfazer(d, adulterado)).status).toBe(400);
    expect(await alocacaoDe('ALFA', d)).toBeNull();
  });

  it('desfazer com a vaga já ocupada por outro militar é 409 com o motivo e nada muda: o "Desfazer" passa pelas regras de escalar (achado da revisão final)', async () => {
    const d = dia(315);
    expect((await gravarDia(d, [cheia])).status).toBe(200);
    await alocar('ALFA', d, cheia);
    const c = await corpoDe(await desativar(d, cheia));
    // a vaga é só uma: enquanto isso, CHARLIE a ocupou
    const charlie = await alocar('CHARLIE', d, cheia);
    const r = await desfazer(d, c.desfazer);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toMatch(/^Não deu para desfazer: /);
    expect(await alocacaoDe('ALFA', d)).toBeNull();
    expect(await existe('alocacao', charlie)).toBe(true);
    expect(nomes(await metaDe(d))).toEqual([]);
  });

  it('desfazer com um militar de outra seção no corpo é 409 e nada é criado (achado da revisão final)', async () => {
    const d = dia(316);
    expect((await gravarDia(d, [abt])).status).toBe(200);
    await alocar('ALFA', d, abt);
    const c = await corpoDe(await desativar(d, abt));
    const forjado = { ...c.desfazer, alocacoes: (c.desfazer.alocacoes as { militarId: string }[]).map((x) => ({ ...x, militarId: militares.FORA })) };
    const r = await desfazer(d, forjado);
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toMatch(/^Não deu para desfazer: /);
    expect(await alocacaoDe('FORA', d)).toBeNull();
    expect(nomes(await metaDe(d))).toEqual([]);
  });

  it('desfazer com um acúmulo pendurado numa alocação que não é desta seção e deste dia é 400 e nada muda (achado da revisão final)', async () => {
    const d = dia(317);
    expect((await gravarDia(d, [abt])).status).toBe(200);
    await alocar('ALFA', d, abt);
    const c = await corpoDe(await desativar(d, abt));
    const forjado = { ...c.desfazer, acumulos: [{ alocacaoId: '00000000-0000-4000-8000-000000000000', guarnicaoId: resgate, funcaoId: funcao }] };
    expect((await desfazer(d, forjado)).status).toBe(400);
    expect(await alocacaoDe('ALFA', d)).toBeNull();
    expect(nomes(await metaDe(d))).toEqual([]);
  });

  it('a meta de antes com o mesmo modelo duas vezes é 400', async () => {
    const d = dia(318);
    expect((await gravarDia(d, [abt])).status).toBe(200);
    const c = await corpoDe(await desativar(d, abt));
    const r = await desfazer(d, { ...c.desfazer, metaAntes: { origem: 'dia', guarnicoes: [abt, abt] } });
    expect(r.status).toBe(400);
  });

  it('o escalante desativa (200), o corpo inválido é 400', async () => {
    expect((await gravarDia(dia(313), [abt])).status).toBe(200);
    expect((await desativar(dia(313), abt, 'escalante')).status).toBe(200);
    expect((await api.pedir('escalante', 'POST', `${secao()}/meta-do-dia/${dia(314)}/desativar`, {})).status).toBe(400);
    expect((await desfazer(dia(314), { guarnicaoId: abt })).status).toBe(400);
  });
});
