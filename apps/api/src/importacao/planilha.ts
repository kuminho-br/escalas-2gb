// Leitura do .xlsx baixado da sandbox: o texto de cada célula, como aparece na planilha.
import { Data, Mes } from 'contratos';
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

const dois2 = (n: number | string) => String(n).padStart(2, '0');

/** Ano de dois dígitos vira 20aa (a planilha de mês e dia é recente). */
const anoCompleto = (a: string) => (a.length === 2 ? `20${a}` : a);

/**
 * O mês que a pessoa escreveu ou que o Planilhas converteu em data, como 'aaaa-mm'. Vazio dá ''; o que não se lê (ou o ano 0000,
 * mês 13…) dá null. Aceita aaaa-mm, aaaa-m, mm/aaaa, m/aaaa, mm/aa, m/aa e dd/mm/aaaa (vira o mês da data).
 */
export function lerMes(texto: string): string | null {
  const t = texto.trim();
  if (t === '') return '';
  let ano: string | undefined;
  let mes: string | undefined;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{1,2})$/.exec(t))) [, ano, mes] = m;
  else if ((m = /^(\d{1,2})\/(\d{4}|\d{2})$/.exec(t))) [, mes, ano] = m;
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) {
    // a data inteira tem de existir (31/02 não vira fevereiro)
    if (!lerData(t)) return null;
    [, , mes, ano] = m;
  }
  if (!ano || !mes) return null;
  const candidato = `${anoCompleto(ano)}-${dois2(mes)}`;
  return Mes.safeParse(candidato).success ? candidato : null;
}

/** A data como 'aaaa-mm-dd'; null se não se lê ou não existe (31/02, ano 0000). Aceita dd/mm/aaaa, d/m/aaaa, dd/mm/aa, aaaa-mm-dd e aaaa-m-d. */
export function lerData(texto: string): string | null {
  const t = texto.trim();
  let d: string | undefined;
  let mes: string | undefined;
  let ano: string | undefined;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(t))) [, d, mes, ano] = m;
  else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) [, ano, mes, d] = m;
  if (!ano || !mes || !d) return null;
  const candidata = `${anoCompleto(ano)}-${dois2(mes)}-${dois2(d)}`;
  return Data.safeParse(candidata).success ? candidata : null;
}
