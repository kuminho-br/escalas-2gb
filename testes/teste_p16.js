// Testes da P16 (funções, viaturas, CNH e escala do Pronto). Uso: node testes/teste_p16.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(dir, f), 'utf8');

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 500) : '')); } };

/** Carrega a camada do Sheets com dublês de SpreadsheetApp/Utilities e uma aba de alocações. */
function comPlanilha(alocacoes, exporta) {
  const fontes = ['nucleo.js', 'choques.js', 'matriz.js', 'sincronia.js', 'sincronia_painel.js'].map(ler).join('\n');
  const cab = ['MATRÍCULA', 'DATA', 'SERVIÇO', 'TURNO', 'FUNÇÃO', 'UNIDADE'];
  const linhas = alocacoes.map(a => [a.mat, a.dia, a.servico, a.turno, a.funcao || '', a.unidade || '']);
  const aba = {
    getName: () => 'ALOCAÇÕES TABULADAS',
    getDataRange: () => ({ getValues: () => [cab].concat(linhas) }),
    getLastRow: () => linhas.length + 1, getLastColumn: () => cab.length, getMaxRows: () => linhas.length + 1,
    getRange: () => ({ getValues: () => [cab], setNumberFormat() { return this; }, setValues() { return this; } })
  };
  const SpreadsheetApp = {
    getActive: () => ({ getSheetByName: n => (n === 'ALOCAÇÕES TABULADAS' ? aba : null), getSpreadsheetTimeZone: () => 'America/Recife' })
  };
  const Utilities = { formatDate: () => '' };
  return new Function('SpreadsheetApp', 'Utilities', fontes + '\nreturn {' + exporta + '};')(SpreadsheetApp, Utilities);
}

console.log('== B35 (RN-36, RN-37) a gravação é conferida na própria tabela');
{
  const A = (mat, servico, turno, dia) => ({ mat, dia: '2026-11-' + (dia || '10'), servico, turno });
  const na = [A('M1', 'Pronto', 'A'), A('M2', 'JES', 'B')];
  const L = comPlanilha(na, 'conferirGravacao_, chaveAloc_');
  const rot = { lista: [], porPar: {} };
  const k = a => L.chaveAloc_(a);

  let c = L.conferirGravacao_({ inserir: [Object.assign({ chave: k(na[0]) }, na[0])], remover: [] }, 'America/Recife', rot, {});
  ver('inclusão que chegou à tabela: nada a reclamar', c.naoGravadas === 0 && c.detalhe.length === 0, c);

  const fantasma = A('M9', 'Pronto', 'A');
  c = L.conferirGravacao_({ inserir: [Object.assign({ chave: k(fantasma) }, fantasma)], remover: [] }, 'America/Recife', rot, {});
  ver('inclusão que NÃO chegou é detectada e descrita', c.naoGravadas === 1 && /não entrou/.test(c.detalhe[0]) && /M9|matrícula/.test(c.detalhe[0]), c);

  c = L.conferirGravacao_({ inserir: [], remover: [{ chave: k(na[1]) }] }, 'America/Recife', rot, {});
  ver('exclusão que não saiu da tabela é detectada', c.naoGravadas === 1 && /não saiu/.test(c.detalhe[0]), c);

  c = L.conferirGravacao_({ inserir: [], remover: [{ chave: k(fantasma) }] }, 'America/Recife', rot, {});
  ver('exclusão que saiu mesmo: nada a reclamar', c.naoGravadas === 0, c);

  const muitas = [];
  for (let i = 0; i < 9; i++) muitas.push(Object.assign({ chave: k(A('X' + i, 'Pronto', 'A')) }, A('X' + i, 'Pronto', 'A')));
  c = L.conferirGravacao_({ inserir: muitas, remover: [] }, 'America/Recife', rot, {});
  ver('conta todas as que faltaram, mas detalha no máximo 5', c.naoGravadas === 9 && c.detalhe.length === 5, c);
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
