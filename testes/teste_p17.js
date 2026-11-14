// Testes da P17 (front-end da Grade Geral). Uso: node testes/teste_p17.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(dir, f), 'utf8');

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 600) : '')); } };

/* ------------------------------------------------------------------ planilha que registra */
// A aba de mentira guarda os valores e REGISTRA cada chamada de formatação, com a faixa em A1.
const colA1 = c => { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const a1 = (r, c, nr, nc) => (nr > 1 || nc > 1) ? colA1(c) + r + ':' + colA1(c + nc - 1) + (r + nr - 1) : colA1(c) + r;

function abaQueRegistra(nome) {
  const log = [], larguras = {}, valores = {};
  let regras = [];
  const regra = () => {
    const r = { feitos: [] };
    const P = new Proxy(r, { get(t, k) { if (k === 'build') return () => t; return (...a) => { t.feitos.push([k, ...a]); return P; }; } });
    return P;
  };
  const faixa = (r, c, nr, nc) => {
    nr = nr || 1; nc = nc || 1;
    const nomeA1 = a1(r, c, nr, nc);
    const R = {
      getA1Notation: () => nomeA1,
      setValues(m) { m.forEach((l, i) => l.forEach((v, j) => { valores[(r + i) + ',' + (c + j)] = v; })); log.push(['setValues', nomeA1]); return P; },
      setValue(v) { valores[r + ',' + c] = v; return P; },
      getValue: () => valores[r + ',' + c]
    };
    const P = new Proxy(R, { get(t, k) { if (k in t) return t[k]; return (...a) => { log.push([k, nomeA1, ...a]); return P; }; } });
    return P;
  };
  const aba = {
    log, larguras, valores, get regras() { return regras; },
    getName: () => nome, getMaxRows: () => 300, getMaxColumns: () => 40,
    insertRowsAfter() {}, insertColumnsAfter() {},
    getRange: faixa,
    getRangeList: lista => new Proxy({}, { get(t, k) { return (...a) => { lista.forEach(x => log.push([k, x, ...a])); }; } }),
    setConditionalFormatRules(rs) { regras = rs; },
    setColumnWidth(c, w) { larguras[c] = w; }, setColumnWidths(c, n, w) { for (let i = 0; i < n; i++) larguras[c + i] = w; },
    getColumnWidth: c => larguras[c] || 100,
    autoResizeColumns(c, n) { log.push(['autoResizeColumns', c, n]); for (let i = 0; i < n; i++) larguras[c + i] = 60; },
    setFrozenRows() {}, setFrozenColumns() {}, showRows() {}
  };
  const SpreadsheetApp = {
    newDataValidation: regra, newConditionalFormatRule: regra, flush() {},
    BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM', SOLID_THICK: 'SOLID_THICK', DOUBLE: 'DOUBLE' }
  };
  return { aba, SpreadsheetApp };
}

/** Carrega o código da grade com os dublês. */
function carregar(SpreadsheetApp) {
  const fontes = ['nucleo.js', 'choques.js', 'regras_escala.js', 'sincronia.js', 'matriz.js'].map(ler).join('\n');
  const Utilities = { parseDate: s => s, formatDate: () => '' };
  return new Function('SpreadsheetApp', 'Utilities', fontes +
    '\nreturn {renderizarMatriz_, montarModeloMatriz_, montarRotulos_, montarHorarios_, montarLegenda_, corDoServico_, coresDosServicos_, CORES_DOS_SERVICOS_};')(SpreadsheetApp, Utilities);
}

const L = carregar({});
const hor = L.montarHorarios_([
  { servico: 'Pronto', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'Pronto', turno: 'B', inicio: '20:00', fim: '08:00' },
  { servico: 'Saldo', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'JES', turno: 'A', inicio: '07:00', fim: '19:00' },
  { servico: 'Adm', turno: 'A', inicio: '08:00', fim: '17:00' }, { servico: 'Bioma', turno: 'A', inicio: '06:00', fim: '18:00' },
  { servico: 'PE Seguro', turno: 'A', inicio: '16:00', fim: '00:00' }, { servico: 'Defensoria', turno: 'A', inicio: '07:00', fim: '19:00' },
  { servico: 'CPRH', turno: 'A', inicio: '08:00', fim: '17:00' }, { servico: 'Mergulho', turno: 'A', inicio: '08:00', fim: '12:00' }
]).porChave;
const rot = L.montarRotulos_(hor);
const mil = (mat, nome, posto, jornada, equipe, ordem, antig) => ({ mat, nome, posto, secao: '1ª SB', jornada, equipe, antig: antig === undefined ? '' : antig, ordem });
const MILITARES = [
  mil('1', 'ANA', 'SD BM', 'PRONTO', 'ALFA', 0), mil('2', 'BIA', 'ST BM', 'PRONTO', 'ALFA', 1),
  mil('3', 'CAIO', '3º SGT BM', 'PRONTO', 'ALFA', 2), mil('4', 'DANI', 'CB BM', 'PRONTO', 'BRAVO', 3),
  mil('5', 'EDU', '1º SGT BM', 'PRONTO', 'BRAVO', 4), mil('6', 'FIA', '2º SGT BM', 'ADM', '', 5)
];
const ALOCS = [
  { mat: '1', dia: '2026-11-02', servico: 'Pronto', turno: 'A' }, { mat: '2', dia: '2026-11-03', servico: 'Saldo', turno: 'A' },
  { mat: '4', dia: '2026-11-04', servico: 'Mergulho', turno: 'A' }
];
const modelo = op => L.montarModeloMatriz_(ALOCS, MILITARES, Object.assign({ mes: '2026-11', secao: '1ª SB', linhas: 2, rotulos: rot, horarios: hor }, op || {}));

function desenhar(m) {
  const { aba, SpreadsheetApp } = abaQueRegistra('GRADE GERAL');
  const G = carregar(SpreadsheetApp);
  G.renderizarMatriz_(aba, m || modelo(), { mes: '2026-11', secao: '1ª SB' }, rot, 'America/Recife');
  return aba;
}

console.log('== P17 item 1 (RN-02) cada serviço tem uma cor só, e os do Ordinário são verdes');
{
  const verde = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return g > r && g > b; };
  const ord = ['Pronto', 'Saldo', 'JES'].map(L.corDoServico_);
  ver('Pronto, Saldo e JES têm fundo verde', ord.every(c => verde(c[0])), ord);
  ver('e os três são diferentes entre si', new Set(ord.map(c => c[0])).size === 3, ord);
  const outros = ['Adm', 'Bioma', 'PE Seguro', 'Defensoria', 'CPRH', 'Eleições', 'Mergulho', 'Operação Qualquer'].map(L.corDoServico_);
  ver('nenhum outro serviço (cadastrado ou novo) usa fundo verde', outros.every(c => !verde(c[0])), outros);
  ver('a cor não depende de caixa nem de acento', L.corDoServico_('pe seguro') === L.corDoServico_('PE Seguro') && L.corDoServico_('ELEICOES') === L.corDoServico_('Eleições'));
  ver('serviço novo ganha cor, sempre a mesma', L.corDoServico_('Mergulho') && L.corDoServico_('Mergulho')[0] === L.corDoServico_('mergulho')[0]);
  ver('nome vazio não tem cor', L.corDoServico_('') === null);

  const aba = desenhar();
  const servicosComRegra = aba.regras.map(r => (r.feitos.find(f => f[0] === 'whenFormulaSatisfied') || [])[1]);
  ver('a grade tem uma regra de cor para CADA serviço da aba TURNOS (inclusive Saldo e Mergulho)',
    aba.regras.length === 9 && ['Saldo', 'Mergulho', 'Pronto'].every(s => servicosComRegra.some(f => f.indexOf('^' + s + ' ') >= 0)), servicosComRegra);
  ver('a regra casa sem diferença de maiúscula/minúscula', servicosComRegra.every(f => f.indexOf('(?i)^') >= 0), servicosComRegra[0]);
  const regraSaldo = aba.regras.find(r => r.feitos.some(f => f[0] === 'whenFormulaSatisfied' && f[1].indexOf('^Saldo ') >= 0));
  ver('a cor da regra é a de corDoServico_', regraSaldo.feitos.some(f => f[0] === 'setBackground' && f[1] === L.corDoServico_('Saldo')[0]));

  const leg = L.montarLegenda_(hor, L.coresDosServicos_(['Pronto', 'Mergulho']));
  ver('a legenda usa a mesma cor', leg.find(g => g.servico === 'Pronto').fundo === L.corDoServico_('Pronto')[0] && leg.find(g => g.servico === 'Mergulho').fundo === L.corDoServico_('Mergulho')[0]);
}

