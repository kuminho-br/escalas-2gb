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
    '\nreturn {renderizarMatriz_, montarModeloMatriz_, montarRotulos_, montarHorarios_, montarLegenda_, corDoServico_, coresDosServicos_, CORES_DOS_SERVICOS_, desenhoDasLinhas_, ordemDoPosto_};')(SpreadsheetApp, Utilities);
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

console.log('== P17 item 4 (RN-02) o que se repete na identificação fica quase branco, sem mesclar');
{
  const lin = [{ mat: '1', grupo: 'ALFA' }, { mat: '1', grupo: 'ALFA' }, { mat: '2', grupo: 'ALFA' }, { mat: '2', grupo: 'ALFA' },
    { mat: '3', grupo: 'BRAVO' }, { mat: '3', grupo: 'BRAVO' }, { mat: '4', grupo: 'BRAVO' }];
  const d = L.desenhoDasLinhas_(lin);
  ver('2ª linha do mesmo militar: as três colunas se repetem', d.repeteMilitar.join() === '1,3,5', d);
  ver('1ª linha de outro militar da mesma equipe: só a EQUIPE se repete', d.repeteEquipe.join() === '2,6', d);
  ver('1ª linha de grupo novo: nada se repete', d.repeteMilitar.indexOf(4) < 0 && d.repeteEquipe.indexOf(4) < 0);
  ver('grade vazia não quebra', L.desenhoDasLinhas_([]).repeteMilitar.length === 0);

  const m = modelo(), aba = desenhar(m);
  const quaseBranco = aba.log.filter(x => x[0] === 'setFontColor' && x[2] === '#E8EAED').map(x => x[1]);
  const esperado = L.desenhoDasLinhas_(m.linhas);
  ver('a grade pinta de quase branco exatamente as repetições',
    quaseBranco.length === esperado.repeteMilitar.length + esperado.repeteEquipe.length &&
    esperado.repeteMilitar.every(i => quaseBranco.indexOf('A' + (5 + i) + ':C' + (5 + i)) >= 0) &&
    esperado.repeteEquipe.every(i => quaseBranco.indexOf('C' + (5 + i)) >= 0), [quaseBranco, esperado]);
  ver('a 1ª linha da grade não é pintada', quaseBranco.every(a => !/^[AC]5(:|$)/.test(a)), quaseBranco);
  ver('nenhuma célula é mesclada', !aba.log.some(x => /merge/i.test(x[0])));
  ver('o cinza médio antigo (#9AA0A6) saiu', !aba.log.some(x => x[0] === 'setFontColor' && x[2] === '#9AA0A6'));
  const ident = m.linhas.map((l, i) => [aba.valores[(5 + i) + ',1'], aba.valores[(5 + i) + ',3']]);
  ver('matrícula e equipe continuam escritas em todas as linhas (filtro e ordenação seguem valendo)', ident.every(x => x[0] && x[1]), ident);
}

console.log('== P17 item 5 (RN-02) dentro da equipe, os militares vêm por antiguidade');
{
  ver('hierarquia: ST > 1º SGT > 2º SGT > 3º SGT > CB > SD',
    ['ST BM', '1º SGT BM', '2º SGT BM', '3º SGT BM', 'CB BM', 'SD BM'].map(L.ordemDoPosto_).every((v, i, a) => i === 0 || a[i - 1] < v));
  ver('oficiais antes das praças', L.ordemDoPosto_('CAP BM') < L.ordemDoPosto_('ST BM') && L.ordemDoPosto_('1º TEN BM') < L.ordemDoPosto_('ST BM'));
  ver('escrita sem "BM", sem "º" e por extenso também vale', L.ordemDoPosto_('2 SGT') === L.ordemDoPosto_('2º SGT BM') && L.ordemDoPosto_('Cabo') === L.ordemDoPosto_('CB BM') && L.ordemDoPosto_('Subtenente') === L.ordemDoPosto_('ST BM'));
  ver('posto desconhecido ou vazio vai para o fim', L.ordemDoPosto_('') === Infinity && L.ordemDoPosto_('XYZ') === Infinity);

  const ordem = m => m.linhas.filter((l, i, a) => i === 0 || a[i - 1].mat !== l.mat).map(l => l.nome);
  ver('ALFA: ST, depois 3º SGT, depois SD (o cadastro tinha SD, ST, 3º SGT)',
    ordem(modelo()).slice(0, 3).join() === 'ST BM BIA,3º SGT BM CAIO,SD BM ANA', ordem(modelo()));
  ver('BRAVO: 1º SGT antes do CB', ordem(modelo()).slice(3, 5).join() === '1º SGT BM EDU,CB BM DANI', ordem(modelo()));
  const mesmoPosto = [mil('7', 'GIL', 'SD BM', 'PRONTO', 'ALFA', 0, 12), mil('8', 'HUGO', 'SD BM', 'PRONTO', 'ALFA', 1, 3), mil('9', 'IVO', 'SD BM', 'PRONTO', 'ALFA', 2)];
  const mp = L.montarModeloMatriz_([], mesmoPosto, { mes: '2026-11', secao: '1ª SB', linhas: 1, rotulos: rot, horarios: hor });
  ver('mesmo posto: a ANTIG. desempata; sem ANTIG., o cadastro', mp.linhas.map(l => l.mat).join() === '8,7,9', mp.linhas.map(l => l.mat));
  ver('as equipes continuam na ordem de sempre', modelo().linhas.map(l => l.grupo).filter((g, i, a) => a.indexOf(g) === i).join() === 'ALFA,BRAVO,ADM');

  // a sandbox (anonimizada): ANTIG. vazia em todas as 208 linhas
  const sbx = JSON.parse(fs.readFileSync(path.join(__dirname, 'militares_sandbox.json'), 'utf8'));
  const ms = L.montarModeloMatriz_([], sbx, { mes: '2026-11', secao: '1ª SB', linhas: 1, rotulos: rot, horarios: hor });
  const postoDe = Object.fromEntries(sbx.map(m => [m.mat, L.ordemDoPosto_(m.posto)]));
  const foraDeOrdem = ms.linhas.filter((l, i, a) => i > 0 && a[i - 1].grupo === l.grupo && postoDe[a[i - 1].mat] > postoDe[l.mat]);
  ver('sandbox: ' + ms.linhas.length + ' militares, nenhum mais moderno acima de um mais antigo na mesma equipe', ms.linhas.length > 0 && foraDeOrdem.length === 0, foraDeOrdem);
  ver('sandbox: todo posto da aba MILITARES é reconhecido', sbx.filter(m => m.posto && L.ordemDoPosto_(m.posto) === Infinity).length === 0,
    [...new Set(sbx.filter(m => m.posto && L.ordemDoPosto_(m.posto) === Infinity).map(m => m.posto))]);
}

