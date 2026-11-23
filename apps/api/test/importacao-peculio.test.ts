import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { lerPlanilha } from '../src/importacao/planilha.ts';
import { montarApi, type ApiDeTeste, type Quem } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.13: o Pecúlio é a origem dos dados do militar. Só a MATRÍCULA é obrigatória; célula vazia não mexe; célula inválida é ignorada,
// com o motivo na prévia, e as outras células da linha valem. Dados fictícios (D7): matrículas 990xxx-x e CPFs fictícios com dígitos válidos.
let api: ApiDeTeste;
let secao1: string;
const hoje = hojeRecife();
const atual = hoje.slice(0, 7);
const CAB = [
  'MATRÍCULA', 'POSTO/GRAD', 'NOME COMPLETO', 'NOME DE GUERRA', 'ANTIGUIDADE', 'SEXO', 'NASCIMENTO', 'TELEFONE', 'E-MAIL', 'COMPORTAMENTO', 'BOLETIM DO COMPORTAMENTO',
  'CPF', 'CEP', 'LOGRADOURO', 'NÚMERO', 'COMPLEMENTO', 'BAIRRO', 'CIDADE', 'UF', 'LOTAÇÃO', 'QUADRO', 'SITUAÇÃO', 'JORNADA', 'EQUIPE', 'MOTORISTA', 'CNH', 'VOLUNTÁRIO JES',
];
/** A planilha de antes desta entrega: 20 colunas, sem as sete novas. */
const CAB_DE_20 = CAB.slice(0, 20);
type Celula = string | number | Date;
type Linha = Record<string, Celula>;
const NOVO = (mat: string, guerra: string, extra: Linha = {}): Linha => ({
  'MATRÍCULA': mat, 'POSTO/GRAD': 'SD BM', 'NOME COMPLETO': `${guerra} de Tal`, 'NOME DE GUERRA': guerra, 'LOTAÇÃO': '1ª SB', ...extra,
});
const ANDRADE: Linha = {
  'MATRÍCULA': '990301-1', 'POSTO/GRAD': 'SD BM', 'NOME COMPLETO': 'João da Silva Andrade', 'NOME DE GUERRA': 'andrade', 'ANTIGUIDADE': 4001, 'SEXO': 'M', 'NASCIMENTO': '15/03',
  'TELEFONE': '(81) 99999-0001', 'E-MAIL': 'andrade@bombeiros.pe.gov.br', 'COMPORTAMENTO': 'Bom', 'BOLETIM DO COMPORTAMENTO': 'BG 01/2026', 'LOTAÇÃO': '1ª SB',
};
const LIMA: Linha = { 'MATRÍCULA': '990302-2', 'POSTO/GRAD': 'CB BM', 'NOME COMPLETO': 'Maria de Souza Lima', 'NOME DE GUERRA': 'LIMA', 'SEXO': 'F', 'NASCIMENTO': '29/02', 'LOTAÇÃO': '2ª SB' };

const modelo = (u: string) => `/api/unidades/${u}/importacao/peculio/modelo`;
const caminho = (u: string, confirmar = false) => `/api/unidades/${u}/importacao/peculio${confirmar ? '?confirmar=1' : ''}`;
const comoLinha = (cab: string[], l: Linha) => cab.map((c) => l[c] ?? '');
async function enviar(linhas: Linha[], { quem = 'gestorGb', u = api.ids.gb, confirmar = false, cab = CAB }: { quem?: Quem; u?: string; confirmar?: boolean; cab?: string[] } = {}) {
  return api.pedir(quem, 'POST', caminho(u, confirmar), formulario(await planilha({ 'PECÚLIO': [cab, ...linhas.map((l) => comoLinha(cab, l))] })));
}
async function importar(linhas: Linha[], confirmar = false, cab = CAB) {
  const r = await enviar(linhas, { confirmar, cab });
  expect(r.status).toBe(200);
  return r.json();
}
const militar = async (matricula: string) =>
  (await api.banco.query<Record<string, unknown>>(
    `select m.id, p.sigla as posto, m.nome_completo, m.nome_guerra, m.antiguidade, m.sexo, m.nascimento_dia, m.nascimento_mes, m.nascimento_ano, m.telefone, m.email,
            m.comportamento, m.comportamento_boletim, m.motorista, m.cnh, m.voluntario_jes, m.cpf, m.cep, m.logradouro, m.numero, m.complemento, m.bairro, m.cidade, m.uf
       from militar m join posto_grad p on p.id = m.posto_grad_id where m.matricula = $1`,
    [matricula],
  )).rows[0];
