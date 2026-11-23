// Gera o modelo .xlsx de um importador: abas de dados só com o cabeçalho, e a aba AJUDA por último.
import ExcelJS from 'exceljs';
import type { Contexto, Importador } from './tipos.ts';

const LINHAS_COM_OPCOES = 1001;
const LARGURA_AJUDA = 5;

function cabecalho(ws: ExcelJS.Worksheet, colunas: { rotulo: string; opcoes?: string[]; texto?: boolean }[]) {
  const linha = ws.addRow(colunas.map((c) => c.rotulo));
  linha.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  linha.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E1B1B' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  colunas.forEach((c, i) => {
    ws.getColumn(i + 1).width = Math.max(c.rotulo.length + 4, 14);
    if (c.texto) ws.getColumn(i + 1).numFmt = '@';
    if (c.opcoes?.length) {
      for (let r = 2; r <= LINHAS_COM_OPCOES; r++) {
        ws.getCell(r, i + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${c.opcoes.join(',')}"`] };
      }
    }
  });
}

async function ajuda(wb: ExcelJS.Workbook, imp: Importador<unknown>, ctx: Contexto) {
  const ws = wb.addWorksheet('AJUDA');
  [24, 24, 16, 60, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const texto = (t: string, opcoes: { negrito?: boolean; tamanho?: number } = {}) => {
    const r = ws.addRow([t]);
    ws.mergeCells(r.number, 1, r.number, LARGURA_AJUDA);
    r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    r.getCell(1).font = { bold: opcoes.negrito ?? false, size: opcoes.tamanho ?? 11 };
    r.height = Math.max(1, Math.ceil(t.length / 130)) * (opcoes.tamanho ? opcoes.tamanho + 6 : 16);
  };
  const vazia = () => ws.addRow([]);

  texto('Como usar este modelo', { negrito: true, tamanho: 16 });
  vazia();
  texto('Para que serve', { negrito: true });
  texto('Este arquivo tem as abas e as colunas que o sistema espera. Preencha, salve como .xlsx e envie na tela de importação: o sistema mostra o que vai entrar antes de gravar qualquer coisa.');
  vazia();
  texto('Como preencher', { negrito: true });
  texto(imp.modelo.semSandbox ? '1. Digite os dados nas abas deste arquivo (ou cole), a partir da linha 2.' : '1. Cole os dados da sandbox nas abas deste arquivo (ou digite), a partir da linha 2.');
  texto('2. Não mude o nome das abas nem o cabeçalho (a primeira linha). Pode haver outras colunas à direita; o sistema as ignora.');
  if (!imp.modelo.semSandbox) texto('3. Se preferir, envie a sandbox baixada em .xlsx. Se o Google Planilhas disser que o arquivo está com defeito, use este modelo e cole só as abas necessárias.');
  vazia();

  texto('Colunas', { negrito: true });
  const cab = ws.addRow(['ABA', 'COLUNA', 'PREENCHIMENTO', 'O QUE ESCREVER', 'VALORES ACEITOS']);
  cab.font = { bold: true };
  for (const aba of imp.modelo.abas) {
    for (const c of aba.colunas) {
      const r = ws.addRow([aba.nome, c.rotulo, c.obrigatoria ? 'Obrigatória' : 'Opcional', c.ajuda, c.opcoes?.join(', ') ?? '']);
      r.alignment = { wrapText: true, vertical: 'top' };
    }
  }
  vazia();

  for (const bloco of (await imp.modelo.valores?.(ctx)) ?? []) {
    texto(bloco.titulo, { negrito: true });
    for (const item of bloco.itens) texto(item);
    vazia();
  }

  texto('O que o sistema faz', { negrito: true });
  texto('Mostra tudo antes de gravar: o que é novo, o que muda e o que está igual.');
  texto('Linha com problema é pulada, com a explicação de como corrigir; as outras linhas entram.');
  texto('Enviar o mesmo arquivo de novo não duplica nada.');
  texto('Nada é apagado: o que está no sistema e não está na planilha fica como está.');
}

export async function gerarModelo(imp: Importador<unknown>, ctx: Contexto): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const aba of imp.modelo.abas) cabecalho(wb.addWorksheet(aba.nome), aba.colunas);
  await ajuda(wb, imp, ctx);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).slice().buffer;
}
