import { mesPorExtenso, type Cota, type Feriado } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Serviços, escalas, cotas e feriados não são dados pessoais (D7); os nomes seguem a sandbox.
let api: ApiDeTeste;
let outraSecao: string;
const CAB_C = ['MÊS', 'SB', 'OPERAÇÃO', 'SERVIÇO', 'QUANTIDADE', 'ORIGEM', 'PRIORIDADE'];
const CAB_F = ['DATA', 'DESCRIÇÃO'];
type Celula = string | number | Date | null;
const MES = '2027-03';

const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;
async function importarCotas(linhas: Celula[][], confirmar = false, cab: string[] = CAB_C) {
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/cotas${confirmar ? '?confirmar=1' : ''}`, formulario(await planilha({ COTAS: [cab, ...linhas] })));
  expect(r.status).toBe(200);
  return r.json();
}
async function importarFeriados(linhas: Celula[][], confirmar = false, cab: string[] = CAB_F) {
  const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/feriados${confirmar ? '?confirmar=1' : ''}`, formulario(await planilha({ FERIADOS: [cab, ...linhas] })));
  expect(r.status).toBe(200);
  return r.json();
}
const cotas = async (mes: string): Promise<Cota[]> => (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/cotas?mes=${mes}`)).json();
const feriados = async (ano: number): Promise<Feriado[]> => (await api.pedir('escalante', 'GET', `/api/unidades/${api.ids.secao}/feriados?ano=${ano}`)).json();
const servico = (nome: string, tipo: string, operacao: string | null = null) =>
  inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome, tipo, operacao, cor: '#2F8F5B' });
async function escala(nome: string, servicos: string[]) {
  const id = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome, titulo: nome.toUpperCase(), militares_doc: 'todos', dias_doc: 'todos' });
  for (const [i, s] of servicos.entries()) await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, $3)', [id, s, i + 1]);
  return id;
}

beforeAll(async () => {
  api = await montarApi();
  outraSecao = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  const jes = await servico('JES', 'pjes');
  const peSeguro = await servico('PE Seguro', 'diaria', 'PE Seguro');
  const bioma = await servico('Bioma', 'diaria', 'Guardiões do Bioma');
  await servico('Pronto', 'ordinario');
  await escala('Plantão PE', [peSeguro]);
  await escala('Operação Mista', [jes, bioma]);
});
afterAll(async () => {
  await api.fechar();
});

describe('importação de cotas', () => {
  it('cota pela operação acha o serviço da diária (pelo atributo operação e pelo nome)', async () => {
    const linhas = [
      [MES, '1ª SB', 'Guardiões do Bioma', '', 8, 'interna', 1],
      [MES, '1ª SB', 'PE Seguro', '', 12, 'externa', 2],
    ];
    const previa = await importarCotas(linhas);
    expect(previa.problemas).toEqual([]);
    expect(previa.novos).toEqual([
      { chave: `${MES}|Bioma|interna`, descricao: `Bioma (interna) em ${mesPorExtenso(MES)}: 8` },
      { chave: `${MES}|PE Seguro|externa`, descricao: `PE Seguro (externa) em ${mesPorExtenso(MES)}: 12` },
    ]);
    expect((await importarCotas(linhas, true)).gravados).toBe(2);
    expect((await cotas(MES)).map((c) => [c.servico, c.origem, c.quantidade, c.prioridade, c.contaMeta])).toEqual([
      ['Bioma', 'interna', 8, 1, true],
      ['PE Seguro', 'externa', 12, 2, true],
    ]);
  });

  it('a operação pode ser o nome de uma escala com um serviço só', async () => {
    const previa = await importarCotas([['2027-04', '', 'Plantão PE', '', 5, '', 1]]);
    expect(previa.problemas).toEqual([]);
    expect(previa.novos[0].descricao).toContain('PE Seguro');
  });

  it('escala com vários serviços sem a coluna SERVIÇO vira problema com a solução do protótipo', async () => {
    const previa = await importarCotas([['2027-04', '', 'Operação Mista', '', 5, '', 1]]);
    expect(previa.problemas).toEqual([
      {
        aba: 'COTAS', linha: 2,
        mensagem: '"Operação Mista" agrupa 2 serviços (JES, Bioma). Escreva na coluna SERVIÇO da aba COTAS qual deles a cota paga (um só, o mesmo em todas as linhas da operação).',
        solucao: 'Corrija a linha na planilha e importe de novo.',
      },
    ]);
  });

  it('a coluna SERVIÇO vale mais que a OPERAÇÃO', async () => {
    const previa = await importarCotas([['2027-04', '', 'Operação Mista', 'JES', 30, 'interna', 1]]);
    expect(previa.problemas).toEqual([]);
    expect(previa.novos[0].descricao).toContain('JES');
  });

  it('cota de outra seção vira problema', async () => {
    const previa = await importarCotas([[MES, '2ª SB', 'PE Seguro', 'PE Seguro', 3, 'interna', 1]]);
    expect(previa.problemas).toEqual([
      { aba: 'COTAS', linha: 2, mensagem: 'Cota de outra seção: 2ª SB', solucao: 'Importe só as linhas da 1ª SB, ou tire esta linha.' },
    ]);
    expect(previa.novos).toEqual([]);
  });

  it('serviço ordinário e serviço que não existe viram problemas com a solução', async () => {
    const previa = await importarCotas([
      [MES, '', '', 'Pronto', 3, 'interna', 1],
      [MES, '', '', 'Fantasma', 3, 'interna', 1],
      [MES, '', 'Sem Nada Disso', '', 3, 'interna', 1],
    ]);
    expect(previa.problemas).toEqual([
      { aba: 'COTAS', linha: 2, mensagem: 'O serviço Pronto é ordinário: cota só existe para serviço PJES ou diária', solucao: 'Use um serviço PJES ou diária na coluna SERVIÇO.' },
      { aba: 'COTAS', linha: 3, mensagem: 'Serviço Fantasma não cadastrado', solucao: 'Cadastre o serviço na tela de Serviços (ou importe as abas TURNOS e ESCALAS) e importe de novo.' },
      { aba: 'COTAS', linha: 4, mensagem: 'Não achei o serviço da operação "Sem Nada Disso"', solucao: 'Escreva o nome do serviço na coluna SERVIÇO.' },
    ]);
  });

  it('origem vazia vira interna; externa e interna são reconhecidas; outro texto é problema', async () => {
    const previa = await importarCotas([
      [MES, '', '', 'JES', 1, '', 1],
      ['2027-05', '', '', 'JES', 1, 'Externa', 1],
      ['2027-06', '', '', 'JES', 1, 'interna', 1],
      ['2027-07', '', '', 'JES', 1, 'talvez', 1],
    ]);
    expect(previa.problemas).toEqual([{ aba: 'COTAS', linha: 5, mensagem: 'Origem "talvez" de JES', solucao: 'Use INTERNA ou EXTERNA na coluna ORIGEM.' }]);
    expect(previa.novos.map((n: { descricao: string }) => n.descricao.match(/\((\w+)\)/)![1])).toEqual(['interna', 'externa', 'interna']);
  });

  it('quantidade inválida é problema; zero é ignorado com aviso', async () => {
    const previa = await importarCotas([
      [MES, '', '', 'JES', 'abc', '', 1],
      [MES, '', '', 'JES', '2,5', '', 1],
      [MES, '', '', 'JES', -3, '', 1],
      [MES, '', '', 'JES', 0, '', 1],
    ]);
    expect(previa.problemas.map((p: { linha: number }) => p.linha)).toEqual([2, 3, 4]);
    expect(previa.problemas[0]).toEqual({ aba: 'COTAS', linha: 2, mensagem: 'Quantidade "abc" de JES', solucao: 'Use um número inteiro de 1 a 10000 na coluna QUANTIDADE.' });
    expect(previa.avisos).toContain('JES (interna) em março de 2027 tem quantidade 0: a linha foi ignorada.');
    expect(previa.novos).toEqual([]);
  });

  it('linha sem serviço nem operação, e prioridade fora do limite, viram problemas', async () => {
    const previa = await importarCotas([
      [MES, '', '', '', 3, '', 1],
      [MES, '', '', 'JES', 3, '', 'alta'],
      [MES, '', '', 'JES', 3, '', 5000],
    ]);
    expect(previa.problemas).toEqual([
      { aba: 'COTAS', linha: 2, mensagem: 'Cota sem serviço nem operação', solucao: 'Preencha a coluna SERVIÇO (ou OPERAÇÃO).' },
      { aba: 'COTAS', linha: 3, mensagem: 'Prioridade "alta" de JES', solucao: 'Use um número inteiro de 1 a 1000 na coluna PRIORIDADE.' },
      { aba: 'COTAS', linha: 4, mensagem: 'Prioridade "5000" de JES', solucao: 'Use um número inteiro de 1 a 1000 na coluna PRIORIDADE.' },
    ]);
  });

  it('prioridade vazia segue a ordem das linhas do mês', async () => {
    const previa = await importarCotas([
      ['2027-08', '', '', 'JES', 4, '', ''],
      ['2027-08', '', '', 'Bioma', 4, '', ''],
      ['2027-08', '', '', 'PE Seguro', 4, '', 9],
    ]);
    expect(previa.problemas).toEqual([]);
    await importarCotas([
      ['2027-08', '', '', 'JES', 4, '', ''],
      ['2027-08', '', '', 'Bioma', 4, '', ''],
      ['2027-08', '', '', 'PE Seguro', 4, '', 9],
    ], true);
    expect((await cotas('2027-08')).map((c) => [c.servico, c.prioridade])).toEqual([['JES', 1], ['Bioma', 2], ['PE Seguro', 9]]);
  });

  it('o mês aceita aaaa-mm, mm/aaaa e a data que o Planilhas faz; outro texto é problema', async () => {
    const previa = await importarCotas([
      ['2027-09', '', '', 'JES', 1, '', 1],
      ['10/2027', '', '', 'JES', 1, '', 1],
      [new Date(Date.UTC(2027, 10, 1)), '', '', 'JES', 1, '', 1],
      ['setembro', '', '', 'JES', 1, '', 1],
      ['', '', '', 'JES', 1, '', 1],
    ]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['2027-09|JES|interna', '2027-10|JES|interna', '2027-11|JES|interna']);
    expect(previa.problemas).toEqual([
      { aba: 'COTAS', linha: 5, mensagem: 'Mês "setembro" de JES', solucao: 'Use aaaa-mm ou mm/aaaa na coluna MÊS.' },
      { aba: 'COTAS', linha: 6, mensagem: 'Mês vazio em JES', solucao: 'Preencha o mês na coluna MÊS.' },
    ]);
  });

  it('linha repetida do mesmo serviço e origem no mês vira problema (vale a primeira)', async () => {
    const previa = await importarCotas([
      ['2027-12', '', '', 'JES', 5, 'interna', 1],
      ['2027-12', '', '', 'JES', 6, 'interna', 2],
    ]);
    expect(previa.novos).toHaveLength(1);
    expect(previa.problemas).toEqual([
      { aba: 'COTAS', linha: 3, mensagem: 'Cota repetida: JES (interna) em dezembro de 2027', solucao: 'Some as quantidades numa linha só.' },
    ]);
  });

  it('falta a coluna QUANTIDADE: problema e nada planejado', async () => {
    const previa = await importarCotas([[MES, '', '', 'JES', 1]], false, ['MÊS', 'SB', 'OPERAÇÃO', 'SERVIÇO']);
    expect(previa.problemas).toEqual([{ aba: 'COTAS', linha: 1, mensagem: 'Falta a coluna QUANTIDADE.', solucao: 'Use o modelo desta tela.' }]);
    expect(previa.novos).toEqual([]);
  });

  it('falta o serviço e a operação: problema (uma das duas colunas é preciso)', async () => {
    const previa = await importarCotas([[MES, 1]], false, ['MÊS', 'QUANTIDADE']);
    expect(previa.problemas).toEqual([{ aba: 'COTAS', linha: 1, mensagem: 'Falta a coluna SERVIÇO (ou OPERAÇÃO).', solucao: 'Use o modelo desta tela.' }]);
  });

  it('mudar a quantidade e a prioridade aparece como alterado e atualiza', async () => {
    const mes = '2028-01';
    await importarCotas([[mes, '', '', 'JES', 10, '', 2]], true);
    const previa = await importarCotas([[mes, '', '', 'JES', 14, '', 1]]);
    expect(previa.alterados).toEqual([
      { chave: `${mes}|JES|interna`, descricao: `JES (interna) em ${mesPorExtenso(mes)}`, mudancas: ['quantidade: 10 → 14', 'prioridade: 2 → 1'] },
    ]);
    await importarCotas([[mes, '', '', 'JES', 14, '', 1]], true);
    expect((await cotas(mes))[0]).toMatchObject({ quantidade: 14, prioridade: 1 });
  });

  it('o que a tela guardou e a planilha não traz (conta para a meta) não muda na importação', async () => {
    const mes = '2028-02';
    await importarCotas([[mes, '', '', 'JES', 10, '', 1]], true);
    const c = (await cotas(mes))[0]!;
    await api.pedir('escalante', 'PATCH', `/api/cotas/${c.id}`, { contaMeta: false });
    await importarCotas([[mes, '', '', 'JES', 12, '', 1]], true);
    expect((await cotas(mes))[0]).toMatchObject({ quantidade: 12, contaMeta: false });
  });

  // [foco 1]
  it('importar duas vezes não grava nada (nem auditoria)', async () => {
    const linhas = [['2028-03', '', '', 'Bioma', 7, '', 1], ['2028-03', '', '', 'JES', 9, 'externa', 2]];
    await importarCotas(linhas, true);
    const antes = await auditoria();
    const previa = await importarCotas(linhas);
    expect(previa.novos).toEqual([]);
    expect(previa.alterados).toEqual([]);
    expect(previa.iguais).toBe(2);
    expect((await importarCotas(linhas, true)).gravados).toBe(0);
    expect(await auditoria()).toBe(antes);
  });

  it('quem não tem papel na seção não importa', async () => {
    const r = await api.pedir('semPapel', 'POST', `/api/unidades/${api.ids.secao}/importacao/cotas`, formulario(await planilha({ COTAS: [CAB_C] })));
    expect(r.status).toBe(403);
    const o = await api.pedir('escalante', 'POST', `/api/unidades/${outraSecao}/importacao/cotas`, formulario(await planilha({ COTAS: [CAB_C] })));
    expect(o.status).toBe(403);
  });
});

describe('importação de feriados', () => {
  it('Carnaval entra como móvel com aviso, e os demais ficam fixos', async () => {
    const linhas = [
      ['01/05/2026', 'Dia do Trabalho'],
      ['17/02/2026', 'Carnaval'],
      ['18/02/2026', 'Quarta-feira de Cinzas'],
      ['03/04/2026', 'Sexta-feira da Paixão'],
      ['04/06/2026', 'Corpus Christi'],
    ];
    const previa = await importarFeriados(linhas);
    expect(previa.problemas).toEqual([]);
    expect(previa.avisos).toEqual(['Marcado como móvel: Carnaval', 'Marcado como móvel: Quarta-feira de Cinzas', 'Marcado como móvel: Sexta-feira da Paixão', 'Marcado como móvel: Corpus Christi']);
    expect((await importarFeriados(linhas, true)).gravados).toBe(5);
    expect((await feriados(2026)).map((f) => [f.data, f.fixo])).toEqual([
      ['2026-02-17', false], ['2026-02-18', false], ['2026-04-03', false], ['2026-05-01', true], ['2026-06-04', false],
    ]);
  });

  it('a Sexta-feira Santa e a Páscoa também são móveis', async () => {
    const previa = await importarFeriados([['03/04/2027', 'Sexta-feira Santa'], ['28/03/2027', 'Páscoa']]);
    expect(previa.avisos).toEqual(['Marcado como móvel: Sexta-feira Santa', 'Marcado como móvel: Páscoa']);
  });

  it('a data aceita dd/mm/aaaa, aaaa-mm-dd e a data do Planilhas; texto e dia que não existe são problemas', async () => {
    const previa = await importarFeriados([
      ['07/09/2027', 'Independência do Brasil'],
      ['2027-10-12', 'Nossa Senhora Aparecida'],
      [new Date(Date.UTC(2027, 10, 2)), 'Finados'],
      ['31/02/2027', 'Impossível'],
      ['depois do carnaval', 'Texto'],
      ['', 'Sem data'],
    ]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['2027-09-07', '2027-10-12', '2027-11-02']);
    expect(previa.problemas).toEqual([
      { aba: 'FERIADOS', linha: 5, mensagem: 'Data "31/02/2027" de Impossível', solucao: 'Use dd/mm/aaaa (ex.: 07/09/2026) na coluna DATA.' },
      { aba: 'FERIADOS', linha: 6, mensagem: 'Data "depois do carnaval" de Texto', solucao: 'Use dd/mm/aaaa (ex.: 07/09/2026) na coluna DATA.' },
      { aba: 'FERIADOS', linha: 7, mensagem: 'Data vazia em Sem data', solucao: 'Preencha a coluna DATA (dd/mm/aaaa).' },
    ]);
  });

  it('descrição vazia é problema', async () => {
    const previa = await importarFeriados([['09/07/2027', '']]);
    expect(previa.problemas).toEqual([{ aba: 'FERIADOS', linha: 2, mensagem: 'Feriado de 09/07/2027 sem descrição', solucao: 'Preencha a coluna DESCRIÇÃO.' }]);
  });

  it('data repetida na planilha vale a primeira, com aviso', async () => {
    const previa = await importarFeriados([['15/11/2027', 'Proclamação da República'], ['15/11/2027', 'Outro nome']]);
    expect(previa.novos).toHaveLength(1);
    expect(previa.avisos).toContain('15/11/2027 aparece mais de uma vez: vale "Proclamação da República".');
  });

  it('feriado que a unidade de cima já tem não é repetido na seção', async () => {
    await inserir(api.banco, 'feriado', { unidade_id: api.ids.raiz, data: '2027-12-25', descricao: 'Natal', fixo: true });
    const previa = await importarFeriados([['25/12/2027', 'Natal'], ['24/12/2027', 'Véspera de Natal']]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['2027-12-24']);
    expect(previa.iguais).toBe(1);
    expect(previa.avisos).toContain('1 feriado já vem de uma unidade acima e não foi repetido.');
  });

  it('mudar só a descrição de um feriado que já existe aparece como alterado e não mexe no fixo', async () => {
    const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/feriados`, { data: '2029-04-21', descricao: 'Tiradentes', fixo: false });
    expect(r.status).toBe(201);
    expect((await importarFeriados([['21/04/2029', 'Tiradentes']])).iguais).toBe(1);
    const previa = await importarFeriados([['21/04/2029', 'Dia de Tiradentes']]);
    expect(previa.alterados).toEqual([{ chave: '2029-04-21', descricao: '21/04/2029', mudancas: ['descrição: "Tiradentes" → "Dia de Tiradentes"'] }]);
    await importarFeriados([['21/04/2029', 'Dia de Tiradentes']], true);
    expect((await feriados(2029)).find((f) => !f.herdado)).toMatchObject({ descricao: 'Dia de Tiradentes', fixo: false });
  });

  // [foco 1]
  it('importar duas vezes não grava nada (nem auditoria)', async () => {
    const linhas = [['02/01/2030', 'Dia de teste'], ['05/03/2030', 'Carnaval']];
    await importarFeriados(linhas, true);
    const antes = await auditoria();
    const previa = await importarFeriados(linhas);
    expect(previa.novos).toEqual([]);
    expect(previa.alterados).toEqual([]);
    expect(previa.iguais).toBe(2);
    expect((await importarFeriados(linhas, true)).gravados).toBe(0);
    expect(await auditoria()).toBe(antes);
  });

  it('falta a coluna DATA: problema e nada planejado', async () => {
    const previa = await importarFeriados([['Natal']], false, ['DESCRIÇÃO']);
    expect(previa.problemas).toEqual([{ aba: 'FERIADOS', linha: 1, mensagem: 'Falta a coluna DATA.', solucao: 'Use o modelo desta tela.' }]);
    expect(previa.novos).toEqual([]);
  });

  it('quem não tem papel na seção não importa', async () => {
    const r = await api.pedir('semPapel', 'POST', `/api/unidades/${api.ids.secao}/importacao/feriados`, formulario(await planilha({ FERIADOS: [CAB_F] })));
    expect(r.status).toBe(403);
  });
});