const rastreio = async (matricula: string) =>
  (await api.banco.query<{ sigla: string; equipe: string | null; jornada: string; quadro: string | null; situacao: string; desde: string; ate: string | null }>(
    `select un.sigla, e.nome as equipe, r.jornada, q.sigla as quadro, s.nome as situacao, to_char(r.desde, 'YYYY-MM-DD') as desde, to_char(r.ate, 'YYYY-MM-DD') as ate
       from rastreio r join militar m on m.id = r.militar_id join unidade un on un.id = r.unidade_id left join equipe e on e.id = r.equipe_id
       left join quadro q on q.id = r.quadro_id join situacao_militar s on s.id = r.situacao_id where m.matricula = $1 order by r.desde`,
    [matricula],
  )).rows;
const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;
type Ignorada = { linha: number; chave: string; coluna: string; motivo: string };
const colunasIgnoradas = (p: { ignoradas: Ignorada[] }, chave: string) => p.ignoradas.filter((i) => i.chave === chave).map((i) => i.coluna);

beforeAll(async () => {
  api = await montarApi();
  secao1 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
});
afterAll(async () => {
  await api.fechar();
});

describe('modelo do Pecúlio', () => {
  it('tem a aba PECÚLIO com as 27 colunas na ordem, só a MATRÍCULA obrigatória, e a AJUDA com a regra e os valores aceitos', async () => {
    const r = await api.pedir('gestorGb', 'GET', modelo(api.ids.gb));
    expect(r.status).toBe(200);
    const arquivo = await r.arrayBuffer();
    const lidas = await lerPlanilha(arquivo);
    expect(Object.keys(lidas)).toEqual(['PECÚLIO', 'AJUDA']);
    expect(lidas['PECÚLIO']!.cab).toEqual(CAB);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arquivo);
    const linhas: string[][] = [];
    wb.getWorksheet('AJUDA')!.eachRow((row) => linhas.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
    expect(linhas.filter((l) => l[0] === 'PECÚLIO' && l[2] === 'Obrigatória').map((l) => l[1])).toEqual(['MATRÍCULA']);
    const ajuda = linhas.flat().join('\n');
    expect(ajuda).toContain('Só a matrícula é obrigatória. Célula vazia não altera nada. Dado inválido é ignorado e aparece no resumo.');
    for (const valor of ['SD BM', '1ª SB', '7ª SB', 'QBMG', 'QOC', 'Ativa', 'Reserva', 'dd/mm/aaaa', 'PRONTO']) expect(ajuda, valor).toContain(valor);
  });
});

