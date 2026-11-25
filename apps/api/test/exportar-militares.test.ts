import { COLUNAS_DA_EXPORTACAO } from 'contratos';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { COLUNAS } from '../src/importacao/peculio.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste, type Quem } from './apoio-api.ts';
import { formulario } from './planilha-teste.ts';

// Entrega 6.54, Task 2: a exportação de militares para Excel (POST /api/consulta/militares/exportar), com as colunas da importação do Pecúlio. Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
let sb1: string;
let sb2: string;
let quadros: Record<string, string> = {};
const hoje = hojeRecife();
const dia1 = `${hoje.slice(0, 7)}-01`;
const m: Record<string, string> = {};
let n = 0;
const ROTA = '/api/consulta/militares/exportar';
const TODAS = COLUNAS_DA_EXPORTACAO.map((c) => c.rotulo);

type Extra = { jornada?: string; equipe?: string; situacao?: string; posto?: string; mil?: Record<string, unknown> };
async function militar(chave: string, unidadeId: string, e: Extra = {}) {
  const postoId = (await api.banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [e.posto ?? 'SD'])).rows[0]!.id;
  const matricula = `990${String(500 + n).padStart(3, '0')}-${n % 10}`;
  n++;
  const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: postoId, nome_guerra: chave, nome_completo: `Fulano ${chave}`, antiguidade: 100 + n, ...e.mil });
  await inserir(api.banco, 'rastreio', {
    militar_id: id, unidade_id: unidadeId, jornada: e.jornada ?? 'adm', desde: dia1, quadro_id: quadros.QBMG, ...(e.equipe ? { equipe_id: e.equipe } : {}), ...(e.situacao ? { situacao_id: e.situacao } : {}),
  });
  m[chave] = id;
  return id;
}

const exportar = (quem: Quem, corpo: unknown) => api.pedir(quem, 'POST', ROTA, corpo);
/** O arquivo lido como uma lista de linhas { rótulo: texto }; a aba e o cabeçalho vão junto. */
async function lerArquivo(r: Response) {
  expect(r.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await r.arrayBuffer());
  const ws = wb.getWorksheet('PECÚLIO')!;
  expect(ws).toBeTruthy();
  const cab = (ws.getRow(1).values as unknown[]).slice(1).map(String);
  const linhas: Record<string, string>[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    linhas.push(Object.fromEntries(cab.map((c, k) => [c, row.getCell(k + 1).text])));
  });
  return { cab, linhas, ws };
}
const deMatricula = (linhas: Record<string, string>[], chave: string) => linhas.find((l) => l['NOME DE GUERRA'] === chave)!;

beforeAll(async () => {
  api = await montarApi();
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadros[q.sigla] = q.id;
});
afterAll(async () => {
  await api.fechar();
});

describe('as colunas', () => {
  it('Review Focus 1: os rótulos de COLUNAS_DA_EXPORTACAO são os do importador, na mesma ordem (a lista não se separa da importação)', () => {
    expect(COLUNAS_DA_EXPORTACAO.map((c) => c.rotulo)).toEqual(Object.values(COLUNAS).map((c) => c.rotulo));
  });
});

