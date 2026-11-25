/**
 * As matrículas de um arquivo de texto (`.txt` ou `.csv`): uma por linha, na primeira coluna (separada por vírgula, ponto e vírgula ou tabulação). Um cabeçalho
 * ("Matrícula") na primeira linha é opcional e sai; linhas vazias e matrículas repetidas (com ou sem pontuação: "990012-3" e "9900123") valem uma vez só, a primeira como veio.
 */
export function lerMatriculas(texto: string): string[] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const vistas = new Set<string>();
  const matriculas: string[] = [];
  let primeiraLinha = true;
  for (const linha of linhas) {
    const celula = (linha.split(/[;,\t]/)[0] ?? '').trim().replace(/^"|"$/g, '').trim();
    if (!celula) continue;
    const eraAPrimeira = primeiraLinha;
    primeiraLinha = false;
    // o cabeçalho é a primeira linha com texto e nenhum dígito
    if (eraAPrimeira && !/\d/.test(celula)) continue;
    const chave = celula.replace(/\D/g, '') || celula;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    matriculas.push(celula);
  }
  return matriculas;
}