describe('importar o Pecúlio célula por célula (Task 1)', () => {
  it('linha nova cria o militar com os campos e a lotação na seção, a partir do mês atual, Pronto, sem equipe, sem nada da escala', async () => {
    const antes = await auditoria();
    const previa = await importar([ANDRADE, LIMA]);
    expect(previa.problemas).toEqual([]);
    expect(previa.ignoradas).toEqual([]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['990301-1', '990302-2']);
    expect(await auditoria()).toBe(antes);
    expect((await importar([ANDRADE, LIMA], true)).gravados).toBe(2);
    expect(await militar('990301-1')).toMatchObject({
      posto: 'SD BM', nome_completo: 'João da Silva Andrade', nome_guerra: 'ANDRADE', antiguidade: 4001, sexo: 'M', nascimento_dia: 15, nascimento_mes: 3,
      telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br', comportamento: 'Bom', comportamento_boletim: 'BG 01/2026', motorista: false, cnh: [], voluntario_jes: false,
    });
    expect(await rastreio('990301-1')).toEqual([{ sigla: '1ª SB', equipe: null, jornada: 'pronto', quadro: 'QBMG', situacao: 'Ativa', desde: `${atual}-01`, ate: null }]);
    expect(await rastreio('990302-2')).toEqual([expect.objectContaining({ sigla: '2ª SB', jornada: 'pronto', equipe: null })]);
  });

  it('importar o mesmo arquivo de novo não grava nada', async () => {
    expect(await importar([ANDRADE, LIMA])).toMatchObject({ novos: [], alterados: [], iguais: 2, problemas: [], ignoradas: [] });
    expect((await importar([ANDRADE, LIMA], true)).gravados).toBe(0);
  });

  it('planilha só com MATRÍCULA e TELEFONE altera o telefone e não toca em mais nada', async () => {
    const antes = await militar('990301-1');
    const previa = await importar([{ 'MATRÍCULA': '990301-1', 'TELEFONE': '(81) 98888-0002' }], true, ['MATRÍCULA', 'TELEFONE']);
    expect(previa.alterados).toEqual([{ chave: '990301-1', descricao: 'SD BM ANDRADE', mudancas: ['telefone: (81) 99999-0001 → (81) 98888-0002'] }]);
    expect(await militar('990301-1')).toEqual({ ...antes, telefone: '(81) 98888-0002' });
  });

  it('célula vazia em cada coluna não mexe no dado do banco', async () => {
    const antes = await militar('990301-1');
    const periodos = await rastreio('990301-1');
    const previa = await importar([{ 'MATRÍCULA': '990301-1' }], true);
    expect(previa).toMatchObject({ alterados: [], iguais: 1, ignoradas: [] });
    expect(await militar('990301-1')).toEqual(antes);
    expect(await rastreio('990301-1')).toEqual(periodos);
  });

  it('telefone inválido e e-mail fora do domínio na mesma linha são ignorados, com a coluna e o motivo, e o nome completo da linha é gravado', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990301-1', 'TELEFONE': '1'.repeat(21), 'E-MAIL': 'andrade@gmail.com', 'NOME COMPLETO': 'João Carlos da Silva Andrade' }], true);
    expect(previa.ignoradas).toEqual([
      { linha: 2, chave: '990301-1', coluna: 'TELEFONE', motivo: 'Use no máximo 20 caracteres.' },
      { linha: 2, chave: '990301-1', coluna: 'E-MAIL', motivo: 'Use o e-mail institucional (@bombeiros.pe.gov.br).' },
    ]);
    expect(previa.problemas).toEqual([]);
    expect(await militar('990301-1')).toMatchObject({ nome_completo: 'João Carlos da Silva Andrade', telefone: '(81) 98888-0002', email: 'andrade@bombeiros.pe.gov.br' });
  });

  it('posto que não existe, para quem já existe, é ignorado, e o posto atual fica', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990301-1', 'POSTO/GRAD': 'XYZ', 'ANTIGUIDADE': 4005 }], true);
    expect(previa.ignoradas).toEqual([expect.objectContaining({ coluna: 'POSTO/GRAD', motivo: expect.stringContaining('Posto "XYZ" não existe.') })]);
    expect(await militar('990301-1')).toMatchObject({ posto: 'SD BM', antiguidade: 4005 });
  });

  it('SEXO, COMPORTAMENTO, NASCIMENTO 31/02, ANTIGUIDADE e UF fora do formato são ignorados; as outras células valem', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990301-1', 'SEXO': 'X', 'COMPORTAMENTO': 'Péssimo', 'NASCIMENTO': '31/02', 'ANTIGUIDADE': 'abc', 'UF': 'XX', 'BAIRRO': 'Centro' }], true);
    expect(colunasIgnoradas(previa, '990301-1')).toEqual(['ANTIGUIDADE', 'SEXO', 'NASCIMENTO', 'UF', 'COMPORTAMENTO']);
    expect(await militar('990301-1')).toMatchObject({ sexo: 'M', comportamento: 'Bom', nascimento_dia: 15, antiguidade: 4005, uf: null, bairro: 'Centro' });
  });

  it('e-mail de outro militar, ou repetido na planilha, é ignorado, sem o nome do outro', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990302-2', 'E-MAIL': 'ANDRADE@bombeiros.pe.gov.br', 'TELEFONE': '(81) 97777-0000' }], true);
    expect(previa.ignoradas).toEqual([{ linha: 2, chave: '990302-2', coluna: 'E-MAIL', motivo: 'Este e-mail já está cadastrado em outro militar.' }]);
    expect(await militar('990302-2')).toMatchObject({ email: null, telefone: '(81) 97777-0000' });
    const dois = await importar([NOVO('990303-3', 'XAVIER', { 'E-MAIL': 'repetido@bombeiros.pe.gov.br' }), NOVO('990304-4', 'YPSILON', { 'E-MAIL': 'Repetido@bombeiros.pe.gov.br' })], true);
    expect(dois.ignoradas).toEqual([expect.objectContaining({ chave: '990304-4', coluna: 'E-MAIL', motivo: 'Este e-mail já está cadastrado em outro militar.' })]);
    expect(await militar('990304-4')).toMatchObject({ nome_guerra: 'YPSILON', email: null });
  });

  it('CPF de outro militar, ou repetido na planilha, é ignorado com o texto fixo, sem o nome do outro', async () => {
    await importar([{ 'MATRÍCULA': '990301-1', 'CPF': '529.982.247-25' }], true);
    const outro = await importar([{ 'MATRÍCULA': '990302-2', 'CPF': '52998224725', 'BAIRRO': 'Boa Vista' }], true);
    expect(outro.ignoradas).toEqual([{ linha: 2, chave: '990302-2', coluna: 'CPF', motivo: 'Este CPF já está cadastrado em outro militar.' }]);
    expect(await militar('990302-2')).toMatchObject({ cpf: null, bairro: 'Boa Vista' });
    const dois = await importar([{ 'MATRÍCULA': '990303-3', 'CPF': '390.533.447-05' }, { 'MATRÍCULA': '990304-4', 'CPF': '39053344705' }], true);
    expect(dois.ignoradas).toEqual([expect.objectContaining({ chave: '990304-4', coluna: 'CPF', motivo: 'Este CPF já está cadastrado em outro militar.' })]);
    // o motivo não diz de quem é o CPF (990303-3 é o XAVIER)
    expect(JSON.stringify(dois.ignoradas)).not.toContain('XAVIER');
    expect(await militar('990303-3')).toMatchObject({ cpf: '39053344705' });
  });

  it('a mudança de CPF na prévia mostra só os 4 últimos dígitos, antes e depois', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990303-3', 'CPF': '111.444.777-35' }]);
    expect(previa.alterados[0].mudancas).toEqual(['CPF: •••.•••.•47-05 → •••.•••.•77-35']);
    expect(JSON.stringify(previa)).not.toContain('390533');
  });

  it('CPF, CEP e UF inválidos são ignorados com o texto fixo', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990303-3', 'CPF': '111.111.111-11', 'CEP': '5003', 'UF': 'XX' }]);
    expect(previa.ignoradas.map((i: Ignorada) => i.motivo)).toEqual(['CPF inválido: confira os 11 dígitos.', 'O CEP tem 8 dígitos.', 'Use a sigla do estado (ex.: PE).']);
  });

  it('militar novo sem posto, sem nome de guerra ou sem lotação não é criado, e a prévia diz qual faltou; as outras linhas seguem', async () => {
    const previa = await importar([
      NOVO('990310-0', 'SEMPOSTO', { 'POSTO/GRAD': '' }),
      NOVO('990311-1', 'X', { 'NOME DE GUERRA': '' }),
      NOVO('990312-2', 'SEMLOTA', { 'LOTAÇÃO': 'DIM' }),
      NOVO('990313-3', 'BOM'),
    ], true);
    expect(previa.problemas.map((p: { linha: number; mensagem: string }) => [p.linha, p.mensagem])).toEqual([
      [2, 'Militar novo sem posto/graduação: não foi criado.'],
      [3, 'Militar novo sem nome de guerra: não foi criado.'],
      [4, 'Militar novo sem lotação: não foi criado.'],
    ]);
    expect(previa.ignoradas).toEqual([expect.objectContaining({ chave: '990312-2', coluna: 'LOTAÇÃO' })]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['990313-3']);
    expect(await militar('990310-0')).toBeUndefined();
    expect(await militar('990313-3')).toBeDefined();
  });

  it('militar novo só com os três dados é criado, com o nome completo vazio', async () => {
    await importar([{ 'MATRÍCULA': '990314-4', 'POSTO/GRAD': 'CB', 'NOME DE GUERRA': 'MINIMO', 'LOTAÇÃO': '1ª SB' }], true, ['MATRÍCULA', 'POSTO/GRAD', 'NOME DE GUERRA', 'LOTAÇÃO']);
    expect(await militar('990314-4')).toMatchObject({ posto: 'CB BM', nome_guerra: 'MINIMO', nome_completo: null });
  });

  it('matrícula inválida ou repetida continua sendo problema da linha', async () => {
    const previa = await importar([NOVO('99033', 'MATMAU'), NOVO('990320-0', 'PRIMEIRO'), NOVO('990320-0', 'SEGUNDO')]);
    expect(previa.problemas.map((p: { linha: number; mensagem: string }) => [p.linha, p.mensagem])).toEqual([
      [2, 'Matrícula inválida: "99033".'],
      [4, 'Matrícula 990320-0 repetida na planilha.'],
    ]);
  });

  it('quem tem acesso ao sistema e vem sem e-mail na planilha não é recusado (célula vazia não apaga)', async () => {
    const m = (await militar('990301-1'))!;
    await api.banco.query("insert into usuario (nome, email, militar_id) values ('SD BM ANDRADE', 'andrade@bombeiros.pe.gov.br', $1)", [m.id]);
    const previa = await importar([{ ...ANDRADE, 'E-MAIL': '', 'TELEFONE': '(81) 96666-0000' }], true);
    expect(previa.problemas).toEqual([]);
    expect(await militar('990301-1')).toMatchObject({ email: 'andrade@bombeiros.pe.gov.br', telefone: '(81) 96666-0000' });
  });

  it('NASCIMENTO que o Excel transformou em data, ou o número de série dele, é ignorado com o motivo (Review Focus 5)', async () => {
    const previa = await importar([
      { 'MATRÍCULA': '990302-2', 'NASCIMENTO': new Date(Date.UTC(1985, 2, 15)) },
      { 'MATRÍCULA': '990303-3', 'NASCIMENTO': 31121 },
      { 'MATRÍCULA': '990304-4', 'NASCIMENTO': '1985-03-15' },
    ], true);
    expect(previa.ignoradas.map((i: Ignorada) => [i.chave, i.coluna, i.motivo])).toEqual([
      ['990302-2', 'NASCIMENTO', 'Use dd/mm/aaaa ou dd/mm, em formato de texto.'],
      ['990303-3', 'NASCIMENTO', 'Use dd/mm/aaaa ou dd/mm, em formato de texto.'],
      ['990304-4', 'NASCIMENTO', 'Use dd/mm/aaaa ou dd/mm, em formato de texto.'],
    ]);
    expect(await militar('990302-2')).toMatchObject({ nascimento_dia: 29, nascimento_mes: 2, nascimento_ano: null });
  });

  it('NASCIMENTO dd/mm/aaaa grava o ano; depois, dd/mm muda o dia e o mês e guarda o ano', async () => {
    await importar([{ 'MATRÍCULA': '990303-3', 'NASCIMENTO': '15/03/1985' }], true);
    expect(await militar('990303-3')).toMatchObject({ nascimento_dia: 15, nascimento_mes: 3, nascimento_ano: 1985 });
    await importar([{ 'MATRÍCULA': '990303-3', 'NASCIMENTO': '16/03' }], true);
    expect(await militar('990303-3')).toMatchObject({ nascimento_dia: 16, nascimento_mes: 3, nascimento_ano: 1985 });
  });

  it('a LOTAÇÃO diferente de quem já existe vira aviso, sem mudar o rastreio', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990301-1', 'LOTAÇÃO': '3ª SB', 'TELEFONE': '(81) 95555-0000' }], true);
    expect(previa.avisos.some((a: string) => a.includes('ANDRADE (990301-1)') && a.includes('3ª SB') && a.includes('Alterar situação'))).toBe(true);
    expect((await rastreio('990301-1')).map((r) => r.sigla)).toEqual(['1ª SB']);
  });

  it('a lotação do militar novo precisa ser da unidade da importação ou de baixo', async () => {
    const r = await enviar([NOVO('990330-0', 'OUTRASECAO', { 'LOTAÇÃO': '2ª SB' })], { quem: 'admin', u: secao1 });
    const previa = await r.json();
    expect(previa.problemas).toEqual([expect.objectContaining({ mensagem: 'Militar novo sem lotação: não foi criado.' })]);
    expect(previa.ignoradas).toEqual([expect.objectContaining({ coluna: 'LOTAÇÃO', motivo: expect.stringContaining('"2ª SB"') })]);
  });

  it('planilha sem a coluna MATRÍCULA é problema e nada é gravado', async () => {
    const previa = await importar([{ 'TELEFONE': '1' }], true, ['TELEFONE']);
    expect(previa.problemas).toEqual([expect.objectContaining({ mensagem: 'Falta a coluna MATRÍCULA.' })]);
    expect(previa.gravados).toBe(0);
  });
});