describe('quem sai', () => {
  it('só as colunas pedidas, mais a MATRÍCULA (sempre), na ordem da importação, na aba PECÚLIO', async () => {
    await militar('AQUI1', sb1);
    const r = await exportar('gestorGb', { ids: [m.AQUI1], colunas: ['QUADRO', 'NOME DE GUERRA'] });
    const { cab, linhas } = await lerArquivo(r);
    expect(cab).toEqual(['MATRÍCULA', 'NOME DE GUERRA', 'QUADRO']);
    expect(linhas).toHaveLength(1);
    expect(r.headers.get('content-type')).toContain('spreadsheetml');
    expect(r.headers.get('content-disposition')).toContain(`militares-${hoje}.xlsx`);
  });

  it('Review Focus 3: "filtros" sai a busca inteira, também com mais de 500 militares', async () => {
    const postoId = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const gbX = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '7º GB', nome: '7º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
    await api.banco.query(
      `insert into militar (matricula, posto_grad_id, nome_guerra)
       select '96' || lpad(g::text, 4, '0') || '-' || (g % 10), $1, 'LOTE' || g from generate_series(1, 520) g`,
      [postoId],
    );
    await api.banco.query(`insert into rastreio (militar_id, unidade_id, jornada, desde) select id, $1, 'adm', $2 from militar where nome_guerra like 'LOTE%'`, [gbX, dia1]);
    const { linhas } = await lerArquivo(await exportar('admin', { filtros: { unidades: [{ id: gbX, comAsDeBaixo: true }] }, colunas: ['NOME DE GUERRA'] }));
    expect(linhas).toHaveLength(520);
  });

  it('Review Focus 4: a busca e a seleção juntas saem uma vez só cada militar, na ordem da busca (nome de guerra, matrícula)', async () => {
    await militar('DOIS_B', sb2);
    await militar('DOIS_A', sb2);
    await militar('DOIS_C', sb2);
    const filtros = { unidades: [{ id: sb2, comAsDeBaixo: false }] };
    const { linhas } = await lerArquivo(await exportar('gestorGb', { filtros, ids: [m.DOIS_C, m.AQUI1, m.DOIS_A], colunas: ['NOME DE GUERRA'] }));
    const nomes = linhas.map((l) => l['NOME DE GUERRA']);
    expect(nomes).toEqual([...nomes].sort());
    expect(nomes.filter((x) => x === 'DOIS_A')).toHaveLength(1);
    expect(nomes.filter((x) => x === 'DOIS_C')).toHaveLength(1);
    expect(nomes).toContain('AQUI1');
    expect(nomes).toContain('DOIS_B');
  });

  it('só a seleção: sai exatamente ela', async () => {
    const { linhas } = await lerArquivo(await exportar('gestorGb', { ids: [m.DOIS_A, m.DOIS_B], colunas: ['NOME DE GUERRA'] }));
    expect(linhas.map((l) => l['NOME DE GUERRA'])).toEqual(['DOIS_A', 'DOIS_B']);
  });

  it('sem busca e sem seleção: 400 "Escolha o que exportar."', async () => {
    const r = await exportar('gestorGb', { colunas: ['NOME DE GUERRA'] });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erro: 'Escolha o que exportar.' });
  });

  it('o militar comum (sem nível de acesso) leva 403 com a frase fixa', async () => {
    const r = await exportar('semPapel', { ids: [m.AQUI1], colunas: ['NOME DE GUERRA'] });
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ erro: 'Só quem tem nível de acesso exporta militares.' });
  });
});

describe('o formato de cada célula (o que a importação lê)', () => {
  it('Review Focus 5: nascimento e matrícula como texto; CNH junta; SIM/NÃO; jornada em maiúsculas; antiguidade número', async () => {
    const eq = await inserir(api.banco, 'equipe', { unidade_id: sb1, nome: 'Alfa', ordem_ciclo: 1 });
    await militar('FORMATO', sb1, {
      jornada: 'pronto', equipe: eq,
      mil: { nascimento_dia: 15, nascimento_mes: 3, motorista: true, cnh: ['D', 'A'], voluntario_jes: true, abono_permanencia: false, sexo: 'M', cpf: '52998224725', cep: '50030000', uf: 'PE' },
    });
    await militar('SEMANO', sb1, { mil: { nascimento_dia: 29, nascimento_mes: 2, nascimento_ano: 1992 } });
    const { linhas, ws } = await lerArquivo(await exportar('gestorGb', { ids: [m.FORMATO, m.SEMANO], colunas: TODAS }));
    const l = deMatricula(linhas, 'FORMATO');
    expect(l).toMatchObject({ 'NASCIMENTO': '15/03', 'CNH': 'AD', 'MOTORISTA': 'SIM', 'VOLUNTÁRIO JES': 'SIM', 'ABONO DE PERMANÊNCIA': 'NÃO', 'JORNADA': 'PRONTO', 'EQUIPE': 'Alfa', 'SEXO': 'M', 'CPF': '52998224725', 'CEP': '50030000', 'UF': 'PE', 'QUADRO': 'QBMG', 'LOTAÇÃO': '1ª SB' });
    expect(deMatricula(linhas, 'SEMANO')['NASCIMENTO']).toBe('29/02/1992');
    // as células são texto de verdade (o Excel não vira data nem número): a data e a matrícula, e a coluna com o formato de texto
    const col = (rotulo: string) => TODAS.indexOf(rotulo) + 1;
    expect(ws.getCell(2, col('NASCIMENTO')).type).toBe(ExcelJS.ValueType.String);
    expect(ws.getCell(2, col('MATRÍCULA')).type).toBe(ExcelJS.ValueType.String);
    expect(ws.getColumn(col('MATRÍCULA')).numFmt).toBe('@');
    expect(ws.getColumn(col('NASCIMENTO')).numFmt).toBe('@');
    expect(ws.getColumn(col('CPF')).numFmt).toBe('@');
    expect(ws.getCell(2, col('ANTIGUIDADE')).type).toBe(ExcelJS.ValueType.Number);
  });
});

