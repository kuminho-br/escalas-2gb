import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mesPorExtenso, somarMeses } from 'contratos';
import { hojeRecife } from '../src/datas.ts';
import { IMPORTADORES } from '../src/importacao/registro.ts';
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
// o gestor do 2º GB (papel acima da seção) cadastra por esta importação; o escalante só da seção importa os campos da escala de quem já existe
async function importar(linhas: (string | number)[][], confirmar = false, quem: 'gestorGb' | 'escalante' = 'gestorGb') {
  const r = await api.pedir(quem, 'POST', `/api/unidades/${api.ids.secao}/importacao/militares${confirmar ? '?confirmar=1' : ''}`,
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
       from rastreio l left join equipe e on e.id = l.equipe_id where l.militar_id = $1 order by l.desde`,
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
      'Equipes novas: ALFA, BRAVO.',
    ]));
    // a CNH é do militar: DANTAS (MOTORISTA = NÃO, CNH D) entra sem problema e sem aviso de CNH ignorada
    expect(r.avisos.filter((a: string) => /CNH/.test(a))).toEqual([]);
    expect(r.problemas.some((p: { linha: number }) => p.linha === 5)).toBe(false);
    expect(await auditoria()).toBe(antes);
  });

  it('importa militares, equipes e lotações', async () => {
    const r = await importar(LINHAS, true);
    expect(r.gravados).toBe(4);
    expect(await militar('990201-1')).toMatchObject({ posto: 'SD BM', motorista: true, cnh: ['B'], antiguidade: 1 });
    expect(await militar('990202-2')).toMatchObject({ posto: '3º SGT BM', voluntario_jes: true, motorista: false });
    expect(await militar('990204-4')).toMatchObject({ motorista: false, cnh: ['D'], antiguidade: null });
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
    // o posto é do Pecúlio: a planilha da seção só avisa; a equipe (da escala) é corrigida
    expect(previa.alterados).toEqual([{ chave: '990201-1', descricao: 'SD BM ANDRADE', mudancas: ['equipe: ALFA → BRAVO'] }]);
    expect(previa.avisos).toContain('ANDRADE (990201-1): posto CB BM na planilha e SD BM no sistema. Este campo é do Pecúlio: altere pela importação do Pecúlio ou pela ficha.');
    await importar(linhas, true);
    const andrade = await militar('990201-1');
    expect(andrade).toMatchObject({ posto: 'SD BM' });
    expect(await lotacoes(andrade!.id)).toEqual([{ equipe: 'BRAVO', jornada: 'pronto', desde: atual, ate: null }]);
  });

  it('mudança de equipe gera lotação nova', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const antigo = await inserir(api.banco, 'militar', { matricula: '990207-7', posto_grad_id: sd, nome_guerra: 'GUSMAO', antiguidade: 5 });
    await inserir(api.banco, 'rastreio', { militar_id: antigo, unidade_id: api.ids.secao, jornada: 'adm', desde: '2026-01-01' });
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
    const r = await api.pedir('escalante', 'POST', `/api/militares/${ivo!.id}/situacao`, { unidadeId: api.ids.secao, equipeId: bravo, jornada: 'pronto', desde: proximo });
    expect(r.status).toBe(201);
    const res = await importar([...LINHAS, linha], true);
    expect(res.alterados.find((x: { chave: string }) => x.chave === '990209-9')).toBeUndefined();
    expect((await lotacoes(ivo!.id)).map((l) => [l.equipe, l.desde])).toEqual([['ALFA', atual], ['BRAVO', proximo]]);
    // se a planilha pedir outra equipe para este mês, avisa e não mexe
    const outra = await importar([...LINHAS, ['990209-9', 'IVO', '1ª SB', 'SD BM', 'ADM', '', 9, '', '', '']]);
    expect(outra.avisos).toContain(`IVO (990209-9): tem transferência marcada para ${mesPorExtenso(proximo)}; a lotação não foi mudada.`);
  });

  it('antiguidade repetida na planilha vira aviso e as linhas entram', async () => {
    const r = await importar([
      ['990230-0', 'XAVIER', '1ª SB', 'SD BM', 'ADM', '', 50, '', '', ''],
      ['990231-1', 'YURI', '1ª SB', 'SD BM', 'ADM', '', 50, '', '', ''],
    ]);
    expect(r.avisos).toContain('Antiguidade 50 repetida na planilha: XAVIER (990230-0) e YURI (990231-1).');
    expect(r.novos.map((n: { chave: string }) => n.chave)).toEqual(['990230-0', '990231-1']);
  });

  it('prévia avisa antiguidade repetida com militar fora da planilha', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const m = await inserir(api.banco, 'militar', { matricula: '990215-5', posto_grad_id: sd, nome_guerra: 'FORADAPLANILHA', antiguidade: 4321 });
    await inserir(api.banco, 'rastreio', { militar_id: m, unidade_id: api.ids.secao, jornada: 'adm', desde: '2026-01-01' });
    const r = await importar([['990216-6', 'NOVATO', '1ª SB', 'SD BM', 'ADM', '', 4321, '', '', '']]);
    expect(r.avisos).toContain('NOVATO (990216-6): antiguidade 4321 repetida com FORADAPLANILHA (já no sistema, fora da planilha).');
  });

  it('militar lotado em outra seção vira problema e não é trazido', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '3ª SB', nome: '3ª Seção', mae_id: api.ids.gb, desde: '2026-11-01' });
    const m = await inserir(api.banco, 'militar', { matricula: '990208-8', posto_grad_id: sd, nome_guerra: 'HOLANDA', antiguidade: 1 });
    await inserir(api.banco, 'rastreio', { militar_id: m, unidade_id: outra, jornada: 'adm', desde: '2026-01-01' });
    const r = await importar([['990208-8', 'HOLANDA', '1ª SB', 'CB BM', 'ADM', '', 1, '', '', '']], true);
    expect(r.problemas).toEqual([
      { aba: 'MILITARES', linha: 2, mensagem: 'HOLANDA (990208-8) está lotado na 3ª SB.', solucao: 'Ele entra aqui quando a transferência for registrada por quem cuida da 3ª SB.' },
    ]);
    expect((await militar('990208-8'))!.posto).toBe('SD BM');
  });

  it('militar com lotação marcada só para o futuro em outra seção também é problema, e nada dele é gravado', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '4ª SB', nome: '4ª Seção', mae_id: api.ids.gb, desde: '2026-11-01' });
    const m = await inserir(api.banco, 'militar', { matricula: '990219-9', posto_grad_id: sd, nome_guerra: 'FUTURO', antiguidade: 7 });
    await inserir(api.banco, 'rastreio', { militar_id: m, unidade_id: outra, jornada: 'adm', desde: `${somarMeses(atual, 1)}-01` });
    const linha = ['990219-9', 'MUDADO PELA PRIMEIRA', '1ª SB', 'CB BM', 'ADM', '', 1, 'SIM', 'SIM', 'D'];
    const previa = await importar([linha]);
    expect(previa.problemas).toEqual([
      { aba: 'MILITARES', linha: 2, mensagem: 'MUDADO PELA PRIMEIRA (990219-9) está lotado na 4ª SB.', solucao: 'Ele entra aqui quando a transferência for registrada por quem cuida da 4ª SB.' },
    ]);
    await importar([linha], true);
    expect(await militar('990219-9')).toMatchObject({ posto: 'SD BM', antiguidade: 7, voluntario_jes: false, motorista: false });
    expect((await lotacoes(m)).map((l) => l.jornada)).toEqual(['adm']);
  });

  it('antiguidade grande demais na planilha vira aviso e a linha entra sem antiguidade, sem erro do banco', async () => {
    const linha = ['990972-2', 'GIGANTE', '1ª SB', 'SD BM', 'ADM', '', '3000000000', '', '', ''];
    const previa = await importar([linha]);
    expect(previa.avisos).toContain('GIGANTE (990972-2): antiguidade "3000000000" ignorada (use um número de 1 a 99999).');
    const r = await importar([linha], true);
    expect(r.gravados).toBe(1);
    expect((await militar('990972-2'))!.antiguidade).toBeNull();
  });
});

describe('CNH repetida ou fora de ordem na planilha (Review Focus 5)', () => {
  const REPETIDAS: (string | number)[][] = [
    ['990295-5', 'GOMES', '1ª SB', 'SD BM', 'ADM', '', 5, 'SIM', '', 'B, B'],
    ['990296-6', 'HONORATO', '1ª SB', 'SD BM', 'ADM', '', 6, 'SIM', '', 'DA'],
  ];

  it('"B, B" entra uma vez só, "DA" entra em ordem (A, D), e a prévia não reclama de nada', async () => {
    const previa = await importar(REPETIDAS);
    expect(previa.problemas).toEqual([]);
    expect(previa.avisos.filter((a: string) => /CNH/.test(a))).toEqual([]);
    expect((await importar(REPETIDAS, true)).gravados).toBe(2);
    expect(await militar('990295-5')).toMatchObject({ motorista: true, cnh: ['B'] });
    expect(await militar('990296-6')).toMatchObject({ motorista: true, cnh: ['A', 'D'] });
  });
});

describe('CNH de quem não está no quadro de motoristas', () => {
  it('a importação aceita CNH com MOTORISTA = NÃO, sem problema nem aviso, e a CNH fica gravada', async () => {
    const linha = ['990298-8', 'GOMES', '1ª SB', 'SD BM', 'ADM', '', '', 'NÃO', '', 'AD'];
    const previa = await importar([linha]);
    expect(previa.problemas).toEqual([]);
    expect(previa.avisos.filter((a: string) => /CNH/.test(a))).toEqual([]);
    await importar([linha], true);
    expect(await militar('990298-8')).toMatchObject({ motorista: false, cnh: ['A', 'D'] });
    // importar de novo a mesma planilha não muda nada
    expect((await importar([linha])).iguais).toBe(1);
  });
});

describe('dono por bloco na importação de militares (Review Focus 3)', () => {
  const FRASE = 'Este campo é do Pecúlio: altere pela importação do Pecúlio ou pela ficha.';
  const BASE: (string | number)[] = ['990401-1', 'ANDRADE', '1ª SB', 'SD BM', 'PRONTO', 'ALFA', 9101, 'NÃO', 'NÃO', ''];

  it('o escalante da seção não muda posto, nome de guerra nem antiguidade de quem já existe: a prévia avisa e os campos da escala da linha entram', async () => {
    await importar([BASE], true);
    const mudada: (string | number)[] = ['990401-1', 'OUTRONOME', '1ª SB', 'CB BM', 'PRONTO', 'BRAVO', 9102, 'SIM', 'SIM', 'D'];
    const previa = await importar([mudada], false, 'escalante');
    expect(previa.problemas).toEqual([]);
    // o que é da escala entra na lista de mudanças; o do Pecúlio, não
    const mudancas: string[] = previa.alterados[0].mudancas;
    expect(mudancas).toEqual(expect.arrayContaining(['motorista: não → sim', 'CNH: nenhuma → D', 'voluntário JES: não → sim']));
    expect(mudancas.some((m) => /^(posto|nome de guerra|antiguidade):/.test(m))).toBe(false);
    // um aviso por campo do Pecúlio que a planilha traz diferente
    const doPeculio = previa.avisos.filter((a: string) => a.includes(FRASE));
    expect(doPeculio).toHaveLength(3);
    expect(doPeculio.join(' | ')).toContain('posto CB BM na planilha e SD BM no sistema');
    expect(doPeculio.join(' | ')).toContain('nome de guerra OUTRONOME na planilha e ANDRADE no sistema');
    expect(doPeculio.join(' | ')).toContain('antiguidade 9102 na planilha e 9101 no sistema');
    expect((await importar([mudada], true, 'escalante')).gravados).toBe(1);
    const m = (await militar('990401-1'))!;
    expect(m).toMatchObject({ posto: 'SD BM', antiguidade: 9101, motorista: true, cnh: ['D'], voluntario_jes: true });
    expect((await api.banco.query<{ nome_guerra: string }>('select nome_guerra from militar where id = $1', [m.id])).rows[0]!.nome_guerra).toBe('ANDRADE');
    // a equipe é da escala: a lotação do mês foi corrigida para a BRAVO
    expect((await lotacoes(m.id)).map((l) => l.equipe)).toEqual(['BRAVO']);
  });

  it('a mesma linha só com os campos da escala (posto, nome e antiguidade iguais) não traz aviso', async () => {
    const igual: (string | number)[] = ['990401-1', 'ANDRADE', '1ª SB', 'SD BM', 'PRONTO', 'BRAVO', 9101, 'SIM', 'SIM', 'D'];
    const previa = await importar([igual], false, 'escalante');
    expect(previa.avisos.filter((a: string) => a.includes(FRASE))).toEqual([]);
    expect(previa).toMatchObject({ novos: [], alterados: [], iguais: 1 });
  });

  it('linha de militar novo com o escalante só da seção é problema com o papel de cima; o gestor do 2º GB cadastra', async () => {
    const nova: (string | number)[] = ['990402-2', 'NOVATO', '1ª SB', 'SD BM', 'ADM', '', 9103, 'NÃO', 'NÃO', ''];
    const doEscalante = await importar([nova], false, 'escalante');
    expect(doEscalante.novos).toEqual([]);
    expect(doEscalante.problemas).toEqual([
      { aba: 'MILITARES', linha: 2, mensagem: 'Cadastrar militar é de quem tem papel no 2º GB.', solucao: 'Peça a quem tem esse papel para importar a linha ou cadastre pela ficha.' },
    ]);
    expect((await importar([nova], true, 'escalante')).gravados).toBe(0);
    expect(await militar('990402-2')).toBeUndefined();
    const doGestor = await importar([nova], false, 'gestorGb');
    expect(doGestor.novos.map((n: { chave: string }) => n.chave)).toEqual(['990402-2']);
    expect((await importar([nova], true, 'gestorGb')).gravados).toBe(1);
    expect(await militar('990402-2')).toMatchObject({ posto: 'SD BM', antiguidade: 9103 });
  });

  // revisão final: lotar na seção quem existe mas está sem lotação também é do Pecúlio (a ficha trava a lotação para quem não tem o papel de cima)
  it('militar que já existe, sem lotação neste mês, não é lotado na seção pelo escalante só da seção; o gestor do 2º GB lota', async () => {
    const sd = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
    const semLotacao = await inserir(api.banco, 'militar', { matricula: '990403-3', posto_grad_id: sd, nome_guerra: 'SEMLOTACAO', antiguidade: 9201 });
    // o último período dele terminou há dois meses, na própria 1ª SB
    await inserir(api.banco, 'rastreio', { militar_id: semLotacao, unidade_id: api.ids.secao, jornada: 'adm', desde: `${somarMeses(atual, -4)}-01`, ate: `${somarMeses(atual, -2)}-28` });
    const linha: (string | number)[] = ['990403-3', 'SEMLOTACAO', '1ª SB', 'SD BM', 'ADM', '', 9201, 'NÃO', 'NÃO', ''];
    const doEscalante = await importar([linha], false, 'escalante');
    expect(doEscalante.problemas).toEqual([
      { aba: 'MILITARES', linha: 2, mensagem: 'Lotar SEMLOTACAO na 1ª SB é de quem tem papel no 2º GB.', solucao: 'Peça a quem tem esse papel para importar a linha.' },
    ]);
    expect(doEscalante.alterados).toEqual([]);
    expect((await importar([linha], true, 'escalante')).gravados).toBe(0);
    expect((await lotacoes(semLotacao)).map((l) => l.ate)).toEqual([`${somarMeses(atual, -2)}-28`]);
    const doGestor = await importar([linha], false, 'gestorGb');
    expect(doGestor.alterados.map((a: { chave: string }) => a.chave)).toEqual(['990403-3']);
    await importar([linha], true, 'gestorGb');
    expect((await lotacoes(semLotacao)).map((l) => [l.desde, l.ate])).toEqual([[`${somarMeses(atual, -4)}`, `${somarMeses(atual, -2)}-28`], [atual, null]]);
  });

  it('a ajuda do modelo diz que posto, nome de guerra e antiguidade de quem já existe vêm do Pecúlio', async () => {
    const colunas = IMPORTADORES.militares!.modelo.abas[0]!.colunas;
    for (const rotulo of ['POSTO/GRAD', 'NOME DE GUERRA', 'ANTIG']) {
      expect(colunas.find((c) => c.rotulo === rotulo)!.ajuda, rotulo).toContain('Pecúlio');
    }
  });
});