describe('quem pode importar o Pecúlio', () => {
  it('o escalante só da 1ª SB é 403, na prévia, na confirmação e no modelo, e nada é gravado', async () => {
    const antes = await auditoria();
    const previa = await enviar([ANDRADE], { quem: 'escalante', u: secao1 });
    expect(previa.status).toBe(403);
    expect((await previa.json()).erro).toBe('A importação do Pecúlio é de quem tem nível de acesso no 2º GB.');
    expect((await enviar([ANDRADE], { quem: 'escalante', u: secao1, confirmar: true })).status).toBe(403);
    expect((await api.pedir('escalante', 'GET', modelo(secao1))).status).toBe(403);
    expect(await auditoria()).toBe(antes);
  });

  it('o gestor do 2º GB e o administrador importam', async () => {
    expect((await enviar([ANDRADE], { quem: 'gestorGb' })).status).toBe(200);
    expect((await enviar([ANDRADE], { quem: 'admin' })).status).toBe(200);
    expect((await enviar([ANDRADE], { quem: 'gestorGb', u: secao1 })).status).toBe(200);
  });
});

describe('os dados da escala, o quadro e a situação na planilha do Pecúlio (Task 2)', () => {
  it('militar novo sem essas colunas: Pronto, sem equipe, situação padrão, não motorista, sem CNH, não voluntário', async () => {
    await importar([NOVO('990401-1', 'PADRAO')], true);
    expect(await militar('990401-1')).toMatchObject({ motorista: false, cnh: [], voluntario_jes: false });
    expect(await rastreio('990401-1')).toEqual([expect.objectContaining({ jornada: 'pronto', equipe: null, situacao: 'Ativa', quadro: 'QBMG' })]);
  });

  it('um 2º TEN novo com QUADRO = QOA nasce no QOA; sem a coluna, nasce sem quadro', async () => {
    await importar([NOVO('990402-2', 'TENQOA', { 'POSTO/GRAD': '2º TEN BM', 'QUADRO': 'qoa' }), NOVO('990403-3', 'TENSEM', { 'POSTO/GRAD': '2º TEN BM' })], true);
    expect((await rastreio('990402-2'))[0]!.quadro).toBe('QOA');
    expect((await rastreio('990403-3'))[0]!.quadro).toBeNull();
  });

  it('QUADRO que não tem o posto, ou que não existe, é ignorado com o motivo e os quadros que servem', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990401-1', 'QUADRO': 'QOC' }, { 'MATRÍCULA': '990402-2', 'QUADRO': 'QXX' }]);
    expect(previa.ignoradas.map((i: Ignorada) => [i.chave, i.motivo])).toEqual([
      ['990401-1', 'O quadro QOC não tem o posto SD BM. Use um destes: QBMG.'],
      ['990402-2', 'Quadro "QXX" não existe. Use um destes: QOA, QOC.'],
    ]);
  });

  it('QUADRO que serve muda o período aberto a partir de hoje', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990403-3', 'QUADRO': 'QOC' }], true);
    expect(previa.alterados[0].mudancas).toEqual(['quadro: sem quadro → QOC']);
    expect((await rastreio('990403-3')).at(-1)).toMatchObject({ quadro: 'QOC', ate: null });
  });

  it('SITUAÇÃO pelo nome, sem diferenciar maiúsculas nem acentos; outra coisa é ignorada com a lista', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990401-1', 'SITUAÇÃO': 'RESERVA' }, { 'MATRÍCULA': '990402-2', 'SITUAÇÃO': 'Ferias' }], true);
    expect(previa.ignoradas).toEqual([expect.objectContaining({ chave: '990402-2', coluna: 'SITUAÇÃO', motivo: expect.stringContaining('Use uma destas: Adido, Agregado, Ativa') })]);
    expect((await rastreio('990401-1')).at(-1)).toMatchObject({ situacao: 'Reserva', ate: null });
  });

  it('JORNADA e EQUIPE: a equipe que não existe na seção é criada, na posição do ciclo, e a prévia avisa', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990402-2', 'JORNADA': 'pronto', 'EQUIPE': 'bravo' }, { 'MATRÍCULA': '990403-3', 'JORNADA': 'XX' }], true);
    expect(previa.avisos).toContain('Equipes novas na 1ª SB: bravo.');
    expect(previa.ignoradas).toEqual([expect.objectContaining({ chave: '990403-3', coluna: 'JORNADA', motivo: 'Use PRONTO ou ADM.' })]);
    expect((await rastreio('990402-2')).at(-1)).toMatchObject({ equipe: 'bravo', jornada: 'pronto' });
    expect((await api.banco.query<{ ordem_ciclo: number }>("select ordem_ciclo from equipe where unidade_id = $1 and nome = 'bravo'", [secao1])).rows[0]!.ordem_ciclo).toBe(2);
  });

  it('EQUIPE com JORNADA ADM é ignorada com o motivo, e a jornada entra; passar para ADM esvazia a equipe (Review Focus 3)', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990402-2', 'JORNADA': 'ADM', 'EQUIPE': 'BRAVO' }], true);
    expect(previa.ignoradas).toEqual([{ linha: 2, chave: '990402-2', coluna: 'EQUIPE', motivo: 'No expediente não há equipe.' }]);
    expect(previa.alterados[0].mudancas).toEqual(['jornada: Pronto → Adm', 'equipe: bravo → sem equipe']);
    expect((await rastreio('990402-2')).at(-1)).toMatchObject({ jornada: 'adm', equipe: null });
    // quem já é ADM também não recebe equipe
    expect((await importar([{ 'MATRÍCULA': '990402-2', 'EQUIPE': 'BRAVO' }])).ignoradas).toEqual([expect.objectContaining({ motivo: 'No expediente não há equipe.' })]);
  });

  it('MOTORISTA e VOLUNTÁRIO JES: SIM, S, X, 1 / NÃO, NAO, N, 0; outra coisa é ignorada', async () => {
    const previa = await importar([
      { 'MATRÍCULA': '990401-1', 'MOTORISTA': 'x', 'VOLUNTÁRIO JES': '1' },
      { 'MATRÍCULA': '990402-2', 'MOTORISTA': 'nao', 'VOLUNTÁRIO JES': 'talvez' },
    ], true);
    expect(previa.ignoradas).toEqual([expect.objectContaining({ chave: '990402-2', coluna: 'VOLUNTÁRIO JES', motivo: 'Use SIM ou NÃO.' })]);
    expect(await militar('990401-1')).toMatchObject({ motorista: true, voluntario_jes: true });
    expect(await militar('990402-2')).toMatchObject({ motorista: false });
  });

  it('CNH: as letras juntas; uma letra que não é categoria faz a célula inteira ser ignorada', async () => {
    const previa = await importar([{ 'MATRÍCULA': '990401-1', 'CNH': 'da' }, { 'MATRÍCULA': '990402-2', 'CNH': 'AZ' }], true);
    expect(previa.ignoradas).toEqual([expect.objectContaining({ chave: '990402-2', coluna: 'CNH' })]);
    expect(await militar('990401-1')).toMatchObject({ cnh: ['A', 'D'] });
    expect(await militar('990402-2')).toMatchObject({ cnh: [] });
  });

  it('quatro mudanças de rastreio na mesma linha geram um período novo só, a partir de hoje', async () => {
    await importar([NOVO('990405-5', 'QUATRO')], true);
    // o período do militar novo começa no dia 1 do mês: para o teste, ele passa a ter começado antes de hoje
    await api.banco.query("update rastreio set desde = date '2020-01-01' where militar_id = (select id from militar where matricula = '990405-5')");
    await importar([{ 'MATRÍCULA': '990405-5', 'QUADRO': 'QBMG', 'SITUAÇÃO': 'Reserva', 'JORNADA': 'PRONTO', 'EQUIPE': 'ALFA' }], true);
    const r = await rastreio('990405-5');
    expect(r).toHaveLength(2);
    expect(r[1]).toMatchObject({ situacao: 'Reserva', equipe: 'ALFA', jornada: 'pronto', quadro: 'QBMG', desde: hoje, ate: null });
  });

  it('a planilha de 20 colunas de antes desta entrega importa sem tocar em equipe, jornada, motorista, CNH e voluntário JES (Review Focus 1)', async () => {
    const antes = await militar('990405-5');
    const periodos = await rastreio('990405-5');
    await api.banco.query("update militar set motorista = true, cnh = '{D}', voluntario_jes = true where matricula = '990405-5'");
    const previa = await importar([{ 'MATRÍCULA': '990405-5', 'POSTO/GRAD': 'SD BM', 'NOME COMPLETO': 'Quatro de Tal Novo', 'NOME DE GUERRA': 'QUATRO', 'LOTAÇÃO': '1ª SB' }], true, CAB_DE_20);
    expect(previa.alterados[0].mudancas).toEqual(['nome completo: QUATRO de Tal → Quatro de Tal Novo']);
    expect(await militar('990405-5')).toMatchObject({ motorista: true, cnh: ['D'], voluntario_jes: true, nome_completo: 'Quatro de Tal Novo' });
    expect(await rastreio('990405-5')).toEqual(periodos);
    void antes;
  });

  it('quem está no ADM com equipe (pela ficha) não perde a equipe numa planilha sem a coluna JORNADA (achado da revisão final)', async () => {
    await importar([NOVO('990430-0', 'ADMCOMEQUIPE')], true);
    const equipe = (await api.banco.query<{ id: string }>("select id from equipe where unidade_id = $1 and nome = 'ALFA'", [secao1])).rows[0]!.id;
    await api.banco.query("update rastreio set jornada = 'adm', equipe_id = $2 where militar_id = (select id from militar where matricula = $1)", ['990430-0', equipe]);
    const periodos = await rastreio('990430-0');
    const previa = await importar([{ 'MATRÍCULA': '990430-0', 'TELEFONE': '(81) 94444-0000' }], true, ['MATRÍCULA', 'TELEFONE']);
    expect(previa.alterados[0].mudancas).toEqual(['telefone: vazio → (81) 94444-0000']);
    expect(await rastreio('990430-0')).toEqual(periodos);
  });

  it('o período aberto em outra seção só muda com nível de acesso acima dela: sem ele, as células do rastreio são ignoradas (achado da revisão final)', async () => {
    const raiz = (await api.banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
    const outroGb = (await api.banco.query<{ id: string }>("insert into unidade (tipo, sigla, nome, mae_id, desde) values ('grupamento', '9º GB', 'Nono Grupamento', $1, '2020-01-01') returning id", [raiz])).rows[0]!.id;
    const secaoDeFora = (await api.banco.query<{ id: string }>("insert into unidade (tipo, sigla, nome, mae_id, desde) values ('secao', '1ª SB/9', 'Seção do 9º GB', $1, '2020-01-01') returning id", [outroGb])).rows[0]!.id;
    await importar([NOVO('990431-1', 'TRANSFERIDO')], true);
    // lotado na 1ª SB neste mês, com a transferência para fora do 2º GB já marcada (o período aberto é o de lá)
    const id = (await militar('990431-1'))!.id;
    await api.banco.query("update rastreio set ate = $2::date + interval '40 days' where militar_id = $1", [id, hoje]);
    await api.banco.query("insert into rastreio (militar_id, unidade_id, jornada, desde) values ($1, $2, 'pronto', $3::date + interval '41 days')", [id, secaoDeFora, hoje]);
    const periodos = await rastreio('990431-1');
    const previa = await importar([{ 'MATRÍCULA': '990431-1', 'JORNADA': 'ADM', 'TELEFONE': '(81) 93333-0000' }], true);
    expect(previa.ignoradas).toEqual([expect.objectContaining({ coluna: 'JORNADA', motivo: expect.stringContaining('1ª SB/9') })]);
    expect(await rastreio('990431-1')).toEqual(periodos);
    expect(await militar('990431-1')).toMatchObject({ telefone: '(81) 93333-0000' });
  });

  it('importar duas vezes a mesma planilha completa: na segunda, tudo cai em iguais e nenhum período novo é aberto', async () => {
    const linha = NOVO('990410-0', 'COMPLETO', { 'QUADRO': 'QBMG', 'SITUAÇÃO': 'Ativa', 'JORNADA': 'PRONTO', 'EQUIPE': 'ALFA', 'MOTORISTA': 'SIM', 'CNH': 'D', 'VOLUNTÁRIO JES': 'NÃO' });
    await importar([linha], true);
    const periodos = await rastreio('990410-0');
    expect(await importar([linha])).toMatchObject({ novos: [], alterados: [], iguais: 1, ignoradas: [] });
    await importar([linha], true);
    expect(await rastreio('990410-0')).toEqual(periodos);
  });

  it('trocar o posto pela planilha leva o quadro junto, como na ficha', async () => {
    await importar([NOVO('990420-0', 'MAJOR', { 'POSTO/GRAD': 'MAJ BM', 'QUADRO': 'QOA' })], true);
    await importar([{ 'MATRÍCULA': '990420-0', 'POSTO/GRAD': 'CEL BM' }], true);
    expect((await rastreio('990420-0')).at(-1)!.quadro).toBe('QOC');
  });
});
