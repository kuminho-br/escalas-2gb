import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { acharPeloCaminho, menorCaminhoUnico, separarCaminho, unidadesDoCaminho, type UnidadeDoCaminho } from '../src/importacao/caminho-da-unidade.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.57, Task 1: a unidade pelo caminho de siglas nas planilhas ("2º GB / 1ª SB"), nas duas pontas (importação e exportação). Dados fictícios (D7).
const u = (id: string, ...siglas: string[]): UnidadeDoCaminho => ({ id, siglas });
// CBMPE › DGO › DInter/1 › 2º GB › 1ª SB › 1ª Seção; DInter/1 › 3º GB › 1ª SB › 1ª Seção; e as de cima
const RAIZ = u('raiz', 'CBMPE');
const DGO = u('dgo', 'CBMPE', 'DGO');
const DINTER = u('dinter', 'CBMPE', 'DGO', 'DInter/1');
const GB2 = u('gb2', 'CBMPE', 'DGO', 'DInter/1', '2º GB');
const SB_GB2 = u('sb-gb2', 'CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB');
const SECAO_GB2 = u('secao-gb2', 'CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB', '1ª Seção');
const GB3 = u('gb3', 'CBMPE', 'DGO', 'DInter/1', '3º GB');
const SB_GB3 = u('sb-gb3', 'CBMPE', 'DGO', 'DInter/1', '3º GB', '1ª SB');
const SECAO_GB3 = u('secao-gb3', 'CBMPE', 'DGO', 'DInter/1', '3º GB', '1ª SB', '1ª Seção');
const TODAS = [RAIZ, DGO, DINTER, GB2, SB_GB2, SECAO_GB2, GB3, SB_GB3, SECAO_GB3];
const ALCANCE_GB2 = [GB2, SB_GB2, SECAO_GB2];
const ALCANCE_DINTER = TODAS.slice(2);

describe('o separador', () => {
  it('Review Focus 1: a barra só separa com espaço de pelo menos um lado; "DInter/1" é uma sigla só', () => {
    expect(separarCaminho('DInter/1')).toEqual(['DInter/1']);
    expect(separarCaminho('2º GB / DInter/1')).toEqual(['2º GB', 'DInter/1']);
    expect(separarCaminho('2º GB / 1ª SB')).toEqual(['2º GB', '1ª SB']);
    expect(separarCaminho('2º GB/ 1ª SB')).toEqual(['2º GB', '1ª SB']);
    expect(separarCaminho('2º GB /1ª SB')).toEqual(['2º GB', '1ª SB']);
    expect(separarCaminho('  1ª SB  ')).toEqual(['1ª SB']);
  });
});

describe('menorCaminhoUnico (como a unidade sai na planilha)', () => {
  it('a sigla que é única fica só a sigla; a que se repete leva a unidade de cima, até o caminho ficar único na corporação', () => {
    expect(menorCaminhoUnico(DINTER, TODAS)).toBe('DInter/1');
    expect(menorCaminhoUnico(GB2, TODAS)).toBe('2º GB');
    expect(menorCaminhoUnico(SB_GB2, TODAS)).toBe('2º GB / 1ª SB');
    expect(menorCaminhoUnico(SB_GB3, TODAS)).toBe('3º GB / 1ª SB');
    // "1ª SB / 1ª Seção" ainda se repete (uma em cada GB): vão três pedaços
    expect(menorCaminhoUnico(SECAO_GB2, TODAS)).toBe('2º GB / 1ª SB / 1ª Seção');
    expect(menorCaminhoUnico(SECAO_GB3, TODAS)).toBe('3º GB / 1ª SB / 1ª Seção');
  });

  it('sem repetição na corporação, a sigla sozinha basta; maiúsculas e acentos não diferenciam', () => {
    expect(menorCaminhoUnico(SB_GB2, [DINTER, GB2, SB_GB2])).toBe('1ª SB');
    expect(menorCaminhoUnico(SB_GB2, [u('x', 'CBMPE', '1ª sb'), SB_GB2])).toBe('2º GB / 1ª SB');
  });
});

