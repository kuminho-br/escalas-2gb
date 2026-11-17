// Leitura do .xlsx baixado da sandbox: o texto de cada célula, como aparece na planilha.
import { normalizar } from 'dominio';
import ExcelJS from 'exceljs';

export type Aba = { cab: string[]; linhas: { linha: number; celulas: string[] }[] };

const dois = (n: number) => String(n).padStart(2, '0');

// Datas do Excel vêm como Date em UTC; hora pura vem com o dia 30/12/1899.
function textoDaData(d: Date): string {
  if (d.getUTCFullYear() <= 1900) return `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function textoDaCelula(cel: ExcelJS.Cell): string {
  const v = cel.value;
  if (v == null) return '';
  if (v instanceof Date) return textoDaData(v);
  if (typeof v === 'object' && 'result' in v) {
    const r = v.result;
    if (r instanceof Date) return textoDaData(r);
    return r == null || typeof r === 'object' ? '' : String(r).trim();
  }
  return cel.text.trim();
}

/** Abas pelo nome; linhas vazias são puladas e a numeração é a da planilha (cabeçalho = 1). */
export async function lerPlanilha(arquivo: ArrayBuffer): Promise<Record<string, Aba>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo);
  const abas: Record<string, Aba> = {};
  wb.eachSheet((ws) => {
    const cab: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (cel, n) => {
      cab[n - 1] = textoDaCelula(cel);
    });
    const largura = Math.max(cab.length, ws.columnCount);
    for (let i = 0; i < largura; i++) cab[i] ??= '';
    const linhas: Aba['linhas'] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      const celulas = Array.from({ length: largura }, (_, i) => textoDaCelula(row.getCell(i + 1)));
      if (celulas.some((c) => c !== '')) linhas.push({ linha: n, celulas });
    });
    abas[ws.name] = { cab, linhas };
  });
  return abas;
}

/** Índice da coluna pelo rótulo (sem acento nem caixa; aceita prefixo); -1 se não houver. */
export function coluna(aba: Aba, rotulo: string): number {
  const cab = aba.cab.map(normalizar);
  const alvo = normalizar(rotulo);
  const exato = cab.indexOf(alvo);
  return exato >= 0 ? exato : cab.findIndex((c) => c.startsWith(alvo));
}

/** Data que o Planilhas converteu ('01/12/2026') volta a ser o mês digitado ('2026-12'); o resto passa como veio. */
export const mesDaCelula = (t: string): string => t.replace(/^\d{2}\/(\d{2})\/(\d{4})$/, '$2-$1');
