import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { lerPlanilha } from '../src/importacao/planilha.ts';
import { montarApi, type ApiDeTeste, type Quem } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

let api: ApiDeTeste;
let secao1: string;
let secao2: string;
const atual = hojeRecife().slice(0, 7);
const CAB = ['MATRÍCULA', 'POSTO/GRAD', 'NOME COMPLETO', 'NOME DE GUERRA', 'ANTIGUIDADE', 'SEXO', 'NASCIMENTO', 'TELEFONE', 'E-MAIL', 'COMPORTAMENTO', 'BOLETIM DO COMPORTAMENTO', 'LOTAÇÃO'];
type Linha = (string | number)[];
const ANDRADE: Linha = ['990301-1', 'SD BM', 'João da Silva Andrade', 'andrade', 4001, 'M', '15/03', '(81) 99999-0001', 'andrade@bombeiros.pe.gov.br', 'Bom', 'BG 01/2026', '1ª SB'];
const LIMA: Linha = ['990302-2', 'CB BM', 'Maria de Souza Lima', 'LIMA', 4002, 'F', '29/02', '', '', 'Ótimo', '', '2ª SB'];

const modelo = (u: string) => `/api/unidades/${u}/importacao/peculio/modelo`;
const caminho = (u: string, confirmar = false) => `/api/unidades/${u}/importacao/peculio${confirmar ? '?confirmar=1' : ''}`;
async function enviar(linhas: Linha[], { quem = 'gestorGb', u = api.ids.gb, confirmar = false }: { quem?: Quem; u?: string; confirmar?: boolean } = {}) {
  return api.pedir(quem, 'POST', caminho(u, confirmar), formulario(await planilha({ 'PECÚLIO': [CAB, ...linhas] })));
}
async function importar(linhas: Linha[], confirmar = false) {
  const r = await enviar(linhas, { confirmar });
  expect(r.status).toBe(200);
  return r.json();
}
const militar = async (matricula: string) =>
  (await api.banco.query<Record<string, unknown>>(
    `select m.id, p.sigla as posto, m.nome_completo, m.nome_guerra, m.antiguidade, m.sexo, m.nascimento_dia, m.nascimento_mes, m.telefone, m.email,
            m.comportamento, m.comportamento_boletim, m.motorista, m.cnh, m.voluntario_jes
       from militar m join posto_grad p on p.id = m.posto_grad_id where m.matricula = $1`,
    [matricula],
  )).rows[0];
const rastreio = async (id: unknown) =>
  (await api.banco.query<{ sigla: string; equipe: string | null; jornada: string; desde: string; ate: string | null }>(
    `select un.sigla, e.nome as equipe, r.jornada, to_char(r.desde, 'YYYY-MM') as desde, to_char(r.ate, 'YYYY-MM-DD') as ate
       from rastreio r join unidade un on un.id = r.unidade_id left join equipe e on e.id = r.equipe_id where r.militar_id = $1 order by r.desde`,
    [id],
  )).rows;
const auditoria = async () => (await api.banco.query<{ n: number }>('select count(*)::int as n from auditoria')).rows[0]!.n;

beforeAll(async () => {
  api = await montarApi();
  const sigla = async (s: string) => (await api.banco.query<{ id: string }>('select id from unidade where sigla = $1', [s])).rows[0]!.id;
  secao1 = await sigla('1ª SB');
  secao2 = await sigla('2ª SB');
});
afterAll(async () => {
  await api.fechar();
});

describe('modelo do Pecúlio', () => {
  it('tem a aba PECÚLIO com as 12 colunas na ordem e a AJUDA com os valores aceitos', async () => {
    const r = await api.pedir('gestorGb', 'GET', modelo(api.ids.gb));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="modelo-peculio.xlsx"');
    const arquivo = await r.arrayBuffer();
    const lidas = await lerPlanilha(arquivo);
    expect(Object.keys(lidas)).toEqual(['PECÚLIO', 'AJUDA']);
    expect(lidas['PECÚLIO']!.cab).toEqual(CAB);
    expect(lidas['PECÚLIO']!.linhas).toEqual([]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arquivo);
    const partes: string[] = [];
    wb.getWorksheet('AJUDA')!.eachRow((row) => row.eachCell((c) => partes.push(String(c.text))));
    const ajuda = partes.join('\n');
    for (const valor of ['M, F', 'Excepcional', 'Insuficiente', 'Mau', 'SD BM', '1ª SB', '7ª SB', 'dd/mm']) expect(ajuda, valor).toContain(valor);
    // D7: nada de CPF nem de ano de nascimento
    expect(CAB.join(' ')).not.toMatch(/CPF|ANO/);
  });
});

