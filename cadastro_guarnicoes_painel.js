/**
 * CADASTRO DE GUARNIÇÕES — camada do Google Sheets. Não tem painel próprio: o cadastro é a aba
 * GUARNIÇÕES e o painel de Configurações (sidebar_parametros.html) só dá o atalho para ela, como
 * já faz com a aba FERIADOS. Depende de nucleo.gs, matriz.gs (abaAtual_, lerAba_, coluna_, texto_)
 * e cadastro_guarnicoes.gs. Não confundir com guarnicao_painel.gs, que é a grade da escala.
 *
 * B37 revisado: o cadastro é de guarnições e a VIATURA é coluna opcional. O cabeçalho e a regra de
 * vigência (RN-93) estão documentados em cadastro_guarnicoes.gs.
 *
 * Aba antiga: enquanto a planilha estiver com a coluna VIATURA e sem a coluna GUARNIÇÃO, cada
 * viatura é lida como uma guarnição com o mesmo nome, e o painel avisa. O botão "Migrar para
 * guarnições" acrescenta a coluna GUARNIÇÃO copiando a VIATURA, sem apagar nada.
 */

const CADG_ABA = 'GUARNIÇÕES';             // B52: chamava-se VIATURAS; abaAtual_ renomeia a antiga. Não confundir com GUARNIÇÕES POR ESCALA (B58)
// B58 item 1 (RN-09): sem TIPOS DE SERVIÇO — quem atende cada escala é o vínculo em outra aba
const CADG_CABECALHO_ = ['VIGÊNCIA (A PARTIR DE)', 'GUARNIÇÃO', 'VIATURA', 'TIPO', 'ATIVAR', 'PRIORIDADE', 'CNH', 'FUNÇÃO', 'MÍNIMO', 'MÁXIMO'];
const CADG_LARGURAS_ = [130, 200, 110, 150, 70, 90, 90, 190, 80, 80];
const CADG_COLUNA_RETIRADA_ = 'TIPOS DE SERVIÇO';

/**
 * Exemplo: a configuração informada pelo usuário (AR, mínimo 3 e máximo 5) e uma guarnição SEM
 * viatura com motorista que exige CNH (o Apoio Operacional Aquartelado, RN-96).
 */
const CADG_EXEMPLO_ = [
  ['', 'AR', 'AR', 'Auto Resgate', 'SIM', 1, 'D', 'MOTORISTA', 1, 1],
  ['', 'AR', '', '', '', '', '', 'CHEFE', 1, 1],
  ['', 'AR', '', '', '', '', '', 'SOCORRISTA', 1, 3],
  ['', 'SERVIÇO DE APOIO OPERACIONAL AQUARTELADO', '', 'Aquartelado', 'SIM', 2, 'D', 'MOTORISTA ACO', 1, 1],
  ['', 'SERVIÇO DE APOIO OPERACIONAL AQUARTELADO', '', '', '', '', '', 'DESPACHANTE DE CENTRO DE OPERAÇÕES', 2, 2],
  ['', 'SERVIÇO DE APOIO OPERACIONAL AQUARTELADO', '', '', '', '', '', 'ADJUNTO DE DIA', 1, 1]
];

/** Cria a aba GUARNIÇÕES (cabeçalho, exemplo e listas suspensas). Não mexe numa aba que já existe. */
function cadgGarantirAba_() {
  const ss = SpreadsheetApp.getActive();
  const existente = abaAtual_(ss, CADG_ABA);
  if (existente) return { aba: existente, criada: false };
  const aba = ss.insertSheet(CADG_ABA);
  const linhas = [CADG_CABECALHO_].concat(CADG_EXEMPLO_);
  aba.getRange(1, 1, linhas.length + 200, 1).setNumberFormat('@');          // vigência é texto (aaaa-mm)
  aba.getRange(1, 1, linhas.length, CADG_CABECALHO_.length).setValues(linhas);
  aba.getRange(1, 1, 1, CADG_CABECALHO_.length).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
  aba.getRange(2, CADG_CABECALHO_.indexOf('ATIVAR') + 1, 300, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).setAllowInvalid(true).build());   // RN-07
  aba.setFrozenRows(1);
  CADG_LARGURAS_.forEach(function (w, i) { aba.setColumnWidth(i + 1, w); });
  return { aba: aba, criada: true };
}

/**
 * null se a aba não existe. Cada linha vira o formato que resolverGuarnicoes_ espera.
 * Sem a coluna GUARNIÇÃO (cadastro antigo, de viaturas), a VIATURA faz o papel de nome da
 * guarnição: nada deixa de funcionar e o resumo avisa para migrar.
 */