describe('o período de hoje (como a ficha e a pesquisa mostram)', () => {
  it('com uma mudança marcada para depois, a planilha traz a equipe, a jornada, o quadro e a situação de HOJE, não os do período futuro', async () => {
    const alfa = await inserir(api.banco, 'equipe', { unidade_id: sb2, nome: 'Alfa', ordem_ciclo: 1 });
    const bravo = await inserir(api.banco, 'equipe', { unidade_id: sb2, nome: 'Bravo', ordem_ciclo: 2 });
    const postoId = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const id = await inserir(api.banco, 'militar', { matricula: '990990-0', posto_grad_id: postoId, nome_guerra: 'MARCADO', nome_completo: 'Fulano MARCADO', antiguidade: 999 });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: sb2, jornada: 'pronto', desde: dia1, ate: somarDias(hoje, 10), quadro_id: quadros.QBMG, equipe_id: alfa });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: sb2, jornada: 'adm', desde: somarDias(hoje, 11), quadro_id: quadros.QBMG });
    m.MARCADO = id;
    const l = deMatricula((await lerArquivo(await exportar('gestorGb', { ids: [id], colunas: TODAS }))).linhas, 'MARCADO');
    expect(l).toMatchObject({ 'JORNADA': 'PRONTO', 'EQUIPE': 'Alfa', 'QUADRO': 'QBMG', 'LOTAÇÃO': '2ª SB' });
    expect(l['SITUAÇÃO']).not.toBe('');
    void bravo;
  });
});

describe('quem vê o quê (6.11): o que a pessoa não vê sai vazio', () => {
  it('Review Focus 2: o escalante da 1ª SB exportando militares da 2ª SB (sem nível lá) leva só a identificação; o gestor do GB leva tudo', async () => {
    await militar('DADOS', sb2, { jornada: 'adm', mil: { telefone: '(81) 99999-0001', email: 'dados@bombeiros.pe.gov.br', comportamento: 'Bom', comportamento_boletim: 'BG 01/2026', cpf: '11144477735', nascimento_dia: 15, nascimento_mes: 3, motorista: true, cnh: ['B'], voluntario_jes: true } });
    const corpo = { ids: [m.DADOS], colunas: TODAS };
    const escalante = deMatricula((await lerArquivo(await exportar('escalante', corpo))).linhas, 'DADOS');
    expect(escalante).toMatchObject({ 'NOME DE GUERRA': 'DADOS', 'NOME COMPLETO': 'Fulano DADOS', 'POSTO/GRAD': 'SD', 'LOTAÇÃO': '2ª SB', 'QUADRO': 'QBMG' });
    for (const rotulo of ['TELEFONE', 'E-MAIL', 'E-MAIL PESSOAL', 'SITUAÇÃO', 'JORNADA', 'EQUIPE', 'FUNÇÃO', 'MOTORISTA', 'CNH', 'VOLUNTÁRIO JES', 'COMPORTAMENTO', 'BOLETIM DO COMPORTAMENTO', 'ANTIGUIDADE', 'SEXO', 'NASCIMENTO', 'CPF', 'CEP', 'ABONO DE PERMANÊNCIA']) expect(escalante[rotulo], rotulo).toBe('');
    const gestor = deMatricula((await lerArquivo(await exportar('gestorGb', corpo))).linhas, 'DADOS');
    expect(gestor).toMatchObject({ 'TELEFONE': '(81) 99999-0001', 'E-MAIL': 'dados@bombeiros.pe.gov.br', 'COMPORTAMENTO': 'Bom', 'CPF': '11144477735', 'NASCIMENTO': '15/03', 'MOTORISTA': 'SIM', 'CNH': 'B', 'JORNADA': 'ADM' });
  });

  it('um bloco liberado pela borda (contato para todos) sai para quem não tem nível de acesso sobre a lotação; os outros continuam vazios', async () => {
    await api.banco.query("update visao_bloco set ve = true where bloco = 'contato' and camada = 'todos'");
    try {
      const l = deMatricula((await lerArquivo(await exportar('escalante', { ids: [m.DADOS], colunas: TODAS }))).linhas, 'DADOS');
      expect(l['TELEFONE']).toBe('(81) 99999-0001');
      expect(l['CPF']).toBe('');
      expect(l['COMPORTAMENTO']).toBe('');
    } finally {
      await api.banco.query("update visao_bloco set ve = false where bloco = 'contato' and camada = 'todos'");
    }
  });
});

