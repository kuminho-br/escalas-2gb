// A planilha das linhas com problema (entrega 6.57): para toda importação, as linhas que a prévia recusou (ou, no Pecúlio, que tiveram célula ignorada), com as mesmas abas e o mesmo
// cabeçalho do arquivo enviado e duas colunas a mais, "MOTIVO" e "COMO CORRIGIR". Dá para corrigir no Excel e enviar de novo: as colunas a mais a importação ignora.
import type { Previa } from 'contratos';
import ExcelJS from 'exceljs';
import { cabecalho } from './modelo.ts';
import type { Aba } from './planilha.ts';

/** 'dd/mm/aaaa' (o texto que a leitura da planilha guarda da data do Excel) como a data, em UTC; outro formato dá null. */
function dataDoTexto(texto: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

export const COLUNA_MOTIVO = 'MOTIVO';
export const COLUNA_COMO_CORRIGIR = 'COMO CORRIGIR';

/**
 * O arquivo das linhas com problema, ou null se nenhuma linha tem problema. `ordem` são as abas da importação (as do arquivo enviado, na ordem do cadastro); `abaDasIgnoradas` é a aba
 * onde caem as células ignoradas (só o Pecúlio as tem). Linha recusada: MOTIVO é a mensagem e COMO CORRIGIR a solução; linha com célula ignorada: um "coluna: motivo" por linha da célula.
 * Problema sem linha de dados (da planilha inteira, como a coluna que falta) não entra: já aparece na tela. Toda célula sai como texto, como foi lida; a que o Excel tinha transformado em data
 * volta como data (a mesma marca que a importação usa para ignorá-la: como texto, passaria a valer). Com `arquivoInteiro` (cadastros em que várias linhas formam uma coisa só), saem todas as
 * linhas das abas, e o motivo só nas que têm problema.
 */
export async function planilhaDasLinhasComProblema(abas: Record<string, Aba>, ordem: string[], previa: Pick<Previa, 'problemas' | 'ignoradas'>, abaDasIgnoradas: string | null, arquivoInteiro = false): Promise<ArrayBuffer | null> {
  // por aba, por número de linha: os motivos e as soluções
  const achados = new Map<string, Map<number, { motivos: string[]; solucoes: string[] }>>();
  const da = (aba: string, linha: number) => {
    if (!achados.has(aba)) achados.set(aba, new Map());
    const porLinha = achados.get(aba)!;
    if (!porLinha.has(linha)) porLinha.set(linha, { motivos: [], solucoes: [] });
    return porLinha.get(linha)!;
  };
  for (const p of previa.problemas) {
    if (p.linha < 2) continue;
    const a = da(p.aba, p.linha);
    a.motivos.push(p.mensagem);
    a.solucoes.push(p.solucao);
  }
  if (abaDasIgnoradas) for (const i of previa.ignoradas) da(abaDasIgnoradas, i.linha).motivos.push(`${i.coluna}: ${i.motivo}`);

  const wb = new ExcelJS.Workbook();
  let total = 0;
  for (const nome of ordem) {
    const aba = abas[nome];
    if (!aba) continue;
    const ws = wb.addWorksheet(nome);
    cabecalho(ws, [...aba.cab, COLUNA_MOTIVO, COLUNA_COMO_CORRIGIR].map((rotulo) => ({ rotulo, texto: true })));
    const porLinha = achados.get(nome);
    for (const l of aba.linhas) {
      const a = porLinha?.get(l.linha);
      if (!a && !arquivoInteiro) continue;
      if (a) total++;
      // a célula que o Excel tinha transformado em data volta como data: assim a importação a reconhece de novo (como texto, "15/03/2026" passaria a valer)
      const celulas = aba.cab.map((_, i): string | Date => (l.datas?.[i] ? (dataDoTexto(l.celulas[i] ?? '') ?? l.celulas[i] ?? '') : (l.celulas[i] ?? '')));
      const linha = ws.addRow([...celulas, a?.motivos.join('\n') ?? '', a?.solucoes.join('\n') ?? '']);
      linha.eachCell({ includeEmpty: true }, (cel) => { cel.numFmt = cel.value instanceof Date ? 'dd/mm/yyyy' : '@'; });
      const ultimas = aba.cab.length;
      linha.getCell(ultimas + 1).alignment = { wrapText: true, vertical: 'top' };
      linha.getCell(ultimas + 2).alignment = { wrapText: true, vertical: 'top' };
    }
    ws.getColumn(aba.cab.length + 1).width = 60;
    ws.getColumn(aba.cab.length + 2).width = 50;
  }
  if (total === 0) return null;
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer).slice().buffer;
}