function cadgLerLinhas_(tz) {
  const ss = SpreadsheetApp.getActive();
  if (!abaAtual_(ss, CADG_ABA)) return null;
  const t = lerAba_(CADG_ABA);
  const c = {
    vig: coluna_(t, 'VIGÊNCIA', false), guarnicao: coluna_(t, 'GUARNIÇÃO', false), viatura: coluna_(t, 'VIATURA', false),
    tipo: coluna_(t, 'TIPO', false), ativar: coluna_(t, 'ATIVAR', false), prio: coluna_(t, 'PRIORIDADE', false),
    cnh: coluna_(t, 'CNH', false), funcao: coluna_(t, 'FUNÇÃO', false),
    retirada: coluna_(t, CADG_COLUNA_RETIRADA_, false),          // B58 item 1: só para avisar, não é lida
    min: coluna_(t, 'MÍNIMO', false), max: coluna_(t, 'MÁXIMO', false)
  };
  if (c.guarnicao < 0 && c.viatura < 0) {
    throw new Error('A aba "' + CADG_ABA + '" precisa de uma coluna GUARNIÇÃO (ou, no cadastro antigo, VIATURA).');
  }
  const semColunaGuarnicao = c.guarnicao < 0;
  const cNome = semColunaGuarnicao ? c.viatura : c.guarnicao;
  const pega = function (l, i) { return i < 0 ? '' : l[i]; };
  const out = [];
  t.linhas.forEach(function (l, i) {
    if (texto_(l[cNome]) === '') return;
    let vig = pega(l, c.vig);
    if (vig instanceof Date) vig = Utilities.formatDate(vig, tz, 'yyyy-MM');   // digitou 10/2026 e a planilha virou data
    out.push({
      linha: i + 2, vigencia: texto_(vig), guarnicao: texto_(l[cNome]),
      viatura: texto_(pega(l, c.viatura)), tipo: texto_(pega(l, c.tipo)),
      ativar: pega(l, c.ativar), prioridade: texto_(pega(l, c.prio)),
      cnh: texto_(pega(l, c.cnh)), funcao: texto_(pega(l, c.funcao)), minimo: texto_(pega(l, c.min)), maximo: texto_(pega(l, c.max))
    });
  });
  out.semColunaGuarnicao = semColunaGuarnicao;
  out.tiposDeServicoPreenchidos = c.retirada < 0 ? 0 : t.linhas.filter(function (l) { return texto_(l[c.retirada]) !== ''; }).length;
  return out;
}

/** O cadastro em vigor num mês. { existe, guarnicoes, porId, avisos, semColunaGuarnicao }. */
function guarnicoesDoMes_(mes, tz) {
  tz = tz || SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const linhas = cadgLerLinhas_(tz);
  if (linhas === null) return { existe: false, guarnicoes: [], porId: Object.create(null), avisos: [], semColunaGuarnicao: false };
  const r = resolverGuarnicoes_(linhas, mes);
  const avisos = r.avisos.slice();
  if (linhas.semColunaGuarnicao) {
    avisos.push('A aba ' + CADG_ABA + ' ainda é o cadastro antigo, de viaturas: cada VIATURA está valendo como uma guarnição com o mesmo nome. Uma guarnição pode não ter viatura (RN-96), então use o botão "Migrar para guarnições" para criar a coluna GUARNIÇÃO.');
  }
  if (linhas.tiposDeServicoPreenchidos) {
    avisos.push('A aba ' + CADG_ABA + ' ainda tem a coluna ' + CADG_COLUNA_RETIRADA_ + ', preenchida em ' + linhas.tiposDeServicoPreenchidos +
      ' linha(s). Ela não é mais lida (B58, RN-09): quais escalas e turnos cada guarnição atende passa a ser o vínculo da outra aba de cadastro. Apague a coluna quando tiver passado esse vínculo adiante.');
  }
  return { existe: true, guarnicoes: r.guarnicoes, porId: r.porId, avisos: avisos, semColunaGuarnicao: !!linhas.semColunaGuarnicao };
}

/* ------------------------------------------------------------ coluna CNH da aba MILITARES */

/**
 * B37 (RN-12): acrescenta a coluna CNH ao lado de MOTORISTA, vazia, para o escalante preencher.
 * Só o cabeçalho: nenhuma categoria é escrita pelo sistema.
 */