describe('a volta completa (exportar, importar de volta)', () => {
  const importar = async (arquivo: ArrayBuffer, quem: Quem, confirmar = false) => {
    const r = await api.pedir(quem, 'POST', `/api/unidades/${api.ids.gb}/importacao/peculio${confirmar ? '?confirmar=1' : ''}`, formulario(arquivo));
    expect(r.status).toBe(200);
    return r.json();
  };

  it('Review Focus 1: o arquivo exportado com todas as colunas, enviado à prévia da importação, não muda nada em nenhuma linha', async () => {
    const eq = (await api.banco.query<{ id: string }>("select id from equipe where unidade_id = $1 and nome = 'Alfa'", [sb1])).rows[0]!.id;
    await militar('VOLTA1', sb1, { jornada: 'pronto', equipe: eq, posto: 'CB', mil: { sexo: 'F', nascimento_dia: 1, nascimento_mes: 12, nascimento_ano: 1990, telefone: '(81) 98888-0001', email: 'volta1@bombeiros.pe.gov.br', email_pessoal: 'volta1@exemplo.test', comportamento: 'Ótimo', comportamento_boletim: 'BG 02/2026', cpf: '39053344705', cep: '50030000', logradouro: 'Rua das Flores', numero: '12', complemento: 'Ap 3', bairro: 'Boa Vista', cidade: 'Recife', uf: 'PE', motorista: true, cnh: ['C', 'B'], voluntario_jes: true, abono_permanencia: true } });
    await militar('VOLTA2', sb2, { mil: { nascimento_dia: 5, nascimento_mes: 6 } });
    const r = await exportar('gestorGb', { ids: [m.VOLTA1, m.VOLTA2], colunas: TODAS });
    const previa = await importar(await r.arrayBuffer(), 'gestorGb');
    expect(previa.problemas).toEqual([]);
    expect(previa.ignoradas).toEqual([]);
    expect(previa.novos).toEqual([]);
    expect(previa.alterados).toEqual([]);
    expect(previa.iguais).toBe(2);
  });

  it('Review Focus 2: o arquivo de quem não vê o contato, reimportado por quem vê, não apaga o telefone nem nada do militar', async () => {
    const antes = (await api.banco.query('select * from militar where id = $1', [m.DADOS])).rows[0];
    const arquivo = await (await exportar('escalante', { ids: [m.DADOS], colunas: TODAS })).arrayBuffer();
    const previa = await importar(arquivo, 'gestorGb', true);
    expect(previa.alterados).toEqual([]);
    expect(previa.iguais).toBe(1);
    expect((await api.banco.query('select * from militar where id = $1', [m.DADOS])).rows[0]).toEqual(antes);
  });
});

describe('a sigla que se repete na corporação', () => {
  it('leva a unidade de cima ("1ª SB (6º GB)"), como o importador escreve na AJUDA', async () => {
    const outroGb = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '6º GB', nome: '6º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
    const sbRepetida = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '1ª SB', nome: '1ª Seção do 6º', mae_id: outroGb, desde: '2026-11-01' });
    await militar('REPETIDA', sbRepetida);
    const mae = (await api.banco.query<{ sigla: string }>('select m.sigla from unidade u join unidade m on m.id = u.mae_id where u.id = $1', [sb1])).rows[0]!.sigla;
    const { linhas } = await lerArquivo(await exportar('admin', { ids: [m.REPETIDA, m.FORMATO], colunas: ['NOME DE GUERRA', 'LOTAÇÃO'] }));
    expect(deMatricula(linhas, 'REPETIDA')['LOTAÇÃO']).toBe('1ª SB (6º GB)');
    expect(deMatricula(linhas, 'FORMATO')['LOTAÇÃO']).toBe(`1ª SB (${mae})`);
  });

  it('limite conhecido: a importação do 2º GB, onde a sigla é única, não reconhece o rótulo com a unidade de cima: só a célula LOTAÇÃO é ignorada, e nada muda no militar', async () => {
    const r = await exportar('gestorGb', { ids: [m.FORMATO], colunas: TODAS });
    const r2 = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.gb}/importacao/peculio`, formulario(await r.arrayBuffer()));
    const previa = await r2.json();
    expect(previa.ignoradas.map((x: { coluna: string }) => x.coluna)).toEqual(['LOTAÇÃO']);
    expect(previa.alterados).toEqual([]);
    expect(previa.iguais).toBe(1);
  });
});