console.log('== P17 item 6 o painel "Pré-escala" passa a ser "Escala Automática"');
{
  const itens = itensDoMenu();
  ver('o menu tem "Escala Automática", ligado ao mesmo painel', itens.some(i => i[0] === 'Escala Automática' && i[1] === 'abrirPainel'), itens);
  ver('e não tem mais "Pré-escala"', !itens.some(i => /pr[ée]-escala/i.test(i[0])));
  ver('o menu continua com a mesma ordem: Escala Automática, Mostrar Grade Geral, Escalas de Serviço', itens.slice(0, 3).map(i => i[0]).join('|') === 'Escala Automática|Mostrar Grade Geral|Escalas de Serviço', itens);
  const p = tituloDoPainel('pre_escala_painel.js', 'abrirPainel', 'sidebar_pre_escala.html');
  ver('a barra lateral e o cabeçalho do painel dizem "Escala Automática"', p.titulo === 'Escala Automática' && p.h1 === 'Escala Automática', p);
  const html = ler('sidebar_pre_escala.html');
  const visivel = html.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ver('a tela do painel não diz mais "pré-escala" em lugar nenhum', !/pr[ée]-escala/i.test(visivel), (visivel.match(/.{30}pr[ée]-escala.{30}/i) || [])[0]);
  ver('o botão do Pronto segue o padrão dos outros ("Gerar Adm", "Gerar operações")', (html.match(/Gerar Pronto/g) || []).length === 4, (html.match(/Gerar Pronto/g) || []).length);
  // textos que o servidor mostra ao usuário (strings), fora comentários
  const strings = ['guarnicao.js', 'parametros.js', 'pre_escala_painel.js', 'distribuicao_adm_painel.js', 'distribuicao_cotas_painel.js']
    .map(f => [f, (ler(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').match(/'[^'\n]*pr[ée]-escala[^'\n]*'/gi) || [])]).filter(x => x[1].length);
  ver('nenhuma mensagem do servidor fala em "pré-escala"', strings.length === 0, strings);
}

console.log('== P17 item 7 (RN-02) separação mais marcada entre os grupos da grade');
{
  const m = modelo(), aba = desenhar(m), d = L.desenhoDasLinhas_(m.linhas);
  const nCols = 33, ult = colA1(nCols);
  const grossas = aba.log.filter(x => x[0] === 'setBorder' && x[9] === 'SOLID_THICK').map(x => x[1]);
  ver('borda grossa em cima da 1ª linha de cada grupo novo (Bravo e Adm), na largura toda',
    grossas.length === d.inicioGrupo.length && d.inicioGrupo.length === 2 &&
    d.inicioGrupo.every(i => grossas.indexOf('A' + (5 + i) + ':' + ult + (5 + i)) >= 0), [grossas, d.inicioGrupo]);
  ver('a borda grossa é preta e só em cima', grossas.length > 0 && aba.log.filter(x => x[0] === 'setBorder' && x[9] === 'SOLID_THICK').every(x => x[2] === true && x[3] === null && x[4] === null && x[8] === '#000000'));
  const finas = aba.log.filter(x => x[0] === 'setBorder' && x.length === 8).map(x => x[1]);
  ver('entre militares da mesma equipe continua a divisória fina (B34)', d.inicioMilitar.every(i => finas.indexOf('A' + (5 + i) + ':' + ult + (5 + i)) >= 0) && finas.length === d.inicioMilitar.length, [finas, d.inicioMilitar]);
  ver('nenhuma borda grossa fica entre militares da mesma equipe', d.inicioMilitar.every(i => grossas.indexOf('A' + (5 + i) + ':' + ult + (5 + i)) < 0));
  const negrito = aba.log.filter(x => x[0] === 'setFontWeight' && x[2] === 'bold').map(x => x[1]);
  ver('o nome da equipe fica em negrito na 1ª linha de cada grupo (inclusive o primeiro)', ['C5'].concat(d.inicioGrupo.map(i => 'C' + (5 + i))).every(a => negrito.indexOf(a) >= 0), negrito);
  const iAuto = aba.log.findIndex(x => x[0] === 'autoResizeColumns');
  const iUltimoFormato = aba.log.map(x => x[0]).lastIndexOf('setFontWeight');
  ver('a largura é calculada depois de toda a formatação (negrito incluído)', iAuto > iUltimoFormato, [iAuto, iUltimoFormato]);
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