function garantirColunaCnh_() {
  const aba = abaAtual_(SpreadsheetApp.getActive(), CONFIG.ABA_MILITARES);
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

/* ------------------------------------------------------------ migração do cadastro antigo */

/**
 * B37: acrescenta a coluna GUARNIÇÃO ao cadastro antigo (de viaturas), copiando o nome da viatura
 * para ela. A coluna VIATURA fica como está, porque a guarnição que está numa viatura continua
 * apontando para ela; o que o escalante faz depois é trocar o nome da guarnição onde ele quiser e
 * apagar a VIATURA das guarnições que não têm viatura (como o Apoio Aquartelado).
 * Retorna { migrou, linhas }.
 */
function cadgMigrarParaGuarnicoes_() {
  const ss = SpreadsheetApp.getActive();
  const aba = abaAtual_(ss, CADG_ABA);
  if (!aba) return { migrou: false, linhas: 0 };
  const nCols = aba.getLastColumn();
  const cab = aba.getRange(1, 1, 1, nCols).getValues()[0].map(normalizar_);
  if (cab.indexOf(normalizar_('GUARNIÇÃO')) >= 0) return { migrou: false, linhas: 0 };
  const iViat = cab.indexOf(normalizar_('VIATURA'));
  if (iViat < 0) return { migrou: false, linhas: 0 };

  aba.insertColumnBefore(iViat + 1);                       // GUARNIÇÃO entra antes de VIATURA
  const col = iViat + 1;
  aba.getRange(1, col).setValue('GUARNIÇÃO').setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
  const n = aba.getLastRow() - 1;
  let copiadas = 0;
  if (n > 0) {
    const viaturas = aba.getRange(2, col + 1, n, 1).getValues();   // a VIATURA ficou uma coluna à direita
    const nomes = viaturas.map(function (r) { const v = texto_(r[0]); if (v) copiadas++; return [v]; });
    aba.getRange(2, col, n, 1).setNumberFormat('@').setValues(nomes);
  }
  aba.setColumnWidth(col, CADG_LARGURAS_[CADG_CABECALHO_.indexOf('GUARNIÇÃO')]);
  return { migrou: true, linhas: copiadas };
}

/**
 * B58 item 1 (RN-09): apaga a coluna TIPOS DE SERVIÇO da aba GUARNIÇÕES, mas só se estiver vazia —
 * vazia não guarda dado nenhum. Preenchida, fica onde está (o resumo avisa que ela não é mais lida).
 * Retorna 'apagada', 'preenchida' ou '' (não havia a coluna).
 */
function cadgRetirarTiposDeServico_() {
  const aba = abaAtual_(SpreadsheetApp.getActive(), CADG_ABA);
  if (!aba) return '';
  const nCols = aba.getLastColumn();
  if (nCols < 1) return '';
  const cab = aba.getRange(1, 1, 1, nCols).getValues()[0].map(normalizar_);
  const i = cab.indexOf(normalizar_(CADG_COLUNA_RETIRADA_));
  if (i < 0) return '';
  const n = aba.getLastRow() - 1;
  const cheia = n > 0 && aba.getRange(2, i + 1, n, 1).getDisplayValues().some(function (r) { return String(r[0]).trim() !== ''; });
  if (cheia) return 'preenchida';
  aba.deleteColumn(i + 1);
  return 'apagada';
}

/* ------------------------------------------------------------ chamadas da tela */

/** Abre a aba GUARNIÇÕES (criando, se não existir) — o ponto de entrada no painel de Configurações. */
function painelGuarnicoesAbrir() {
  const r = cadgGarantirAba_();
  if (r.aba.isSheetHidden()) r.aba.showSheet();
  SpreadsheetApp.getActive().setActiveSheet(r.aba);
  return { criada: r.criada };
}

/** Cria a coluna CNH em MILITARES, se faltar. */
function painelGuarnicoesColunaCnh() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    return { criada: garantirColunaCnh_() };
  } finally {
    lock.releaseLock();
  }
}

/** Acrescenta a coluna GUARNIÇÃO ao cadastro antigo, copiando a viatura. */
function painelGuarnicoesMigrar() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    return cadgMigrarParaGuarnicoes_();
  } finally {
    lock.releaseLock();
  }
}

/** Resumo do cadastro para o painel de Configurações, no mês escolhido. */
function guarnicoesResumo_(mes, tz) {
  const v = guarnicoesDoMes_(mes, tz);
  const militares = lerMilitares_();
  const temCnh = militares.some(function (m) { return m.temColunaCnh; });
  const exigem = v.guarnicoes.filter(function (x) { return x.ativar && x.cnh.length; });
  const avisos = v.avisos.slice();
  if (v.existe && !temCnh && exigem.length) {
    avisos.push('Há guarnição que exige categoria de CNH, mas a aba MILITARES não tem a coluna CNH (RN-12): a checagem de habilitação fica desligada. Crie a coluna pelo botão ao lado.');
  }
  return {
    existe: v.existe,
    temColunaCnh: temCnh,
    semColunaGuarnicao: v.semColunaGuarnicao,
    total: v.guarnicoes.length,
    ativar: v.guarnicoes.filter(function (x) { return x.ativar; }).length,
    lista: v.guarnicoes.map(function (x) {
      return {
        id: x.id, viatura: x.viatura, tipo: x.tipo, ativar: x.ativar, prioridade: x.prioridade === null ? '' : x.prioridade,
        cnh: x.cnh.join('/'),
        minimo: x.funcoes.reduce(function (s, f) { return s + f.minimo; }, 0),
        maximo: x.funcoes.some(function (f) { return f.maximo === null; }) ? '' : x.funcoes.reduce(function (s, f) { return s + f.maximo; }, 0),
        funcoes: x.funcoes.map(function (f) { return f.funcao + ' ' + f.minimo + '-' + (f.maximo === null ? '∞' : f.maximo); }).join(', ')
      };
    }),
    avisos: avisos
  };
}