describe('acharPeloCaminho (como a importação lê a unidade)', () => {
  const ler = (texto: string, alcance = ALCANCE_GB2) => acharPeloCaminho(texto, alcance, TODAS);

  it('uma sigla vale quando é única no alcance da importação, mesmo que se repita fora dele', () => {
    expect(ler('1ª SB')).toEqual({ valor: SB_GB2 });
    expect(ler('2º GB')).toEqual({ valor: GB2 });
  });

  it('qualquer pedaço final do caminho vale; o caminho inteiro desde a raiz também; sem diferenciar maiúsculas, acentos nem espaços em volta da barra', () => {
    expect(ler('2º GB / 1ª SB')).toEqual({ valor: SB_GB2 });
    expect(ler('2º gb/ 1ª sb')).toEqual({ valor: SB_GB2 });
    expect(ler('1ª SB / 1ª Seção')).toEqual({ valor: SECAO_GB2 });
    expect(ler('CBMPE / DGO / DInter/1 / 2º GB / 1ª SB / 1ª Seção')).toEqual({ valor: SECAO_GB2 });
    expect(ler('1ª SECAO')).toEqual({ valor: SECAO_GB2 });
  });

  it('Review Focus 1: "DInter/1" é uma sigla (acha a unidade), e "2º GB / DInter/1" é um caminho de duas siglas', () => {
    expect(ler('DInter/1', ALCANCE_DINTER)).toEqual({ valor: DINTER });
    expect(ler('2º GB / DInter/1', ALCANCE_DINTER)).toEqual({ motivo: 'Lotação "2º GB / DInter/1" não é desta importação. A lista está na aba AJUDA do modelo.' });
  });

  it('mais de uma no alcance: a mensagem fixa lista os menores caminhos únicos das candidatas', () => {
    expect(ler('1ª SB', ALCANCE_DINTER)).toEqual({ motivo: 'Há mais de uma "1ª SB". Escreva com a unidade de cima: 2º GB / 1ª SB, 3º GB / 1ª SB.' });
    expect(ler('1ª Seção', ALCANCE_DINTER)).toEqual({ motivo: 'Há mais de uma "1ª Seção". Escreva com a unidade de cima: 2º GB / 1ª SB / 1ª Seção, 3º GB / 1ª SB / 1ª Seção.' });
  });

  it('o que está fora do alcance, não existe, ou está no formato antigo "SIGLA (MÃE)" não vale: a mensagem fixa', () => {
    const nenhuma = (t: string) => ({ motivo: `Lotação "${t}" não é desta importação. A lista está na aba AJUDA do modelo.` });
    expect(ler('3º GB')).toEqual(nenhuma('3º GB'));
    expect(ler('XYZ')).toEqual(nenhuma('XYZ'));
    expect(ler('1ª SB (2º GB)')).toEqual(nenhuma('1ª SB (2º GB)'));
  });

  it('célula vazia: vazio (o sistema não mexe)', () => {
    expect(ler('')).toEqual({ vazio: true });
    expect(ler('   ')).toEqual({ vazio: true });
  });
});

