import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mesPorExtenso, somarMeses } from 'contratos';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

let api: ApiDeTeste;
const atual = hojeRecife().slice(0, 7);
const CAB = ['MATRÍCULA', 'NOME DE GUERRA', 'SEÇÃO', 'POSTO/GRAD', 'JORNADA', 'EQUIPE', 'ANTIG', 'MOTORISTA', 'VOLUNTÁRIO JES', 'CNH'];
const LINHAS: (string | number)[][] = [
  ['990201-1', 'ANDRADE', '1ª SB', 'SD BM', 'PRONTO', 'ALFA', 1, 'SIM', 'NÃO', 'B'],
  ['9902022', 'BARRETO', '1ª SB', '3º SGT BM', 'PRONTO', 'BRAVO', 2, '', 'SIM', ''],
  ['990203-3', 'CABRAL', '2ª SB', 'SD BM', 'PRONTO', 'ALFA', 3, '', '', ''],
  ['990204-4', 'DANTAS', '1ª SB', 'CB BM', 'ADM', '', '', 'NÃO', '', 'D'],
  ['990205-5', 'ESTEVES', '1ª SB', 'XYZ', 'ADM', '', '', '', '', ''],
  ['990206-6', 'FALCAO', '1ª SB', 'SD', 'ADM', '', 4, 'X', '', 'AD'],
];