describe('importar o Pecúlio', () => {
  it('linha nova cria o militar com os campos e a lotação na seção, a partir do mês atual, Pronto, sem equipe', async () => {
    const antes = await auditoria();
    const previa = await importar([ANDRADE, LIMA]);
    expect(previa.problemas).toEqual([]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['990301-1', '990302-2']);
    expect(await auditoria()).toBe(antes);
    expect((await importar([ANDRADE, LIMA], true)).gravados).toBe(2);
    expect(await militar('990301-1')).toMatchObject({
      posto: 'SD BM', nome_completo: 'João da Silva Andrade', nome_guerra: 'ANDRADE', antiguidade: 4001, sexo: 'M', nascimento_dia: 15, nascimento_mes: 3,
      telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br', comportamento: 'Bom', comportamento_boletim: 'BG 01/2026', motorista: false, cnh: [],
    });
    const lima = (await militar('990302-2'))!;
    expect(lima).toMatchObject({ nascimento_dia: 29, nascimento_mes: 2, telefone: null, email: null, comportamento: 'Ótimo', comportamento_boletim: null });
    expect(await rastreio((await militar('990301-1'))!.id)).toEqual([{ sigla: '1ª SB', equipe: null, jornada: 'pronto', desde: atual, ate: null }]);
    expect(await rastreio(lima.id)).toEqual([{ sigla: '2ª SB', equipe: null, jornada: 'pronto', desde: atual, ate: null }]);
  });

  it('importar o mesmo arquivo de novo não grava nada', async () => {
    const previa = await importar([ANDRADE, LIMA]);
    expect(previa).toMatchObject({ novos: [], alterados: [], iguais: 2, problemas: [] });
    expect((await importar([ANDRADE, LIMA], true)).gravados).toBe(0);
  });

  it('linha de quem já existe atualiza só os campos do Pecúlio; a LOTAÇÃO diferente vira aviso, sem mudar o rastreio', async () => {
    const m = (await militar('990301-1'))!;
    // o que é da escala não é tocado
    await api.banco.query("update militar set motorista = true, cnh = '{D}', voluntario_jes = true where id = $1", [m.id]);
    const mudada: Linha = ['990301-1', 'CB BM', 'João Carlos da Silva Andrade', 'ANDRADE', 4005, 'M', '16/03', '(81) 98888-0002', 'andrade2@bombeiros.pe.gov.br', 'Ótimo', 'BG 05/2026', '3ª SB'];
    const previa = await importar([mudada]);
    expect(previa.alterados).toEqual([
      {
        chave: '990301-1',
        descricao: 'CB BM ANDRADE',
        mudancas: expect.arrayContaining([
          'posto: SD BM → CB BM', 'nome completo: João da Silva Andrade → João Carlos da Silva Andrade', 'antiguidade: 4001 → 4005', 'nascimento: 15/03 → 16/03',
          'telefone: (81) 99999-0001 → (81) 98888-0002', 'e-mail: andrade@bombeiros.pe.gov.br → andrade2@bombeiros.pe.gov.br', 'comportamento: Bom → Ótimo', 'boletim do comportamento: BG 01/2026 → BG 05/2026',
        ]),
      },
    ]);
    expect(previa.avisos.some((a: string) => a.includes('ANDRADE (990301-1)') && a.includes('3ª SB') && a.includes('Alterar situação'))).toBe(true);
    await importar([mudada], true);
    expect(await militar('990301-1')).toMatchObject({
      posto: 'CB BM', nome_completo: 'João Carlos da Silva Andrade', antiguidade: 4005, nascimento_dia: 16, telefone: '(81) 98888-0002', email: 'andrade2@bombeiros.pe.gov.br',
      comportamento: 'Ótimo', comportamento_boletim: 'BG 05/2026', motorista: true, cnh: ['D'], voluntario_jes: true,
    });
    expect(await rastreio(m.id)).toEqual([{ sigla: '1ª SB', equipe: null, jornada: 'pronto', desde: atual, ate: null }]);
  });

  it('célula vazia limpa o campo (a planilha é o contrato)', async () => {
    const limpa: Linha = ['990301-1', 'CB BM', 'João Carlos da Silva Andrade', 'ANDRADE', '', '', '', '', '', '', '', '1ª SB'];
    const previa = await importar([limpa]);
    expect(previa.alterados[0].mudancas).toEqual(expect.arrayContaining(['antiguidade: 4005 → vazia', 'sexo: M → vazio', 'telefone: (81) 98888-0002 → vazio']));
    await importar([limpa], true);
    expect(await militar('990301-1')).toMatchObject({ antiguidade: null, sexo: null, nascimento_dia: null, nascimento_mes: null, telefone: null, email: null, comportamento: null, comportamento_boletim: null });
  });

  it('e-mail fora do domínio, NASCIMENTO 31/02, SEXO fora de M/F e COMPORTAMENTO fora da lista viram problema com a solução, e a linha é pulada', async () => {
    const base = (mat: string, mudar: Record<number, string>): Linha => {
      const l: Linha = [mat, 'SD BM', 'Fulano de Tal', 'FULANO', 1, 'M', '10/10', '', '', 'Bom', '', '1ª SB'];
      for (const [i, v] of Object.entries(mudar)) l[Number(i)] = v;
      return l;
    };
    const previa = await importar([
      base('990310-0', { 8: 'fulano@gmail.com' }),
      base('990311-1', { 6: '31/02' }),
      base('990312-2', { 5: 'X' }),
      base('990313-3', { 9: 'Péssimo' }),
      base('990314-4', {}),
    ]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['990314-4']);
    expect(previa.problemas).toEqual([
      { aba: 'PECÚLIO', linha: 2, mensagem: expect.stringContaining('E-mail'), solucao: 'Use o e-mail institucional (@bombeiros.pe.gov.br).' },
      { aba: 'PECÚLIO', linha: 3, mensagem: expect.stringContaining('Nascimento'), solucao: expect.stringContaining('dd/mm') },
      { aba: 'PECÚLIO', linha: 4, mensagem: expect.stringContaining('Sexo'), solucao: expect.stringContaining('M ou F') },
      { aba: 'PECÚLIO', linha: 5, mensagem: expect.stringContaining('Comportamento'), solucao: expect.stringContaining('Excepcional') },
    ]);
    await importar([base('990314-4', {})], true);
  });

  it('matrícula repetida na planilha: a primeira entra e a segunda é problema (Review Focus 2)', async () => {
    const a: Linha = ['990320-0', 'SD BM', 'Primeiro Nome Completo', 'PRIMEIRO', 5, 'M', '', '', '', '', '', '1ª SB'];
    const b: Linha = ['990320-0', 'SD BM', 'Segundo Nome Completo', 'SEGUNDO', 6, 'M', '', '', '', '', '', '1ª SB'];
    const previa = await importar([a, b]);
    expect(previa.novos.map((n: { chave: string; descricao: string }) => n.descricao)).toEqual(['SD BM PRIMEIRO']);
    expect(previa.problemas).toEqual([{ aba: 'PECÚLIO', linha: 3, mensagem: 'Matrícula 990320-0 repetida na planilha.', solucao: 'Deixe uma linha só por militar.' }]);
    await importar([a, b], true);
    expect(await militar('990320-0')).toMatchObject({ nome_guerra: 'PRIMEIRO' });
  });

  it('linha sem os dados que o Pecúlio exige (nome completo, nome de guerra, posto, lotação) é problema', async () => {
    const previa = await importar([
      ['990330-0', 'SD BM', '', 'SEMCOMPLETO', 1, 'M', '', '', '', '', '', '1ª SB'],
      ['990331-1', 'XYZ', 'Fulano de Tal', 'POSTOMAU', 1, 'M', '', '', '', '', '', '1ª SB'],
      ['990332-2', 'SD BM', 'Fulano de Tal', 'LOTAMAU', 1, 'M', '', '', '', '', '', 'DIM'],
      ['99033', 'SD BM', 'Fulano de Tal', 'MATMAU', 1, 'M', '', '', '', '', '', '1ª SB'],
    ]);
    expect(previa.novos).toEqual([]);
    expect(previa.problemas.map((p: { linha: number; mensagem: string }) => [p.linha, p.mensagem])).toEqual([
      [2, expect.stringContaining('Nome completo')],
      [3, 'Posto "XYZ" não existe.'],
      [4, expect.stringContaining('Lotação "DIM"')],
      [5, expect.stringContaining('Matrícula inválida')],
    ]);
  });

  it('e-mail repetido na planilha ou já de outro militar é problema, não erro do banco', async () => {
    const x: Linha = ['990340-0', 'SD BM', 'Xavier de Tal', 'XAVIER', 1, 'M', '', '', 'repetido@bombeiros.pe.gov.br', '', '', '1ª SB'];
    const y: Linha = ['990341-1', 'SD BM', 'Ypsilon de Tal', 'YPSILON', 2, 'M', '', '', 'Repetido@bombeiros.pe.gov.br', '', '', '1ª SB'];
    const previa = await importar([x, y]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['990340-0']);
    expect(previa.problemas).toEqual([expect.objectContaining({ linha: 3, mensagem: expect.stringContaining('E-mail repetido na planilha') })]);
    await importar([x], true);
    const z: Linha = ['990342-2', 'SD BM', 'Zeta de Tal', 'ZETA', 3, 'M', '', '', 'REPETIDO@bombeiros.pe.gov.br', '', '', '1ª SB'];
    const outra = await importar([z]);
    expect(outra.problemas).toEqual([expect.objectContaining({ mensagem: expect.stringContaining('XAVIER (990340-0)'), solucao: expect.any(String) })]);
    expect(outra.novos).toEqual([]);
  });

  it('a lotação precisa ser da unidade da importação ou de baixo: com a 1ª SB como unidade, linha da 2ª SB é problema', async () => {
    const r = await enviar([LIMA], { quem: 'admin', u: secao1 });
    expect(r.status).toBe(200);
    expect((await r.json()).problemas).toEqual([expect.objectContaining({ linha: 2, mensagem: expect.stringContaining('Lotação "2ª SB"') })]);
  });
});

