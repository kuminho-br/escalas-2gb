/**
 * VIATURAS — camada do Google Sheets. Não tem painel próprio: o cadastro é a aba GUARNIÇÕES e o
 * painel de Configurações (sidebar_parametros.html) só dá o atalho para ela, como já faz com a
 * aba FERIADOS. Depende de nucleo.gs, matriz.gs (lerAba_, coluna_, texto_) e viaturas.gs.
 *
 * Decisão de B37 (RN-93): a vigência é por linha, igual à da aba CONFIGURAÇÕES; o cabeçalho e a
 * regra de resolução estão documentados em viaturas.gs.
 */

const VIAT_ABA = 'GUARNIÇÕES';             // B52: chamava-se VIATURAS; abaAtual_ renomeia a antiga. Não confundir com MODELOS DE GUARNIÇÃO
const VIAT_CABECALHO_ = ['VIGÊNCIA (A PARTIR DE)', 'VIATURA', 'TIPO', 'ATIVAR', 'PRIORIDADE', 'TIPOS DE SERVIÇO', 'CNH', 'FUNÇÃO', 'MÍNIMO', 'MÁXIMO'];

// Exemplo: a única configuração informada até agora (viatura AR, mínimo 3 e máximo 5).
const VIAT_EXEMPLO_ = [
  ['', 'AR', 'Auto Resgate', 'SIM', 1, '', 'D', 'MOTORISTA', 1, 1],
  ['', 'AR', '', '', '', '', '', 'CHEFE', 1, 1],
  ['', 'AR', '', '', '', '', '', 'SOCORRISTA', 1, 3]
];

/** Cria a aba GUARNIÇÕES (cabeçalho, exemplo e listas suspensas). Não mexe numa aba que já existe. */
function viatGarantirAba_() {
  const ss = SpreadsheetApp.getActive();
  const existente = abaAtual_(ss, VIAT_ABA);
  if (existente) return { aba: existente, criada: false };
  const aba = ss.insertSheet(VIAT_ABA);
  const linhas = [VIAT_CABECALHO_].concat(VIAT_EXEMPLO_);
  aba.getRange(1, 1, linhas.length + 200, 1).setNumberFormat('@');          // vigência é texto (aaaa-mm)
  aba.getRange(1, 1, linhas.length, VIAT_CABECALHO_.length).setValues(linhas);
  aba.getRange(1, 1, 1, VIAT_CABECALHO_.length).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
  aba.getRange(2, 4, 300, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).setAllowInvalid(true).build());   // RN-07
  aba.setFrozenRows(1);
  [130, 110, 150, 70, 90, 220, 90, 160, 80, 80].forEach(function (w, i) { aba.setColumnWidth(i + 1, w); });
  return { aba: aba, criada: true };
}

/** null se a aba não existe. Cada linha vira o formato que resolverViaturas_ espera. */
function viatLerLinhas_(tz) {
  const ss = SpreadsheetApp.getActive();
  if (!abaAtual_(ss, VIAT_ABA)) return null;
  const t = lerAba_(VIAT_ABA);
  const c = {
    vig: coluna_(t, 'VIGÊNCIA', false), viatura: coluna_(t, 'VIATURA', true), tipo: coluna_(t, 'TIPO', false),
    ativar: coluna_(t, 'ATIVAR', false), prio: coluna_(t, 'PRIORIDADE', false), servicos: coluna_(t, 'TIPOS DE SERVIÇO', false),
    cnh: coluna_(t, 'CNH', false), funcao: coluna_(t, 'FUNÇÃO', false), min: coluna_(t, 'MÍNIMO', false), max: coluna_(t, 'MÁXIMO', false)
  };
  const pega = function (l, i) { return i < 0 ? '' : l[i]; };
  const out = [];
  t.linhas.forEach(function (l, i) {
    if (texto_(l[c.viatura]) === '') return;
    let vig = pega(l, c.vig);
    if (vig instanceof Date) vig = Utilities.formatDate(vig, tz, 'yyyy-MM');   // digitou 10/2026 e a planilha virou data
    out.push({
      linha: i + 2, vigencia: texto_(vig), viatura: texto_(l[c.viatura]), tipo: texto_(pega(l, c.tipo)),
      ativar: pega(l, c.ativar), prioridade: texto_(pega(l, c.prio)), servicos: texto_(pega(l, c.servicos)),
      cnh: texto_(pega(l, c.cnh)), funcao: texto_(pega(l, c.funcao)), minimo: texto_(pega(l, c.min)), maximo: texto_(pega(l, c.max))
    });
  });
  return out;
}

