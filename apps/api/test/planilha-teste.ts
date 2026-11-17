import ExcelJS from 'exceljs';

/** Monta um .xlsx em memória (dados fictícios, D7). Cada aba: cabeçalho na 1ª linha. */
export async function planilha(abas: Record<string, (string | number | Date | null)[][]>): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const [nome, linhas] of Object.entries(abas)) wb.addWorksheet(nome).addRows(linhas);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).slice().buffer;
}

export function formulario(arquivo: ArrayBuffer): FormData {
  const fd = new FormData();
  fd.append('arquivo', new File([arquivo], 'sandbox.xlsx'));
  return fd;
}