describe('quem pode importar o Pecúlio (Review Focus 1)', () => {
  it('o escalante só da 1ª SB é 403 com a frase de quem altera, na prévia, na confirmação e no modelo, e nada é gravado', async () => {
    const antes = await auditoria();
    const previa = await enviar([ANDRADE], { quem: 'escalante', u: secao1 });
    expect(previa.status).toBe(403);
    expect((await previa.json()).erro).toBe('A importação do Pecúlio é de quem tem papel no 2º GB.');
    expect((await enviar([ANDRADE], { quem: 'escalante', u: secao1, confirmar: true })).status).toBe(403);
    expect((await api.pedir('escalante', 'GET', modelo(secao1))).status).toBe(403);
    expect((await enviar([ANDRADE], { quem: 'escalante', u: api.ids.gb })).status).toBe(403);
    expect(await auditoria()).toBe(antes);
    expect((await api.pedir('semPapel', 'GET', modelo(secao1))).status).toBe(403);
  });

  it('o gestor do 2º GB e o administrador importam; o gestor do GB também importa só a 1ª SB', async () => {
    expect((await enviar([ANDRADE], { quem: 'gestorGb' })).status).toBe(200);
    expect((await enviar([ANDRADE], { quem: 'admin' })).status).toBe(200);
    expect((await enviar([ANDRADE], { quem: 'gestorGb', u: secao1 })).status).toBe(200);
    expect((await api.pedir('admin', 'GET', modelo(api.ids.gb))).status).toBe(200);
  });

  it('o escalante com papel nas duas seções, mas em nenhuma unidade acima delas, continua 403', async () => {
    // o escalante da 1ª SB também com papel na 2ª SB: tem as duas seções, mas nenhuma unidade acima delas
    const id = (await api.banco.query<{ id: string }>(
      `insert into papel_usuario (usuario_id, unidade_id, papel, desde) values ($1, $2, 'escalante', '2026-01-01') returning id`,
      [api.usuarios.escalante, secao2],
    )).rows[0]!.id;
    try {
      const r = await enviar([LIMA], { quem: 'escalante', u: secao2 });
      expect(r.status).toBe(403);
    } finally {
      await api.banco.query('delete from papel_usuario where id = $1', [id]);
    }
  });
});