/** O cadastro em vigor num mês. { existe, viaturas, porId, avisos } — sem a aba, lista vazia. */
function viaturasDoMes_(mes, tz) {
  tz = tz || SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const linhas = viatLerLinhas_(tz);
  if (linhas === null) return { existe: false, viaturas: [], porId: Object.create(null), avisos: [] };
  const r = resolverViaturas_(linhas, mes);
  return { existe: true, viaturas: r.viaturas, porId: r.porId, avisos: r.avisos };
}

/* ------------------------------------------------------------ coluna CNH da aba MILITARES */

/**
 * B37 (RN-12): acrescenta a coluna CNH ao lado de MOTORISTA, vazia, para o escalante preencher.
 * Só o cabeçalho: nenhuma categoria é escrita pelo sistema.
 */
function garantirColunaCnh_() {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_MILITARES);
  if (!aba) return false;
  const nCols = aba.getLastColumn();
  const cab = aba.getRange(1, 1, 1, nCols).getValues()[0].map(normalizar_);
  if (cab.indexOf('CNH') >= 0) return false;
  const iMot = cab.indexOf('MOTORISTA');
  const col = iMot >= 0 ? iMot + 2 : nCols + 1;            // ao lado de MOTORISTA, quando ela existe
  if (iMot >= 0) aba.insertColumnAfter(iMot + 1);
  aba.getRange(1, col).setValue('CNH').setFontWeight('bold');
  const n = aba.getLastRow() - 1;
  if (n > 0) aba.getRange(2, col, n, 1).setNumberFormat('@');
  return true;
}

/* ------------------------------------------------------------ chamadas da tela */

/** Abre a aba GUARNIÇÕES (criando, se não existir) — o ponto de entrada no painel de Configurações. */
function painelViaturasAbrir() {
  const r = viatGarantirAba_();
  if (r.aba.isSheetHidden()) r.aba.showSheet();
  SpreadsheetApp.getActive().setActiveSheet(r.aba);
  return { criada: r.criada };
}

/** Cria a coluna CNH em MILITARES, se faltar. */
function painelViaturasColunaCnh() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    return { criada: garantirColunaCnh_() };
  } finally {
    lock.releaseLock();
  }
}

/** Resumo do cadastro para o painel de Configurações, no mês escolhido. */
function viaturasResumo_(mes, tz) {
  const v = viaturasDoMes_(mes, tz);
  const militares = lerMilitares_();
  const temCnh = militares.some(function (m) { return m.temColunaCnh; });
  const exigem = v.viaturas.filter(function (x) { return x.ativar && x.cnh.length; });
  const avisos = v.avisos.slice();
  if (v.existe && !temCnh && exigem.length) {
    avisos.push('Há viatura que exige categoria de CNH, mas a aba MILITARES não tem a coluna CNH (RN-12): a checagem de habilitação fica desligada. Crie a coluna pelo botão ao lado.');
  }
  return {
    existe: v.existe,
    temColunaCnh: temCnh,
    total: v.viaturas.length,
    ativar: v.viaturas.filter(function (x) { return x.ativar; }).length,
    lista: v.viaturas.map(function (x) {
      return {
        id: x.id, tipo: x.tipo, ativar: x.ativar, prioridade: x.prioridade === null ? '' : x.prioridade,
        cnh: x.cnh.join('/'), servicos: x.servicos.join(', '),
        minimo: x.funcoes.reduce(function (s, f) { return s + f.minimo; }, 0),
        maximo: x.funcoes.some(function (f) { return f.maximo === null; }) ? '' : x.funcoes.reduce(function (s, f) { return s + f.maximo; }, 0),
        funcoes: x.funcoes.map(function (f) { return f.funcao + ' ' + f.minimo + '-' + (f.maximo === null ? '∞' : f.maximo); }).join(', ')
      };
    }),
    avisos: avisos
  };
}