console.log('== P17 item 2 (RN-02) a largura de cada coluna vem do conteúdo');
{
  const aba = desenhar();
  const nCols = 3 + 30;
  const auto = aba.log.find(x => x[0] === 'autoResizeColumns');
  ver('autoResizeColumns em todas as colunas da grade (identificação + 30 dias)', auto && auto[1] === 1 && auto[2] === nCols, auto);
  // o dublê põe 60 px depois do autoResize: a folga vem por cima
  ver('dia: largura do conteúdo + folga da seta da lista', aba.larguras[4] === 60 + 24 && aba.larguras[nCols] === 84, aba.larguras);
  ver('identificação: largura do conteúdo + folga menor', aba.larguras[1] === 72 && aba.larguras[2] === 72 && aba.larguras[3] === 72, aba.larguras);
  ver('nenhuma coluna fica com largura fixa antiga (92 px, 200 px)', Object.values(aba.larguras).every(w => w !== 92 && w !== 200));
}

/** Os itens do menu "Escalas - 2º GB", chamando o onOpen de verdade com um menu de mentira. */
function itensDoMenu() {
  const itens = [];
  const menu = { addItem(t, f) { itens.push([t, f]); return menu; }, addSeparator() { return menu; }, addToUi() {} };
  const fontes = ['nucleo.js', 'choques.js', 'regras_escala.js', 'sincronia.js', 'matriz.js'].map(ler).join('\n');
  new Function('SpreadsheetApp', fontes + '\nreturn onOpen;')({ getUi: () => ({ createMenu: () => menu }) })();
  return itens;
}
/** O título que cada painel põe na barra lateral (setTitle) e o <h1> do HTML. */
function tituloDoPainel(arquivoJs, funcao, html) {
  let titulo = '';
  const out = { setTitle(t) { titulo = t; return out; }, setWidth() { return out; } };
  const fontes = ['nucleo.js', 'choques.js', 'regras_escala.js', 'sincronia.js', 'matriz.js', arquivoJs].map(ler).join('\n');
  try {
    new Function('SpreadsheetApp', 'HtmlService', fontes + '\nreturn ' + funcao + ';')(
      { getUi: () => ({ showSidebar() {} }), getActive: () => ({ getSheets: () => [], getSheetByName: () => null }) },
      { createHtmlOutputFromFile: () => out, createTemplateFromFile: () => ({ evaluate: () => out }) })();
  } catch (e) { /* o painel pode ler a planilha depois de pôr o título */ }
  const h1 = (ler(html).match(/<h1>([^<]*)<\/h1>/) || [])[1];
  return { titulo, h1 };
}

