import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.57, Task 2: a planilha das linhas com problema (POST .../importacao/:cadastro?erros=1). Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
const hoje = hojeRecife();
const CAB_PECULIO = ['MATRÍCULA', 'POSTO/GRAD', 'NOME COMPLETO', 'NOME DE GUERRA', 'NASCIMENTO', 'TELEFONE', 'LOTAÇÃO'];
type Celula = string | number | Date | null;

const erros = (quem: 'gestorGb' | 'escalante' | 'semPapel', unidade: string, cadastro: string, arquivo: ArrayBuffer) =>
  api.pedir(quem, 'POST', `/api/unidades/${unidade}/importacao/${cadastro}?erros=1`, formulario(arquivo));
async function abrirArquivo(r: Response) {
  expect(r.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await r.arrayBuffer());
  const abas: Record<string, string[][]> = {};
  wb.eachSheet((ws) => {
    const linhas: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => linhas.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
    abas[ws.name] = linhas;
  });
  return { wb, abas };
}

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('o Pecúlio: linha recusada e célula ignorada', () => {
  const linhas: Celula[][] = [
    ['990871-1', 'SD', 'Certo de Tal', 'CERTO', '15/03', '(81) 99999-0001', '1ª SB'],
    ['990872-2', 'XYZ', 'Posto Ruim', 'POSTORUIM', '', '', '1ª SB'], // posto inválido em militar novo: recusada
    ['9908', 'SD', 'Sem Matrícula Boa', 'SEMMAT', '', '', '1ª SB'], // matrícula inválida: recusada
    ['990873-3', 'SD', 'Tel Longo', 'TELLONGO', '31/02', '1'.repeat(25), '1ª SB'], // duas células ignoradas
  ];
  const enviar = async () => planilha({ 'PECÚLIO': [CAB_PECULIO, ...linhas] });

  it('só as linhas com problema, na ordem original, com o cabeçalho do enviado e as colunas MOTIVO e COMO CORRIGIR no fim', async () => {
    const { abas } = await abrirArquivo(await erros('gestorGb', api.ids.gb, 'peculio', await enviar()));
    const aba = abas['PECÚLIO']!;
    expect(aba[0]).toEqual([...CAB_PECULIO, 'MOTIVO', 'COMO CORRIGIR']);
    expect(aba.slice(1).map((l) => l[0])).toEqual(['990872-2', '9908', '990873-3']);
    // linha recusada: MOTIVO = a mensagem, COMO CORRIGIR = a solução
    expect(aba[2]![7]).toContain('Matrícula inválida');
    expect(aba[2]![8]).toContain('6 dígitos');
    // linha com células ignoradas: um motivo por linha da célula ("coluna: motivo"), COMO CORRIGIR vazio
    const ignorada = aba[3]!;
    expect(ignorada[7]!.split('\n')).toEqual([expect.stringMatching(/^NASCIMENTO: /), expect.stringMatching(/^TELEFONE: /)]);
    expect(ignorada[8]).toBe('');
  });

  it('Review Focus 5: a célula como lida (o texto), sem virar data nem número; toda célula é texto', async () => {
    const { wb } = await abrirArquivo(await erros('gestorGb', api.ids.gb, 'peculio', await enviar()));
    const ws = wb.getWorksheet('PECÚLIO')!;
    const celula = ws.getRow(4).getCell(5);
    expect(celula.text).toBe('31/02');
    expect(celula.type).toBe(ExcelJS.ValueType.String);
    expect(ws.getColumn(1).numFmt).toBe('@');
    expect(ws.getRow(3).getCell(1).text).toBe('9908');
  });

  it('Review Focus 3: o arquivo baixado, com a linha corrigida, entra na importação (MOTIVO e COMO CORRIGIR não atrapalham)', async () => {
    const { wb } = await abrirArquivo(await erros('gestorGb', api.ids.gb, 'peculio', await enviar()));
    const ws = wb.getWorksheet('PECÚLIO')!;
    ws.getRow(2).getCell(2).value = 'SD'; // o posto da 990872-2 corrigido
    ws.getRow(3).getCell(1).value = '990874-4'; // a matrícula corrigida
    const corrigido = await wb.xlsx.writeBuffer();
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.gb}/importacao/peculio`, formulario(new Uint8Array(corrigido as ArrayBuffer).slice().buffer));
    const previa = await r.json();
    expect(previa.problemas).toEqual([]);
    expect(previa.novos.map((n: { chave: string }) => n.chave)).toEqual(['990872-2', '990874-4', '990873-3']);
  });

  it('o arquivo sem nenhuma linha com problema: 400 com a mensagem fixa', async () => {
    const limpo = await planilha({ 'PECÚLIO': [CAB_PECULIO, linhas[0]!] });
    const r = await erros('gestorGb', api.ids.gb, 'peculio', limpo);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erro: 'Nenhuma linha com problema nesta planilha.' });
  });

  it('nunca grava: pedir a planilha de erros não cria militar nem auditoria', async () => {
    const antes = (await api.banco.query<{ n: number }>('select (select count(*) from militar)::int + (select count(*) from auditoria)::int as n')).rows[0]!.n;
    await erros('gestorGb', api.ids.gb, 'peculio', await enviar());
    const depois = (await api.banco.query<{ n: number }>('select (select count(*) from militar)::int + (select count(*) from auditoria)::int as n')).rows[0]!.n;
    expect(depois).toBe(antes);
  });

  it('as mesmas permissões da importação: o militar comum leva 403, e quem não é do Pecúlio também', async () => {
    expect((await erros('semPapel', api.ids.gb, 'peculio', await enviar())).status).toBe(403);
    expect((await erros('escalante', api.ids.gb, 'peculio', await enviar())).status).toBe(403);
  });

  it('importação desconhecida: 404', async () => {
    expect((await erros('gestorGb', api.ids.gb, 'nao-existe', await enviar())).status).toBe(404);
  });
});

describe('a importação com várias abas (Serviços e escalas)', () => {
  const CAB_T = ['SERVIÇO', 'TURNO', 'HORÁRIO INÍCIO', 'HORÁRIO FIM', 'DURAÇÃO', 'TIPO DE SERVIÇO', 'ORIGEM'];
  const CAB_E = ['ESCALA', 'SERVIÇOS', 'TÍTULO', 'MILITARES', 'DIAS'];
  const CAB_V = ['VIGÊNCIA (A PARTIR DE)', 'ESCALA', 'TURNO', 'GUARNIÇÃO'];

  it('Review Focus 4: só a linha com problema sai, na sua aba; as outras abas saem só com o cabeçalho; a AJUDA não entra', async () => {
    const arquivo = await planilha({
      TURNOS: [CAB_T, ['Pronto', 'A', '08:00', '20:00', 12, 'Ordinário', ''], ['Pronto', 'Z', '20:00', '08:00', 12, 'Ordinário', '']],
      ESCALAS: [CAB_E, ['Ordinário', 'Pronto', 'ESCALA ORDINÁRIA', 'TODOS', 'TODOS']],
      'GUARNIÇÕES POR ESCALA': [CAB_V],
    });
    const { abas } = await abrirArquivo(await erros('escalante', api.ids.secao, 'servicos-escalas', arquivo));
    expect(Object.keys(abas)).toEqual(['TURNOS', 'ESCALAS', 'GUARNIÇÕES POR ESCALA']);
    expect(abas.TURNOS![0]).toEqual([...CAB_T, 'MOTIVO', 'COMO CORRIGIR']);
    expect(abas.TURNOS).toHaveLength(2);
    expect(abas.TURNOS![1]![1]).toBe('Z');
    expect(abas.TURNOS![1]![7]).toContain('Turno "Z"');
    expect(abas.TURNOS![1]![8]).toBe('Use A, B ou C na coluna TURNO.');
    expect(abas.ESCALAS).toEqual([[...CAB_E, 'MOTIVO', 'COMO CORRIGIR']]);
    expect(abas['GUARNIÇÕES POR ESCALA']).toEqual([[...CAB_V, 'MOTIVO', 'COMO CORRIGIR']]);
  });

  it('o nome do arquivo é {cadastro}-linhas-com-problema-{data}.xlsx', async () => {
    const arquivo = await planilha({ TURNOS: [CAB_T, ['Pronto', 'Z', '20:00', '08:00', 12, 'Ordinário', '']], ESCALAS: [CAB_E], 'GUARNIÇÕES POR ESCALA': [CAB_V] });
    const r = await erros('escalante', api.ids.secao, 'servicos-escalas', arquivo);
    expect(r.headers.get('content-disposition')).toContain(`servicos-escalas-linhas-com-problema-${hoje}.xlsx`);
  });
});