const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;
async function importar(linhas: (string | number)[][], confirmar = false) {
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/militares${confirmar ? '?confirmar=1' : ''}`,
    formulario(await planilha({ MILITARES: [CAB, ...linhas] })));
  expect(r.status).toBe(200);
  return r.json();
}
const militar = async (matricula: string) =>
  (await api.banco.query<{ id: string; posto: string; motorista: boolean; cnh: string[]; voluntario_jes: boolean; antiguidade: number | null }>(
    'select m.id, p.sigla as posto, m.motorista, m.cnh, m.voluntario_jes, m.antiguidade from militar m join posto_grad p on p.id = m.posto_grad_id where matricula = $1',
    [matricula],
  )).rows[0];
const lotacoes = async (id: string) =>
  (await api.banco.query<{ equipe: string | null; jornada: string; desde: string; ate: string | null }>(
    `select e.nome as equipe, l.jornada, to_char(l.desde, 'YYYY-MM') as desde, to_char(l.ate, 'YYYY-MM-DD') as ate
       from lotacao l left join equipe e on e.id = l.equipe_id where l.militar_id = $1 order by l.desde`,
    [id],
  )).rows;

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('importação de militares', () => {
  it('prévia mostra novos, problemas e avisos sem gravar', async () => {
    const antes = await auditoria();
    const r = await importar(LINHAS);
    expect(r.novos.map((n: { chave: string }) => n.chave)).toEqual(['990201-1', '990202-2', '990204-4', '990206-6']);
    expect(r.problemas).toEqual([
      { aba: 'MILITARES', linha: 4, mensagem: 'Militar de outra seção (2ª SB).', solucao: 'Ele entra quando a seção dele for importada; aqui não é gravado.' },
      { aba: 'MILITARES', linha: 6, mensagem: 'Posto "XYZ" não existe.', solucao: expect.stringMatching(/^Use uma destas siglas: SD BM, CB BM/) },
    ]);
    expect(r.avisos).toEqual(expect.arrayContaining([
      'Matrícula 9902022 corrigida para 990202-2 (linha 3).',
      'DANTAS (990204-4): CNH ignorada, fora do quadro de motoristas.',
      'Equipes novas: ALFA, BRAVO.',
    ]));
    expect(await auditoria()).toBe(antes);
  });

  it('importa militares, equipes e lotações', async () => {
    const r = await importar(LINHAS, true);
    expect(r.gravados).toBe(4);
    expect(await militar('990201-1')).toMatchObject({ posto: 'SD BM', motorista: true, cnh: ['B'], antiguidade: 1 });
    expect(await militar('990202-2')).toMatchObject({ posto: '3º SGT BM', voluntario_jes: true, motorista: false });
    expect(await militar('990204-4')).toMatchObject({ motorista: false, cnh: [], antiguidade: null });
    expect(await militar('990206-6')).toMatchObject({ posto: 'SD BM', motorista: true, cnh: ['A', 'D'] });
    expect(await militar('990203-3')).toBeUndefined();
    const andrade = await militar('990201-1');
    expect(await lotacoes(andrade!.id)).toEqual([{ equipe: 'ALFA', jornada: 'pronto', desde: atual, ate: null }]);
    const equipes = (await api.banco.query<{ nome: string; ordem_ciclo: number }>('select nome, ordem_ciclo from equipe where unidade_id = $1 order by ordem_ciclo', [api.ids.secao])).rows;
    expect(equipes).toEqual([{ nome: 'ALFA', ordem_ciclo: 1 }, { nome: 'BRAVO', ordem_ciclo: 2 }]);
  });

  it('importar duas vezes não grava nada', async () => {
    const antes = await auditoria();
    const r = await importar(LINHAS, true);
    expect(r).toMatchObject({ novos: [], alterados: [], iguais: 4, gravados: 0 });
    expect(await auditoria()).toBe(antes);
  });

  it('mudança no mês corrente corrige a lotação do mês, sem criar outra', async () => {
    const linhas = LINHAS.map((l) => (l[0] === '990201-1' ? ['990201-1', 'ANDRADE', '1ª SB', 'CB BM', 'PRONTO', 'BRAVO', 1, 'SIM', 'NÃO', 'B'] : l));
    const previa = await importar(linhas);
    expect(previa.alterados).toEqual([{ chave: '990201-1', descricao: 'CB BM ANDRADE', mudancas: ['posto: SD BM → CB BM', 'equipe: ALFA → BRAVO'] }]);
    await importar(linhas, true);
    const andrade = await militar('990201-1');
    expect(await lotacoes(andrade!.id)).toEqual([{ equipe: 'BRAVO', jornada: 'pronto', desde: atual, ate: null }]);
  });

  it('mudança de equipe gera lotação nova', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const antigo = await inserir(api.banco, 'militar', { matricula: '990207-7', posto_grad_id: sd, nome_guerra: 'GUSMAO', antiguidade: 5 });
    await inserir(api.banco, 'lotacao', { militar_id: antigo, unidade_id: api.ids.secao, jornada: 'adm', desde: '2026-01-01' });
    await importar([...LINHAS, ['990207-7', 'GUSMAO', '1ª SB', 'SD BM', 'PRONTO', 'ALFA', 5, '', '', '']], true);
    expect(await lotacoes(antigo)).toEqual([
      { equipe: null, jornada: 'adm', desde: '2026-01', ate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      { equipe: 'ALFA', jornada: 'pronto', desde: atual, ate: null },
    ]);
  });

  it('militar do sistema fora da planilha só gera aviso', async () => {
    const r = await importar(LINHAS.slice(0, 2));
    expect(r.avisos).toContain('3 militares do sistema não estão na planilha (nada foi apagado).');
  });

  it('matrícula repetida na planilha vira problema', async () => {
    const r = await importar([LINHAS[0]!, LINHAS[0]!]);
    expect(r.problemas).toEqual([
      { aba: 'MILITARES', linha: 3, mensagem: 'Matrícula 990201-1 repetida na planilha.', solucao: 'Deixe uma linha só por militar.' },
    ]);
  });

  it('reimportar não desfaz a transferência marcada para o mês seguinte', async () => {
    const proximo = somarMeses(atual, 1);
    const linha = ['990209-9', 'IVO', '1ª SB', 'SD BM', 'PRONTO', 'ALFA', 9, '', '', ''];
    await importar([...LINHAS, linha], true);
    const ivo = await militar('990209-9');
    const bravo = (await api.banco.query<{ id: string }>("select id from equipe where nome = 'BRAVO'")).rows[0]!.id;
    // o escalante marca a ida para BRAVO no mês que vem; a planilha continua dizendo ALFA
    const r = await api.pedir('escalante', 'POST', `/api/militares/${ivo!.id}/lotacoes`, { unidadeId: api.ids.secao, equipeId: bravo, jornada: 'pronto', desde: proximo });
    expect(r.status).toBe(201);
    const res = await importar([...LINHAS, linha], true);
    expect(res.alterados.find((x: { chave: string }) => x.chave === '990209-9')).toBeUndefined();
    expect((await lotacoes(ivo!.id)).map((l) => [l.equipe, l.desde])).toEqual([['ALFA', atual], ['BRAVO', proximo]]);
    // se a planilha pedir outra equipe para este mês, avisa e não mexe
    const outra = await importar([...LINHAS, ['990209-9', 'IVO', '1ª SB', 'SD BM', 'ADM', '', 9, '', '', '']]);
    expect(outra.avisos).toContain(`IVO (990209-9): tem transferência marcada para ${mesPorExtenso(proximo)}; a lotação não foi mudada.`);
  });

  it('militar lotado em outra seção vira problema e não é trazido', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '3ª SB', nome: '3ª Seção', mae_id: api.ids.gb, desde: '2026-11-01' });
    const m = await inserir(api.banco, 'militar', { matricula: '990208-8', posto_grad_id: sd, nome_guerra: 'HOLANDA', antiguidade: 1 });
    await inserir(api.banco, 'lotacao', { militar_id: m, unidade_id: outra, jornada: 'adm', desde: '2026-01-01' });
    const r = await importar([['990208-8', 'HOLANDA', '1ª SB', 'CB BM', 'ADM', '', 1, '', '', '']], true);
    expect(r.problemas).toEqual([
      { aba: 'MILITARES', linha: 2, mensagem: 'HOLANDA (990208-8) está lotado na 3ª SB.', solucao: 'Ele entra aqui quando a transferência for registrada por quem cuida da 3ª SB.' },
    ]);
    expect((await militar('990208-8'))!.posto).toBe('SD BM');
  });
});