console.log('== P17 item 3 o painel "Mostrar Escala" passa a ser "Mostrar Grade Geral"');
{
  const itens = itensDoMenu();
  ver('o menu tem "Mostrar Grade Geral", ligado ao mesmo painel', itens.some(i => i[0] === 'Mostrar Grade Geral' && i[1] === 'abrirPainelMatriz'), itens);
  ver('e não tem mais "Mostrar Escala"', !itens.some(i => i[0] === 'Mostrar Escala'));
  const p = tituloDoPainel('sincronia_painel.js', 'abrirPainelMatriz', 'sidebar_matriz.html');
  ver('a barra lateral e o cabeçalho do painel dizem "Mostrar Grade Geral"', p.titulo === 'Mostrar Grade Geral' && p.h1 === 'Mostrar Grade Geral', p);
  const html = ler('sidebar_matriz.html');
  ver('o botão de carregar fala da grade geral', /Carregar grade geral<\/button>/.test(html) && !/Carregar escala<\/button>/.test(html));
  const todos = fs.readdirSync(dir).filter(f => /\.(js|html)$/.test(f)).map(f => [f, ler(f)]);
  const restos = todos.filter(([f, s]) => s.replace(/antes "Mostrar Escala"/g, '').indexOf('Mostrar Escala') >= 0).map(x => x[0]);
  ver('nenhum texto do sistema manda mais o usuário ao "Mostrar Escala"', restos.length === 0, restos);
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