describe('no banco e nas planilhas', () => {
  let api: ApiDeTeste;
  const hoje = hojeRecife();
  let gbA: string;
  let sbA: string;
  let sbB: string;
  const lerAjuda = async (buffer: ArrayBuffer) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const textos: string[] = [];
    wb.getWorksheet('AJUDA')!.eachRow((r) => textos.push(String(r.getCell(1).value ?? '')));
    return textos;
  };

  beforeAll(async () => {
    api = await montarApi();
    // a "1ª SB" do 2º GB (já existe) e uma segunda, num 6º GB
    gbA = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '6º GB', nome: '6º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
    sbA = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '1ª SB', nome: '1ª Seção do 6º', mae_id: gbA, desde: '2026-11-01' });
    sbB = api.ids.secao;
  });
  afterAll(async () => {
    await api.fechar();
  });

  it('unidadesDoCaminho: as unidades em vigor, cada uma com as siglas da raiz até ela', async () => {
    const todas = await unidadesDoCaminho(api.banco, hoje);
    expect(todas.find((x) => x.id === sbA)!.siglas).toEqual(['CBMPE', '6º GB', '1ª SB']);
    expect(todas.find((x) => x.id === sbB)!.siglas.at(-1)).toBe('1ª SB');
    expect(todas.find((x) => x.id === api.ids.raiz)!.siglas).toEqual(['CBMPE']);
  });

  it('Review Focus 2: a LOTAÇÃO exportada com sigla repetida volta reconhecida na importação de um grupamento onde a sigla é única (sem célula ignorada)', async () => {
    const postoId = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const id = await inserir(api.banco, 'militar', { matricula: '990871-1', posto_grad_id: postoId, nome_guerra: 'CAMINHO', nome_completo: 'Fulano CAMINHO', antiguidade: 871 });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: sbB, jornada: 'adm', desde: `${hoje.slice(0, 7)}-01` });
    const r = await api.pedir('gestorGb', 'POST', '/api/consulta/militares/exportar', { ids: [id], colunas: ['NOME DE GUERRA', 'LOTAÇÃO'] });
    const wb = new ExcelJS.Workbook();
    const arquivo = await r.arrayBuffer();
    await wb.xlsx.load(arquivo.slice(0));
    const lotacao = wb.getWorksheet('PECÚLIO')!.getRow(2).getCell(3).text;
    expect(lotacao).toMatch(/ \/ 1ª SB$/);
    expect(lotacao).not.toContain('(');
    const importada = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.gb}/importacao/peculio`, formulario(arquivo));
    const previa = await importada.json();
    expect(previa.ignoradas).toEqual([]);
    expect(previa.problemas).toEqual([]);
  });

  it('o formato antigo "1ª SB (2º GB)" não é mais aceito: a célula é ignorada com a mensagem fixa', async () => {
    const cab = ['MATRÍCULA', 'LOTAÇÃO'];
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.raiz}/importacao/peculio`, formulario(await planilha({ 'PECÚLIO': [cab, ['990871-1', '1ª SB (2º GB)']] })));
    const previa = await r.json();
    expect(previa.ignoradas).toEqual([expect.objectContaining({ coluna: 'LOTAÇÃO', motivo: 'Lotação "1ª SB (2º GB)" não é desta importação. A lista está na aba AJUDA do modelo.' })]);
  });

  it('sigla repetida na importação da raiz: a mensagem lista os caminhos para escrever', async () => {
    const cab = ['MATRÍCULA', 'LOTAÇÃO'];
    const r = await api.pedir('admin', 'POST', `/api/unidades/${api.ids.raiz}/importacao/peculio`, formulario(await planilha({ 'PECÚLIO': [cab, ['990871-1', '1ª SB']] })));
    const previa = await r.json();
    expect(previa.ignoradas[0].motivo).toMatch(/^Há mais de uma "1ª SB"\. Escreva com a unidade de cima: .*\/ 1ª SB, .*\/ 1ª SB\.$/);
    expect(previa.ignoradas[0].motivo).toContain('6º GB / 1ª SB');
  });

  it('a AJUDA do modelo lista as unidades pelo caminho (o menor pedaço único), e não mais "SIGLA (MÃE)"', async () => {
    const r = await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/importacao/peculio/modelo`);
    const textos = await lerAjuda(await r.arrayBuffer());
    expect(textos.some((t) => / \/ 1ª SB$/.test(t))).toBe(true);
    expect(textos.some((t) => /1ª SB \(/.test(t))).toBe(false);
  });
});
