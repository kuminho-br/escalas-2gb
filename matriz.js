/**
 * ESCALA NA PLANILHA ("matriz" no código; na tela se diz "escala") — camada do Google Sheets
 * (lê as abas, desenha a escala do mês, confere).
 * A lógica de conversão está em nucleo.gs. Cole os dois arquivos no projeto.
 *
 * Uso:  menu "Escalas - 2º GB" > "Mostrar Escala" abre o painel, que carrega a escala
 *       (mês em B1, seção em B2 da aba ESCALA DO MÊS) e salva as edições na tabela.
 *       menu "Escalas - 2º GB" > "Conferir Integridade dos Dados" abre o painel de integridade
 *       (choques de horário, catálogo de turnos e escala carregada × tabela; só lê e relata)
 *
 * montarMatriz() é chamada pelo painel (não tem mais item próprio no menu). Antes de
 * recarregar uma escala que tenha edições suas ainda não salvas na tabela, ela pede confirmação.
 * Mudanças que vieram da tabela (outra pessoa, ou a pré-escala) não pedem confirmação.
 */

const CONFIG = {
  ABA_ALOCACOES: 'ALOCAÇÕES TABULADAS',
  ABA_MILITARES: 'MILITARES',
  ABA_TURNOS: 'TURNOS',
  ABA_MATRIZ: 'ESCALA DO MÊS',          // chamava-se MATRIZ; abaDaEscala_ renomeia a antiga
  TURNOS_BASE: ['A', 'B'],            // letras que sempre aparecem; outras entram se houver alocação

  // layout da aba ESCALA DO MÊS
  LINHA_MES: 1, LINHA_SECAO: 2, LINHA_SEMANA: 3, LINHA_CABECALHO: 4, PRIMEIRA_LINHA: 5,
  COL_MAT: 1, COL_MILITAR: 2, COL_EQUIPE: 3, COL_TURNO: 4, PRIMEIRA_COL_DIA: 5,

  // cor de cada serviço: [fundo, texto]. Serviço novo sem cor aparece sem cor (nada quebra).
  CORES: {
    'Pronto':     ['#D9DEE3', '#000000'],
    'Adm':        ['#F4C7C3', '#000000'],
    'JES':        ['#FCE8B2', '#000000'],
    'Defensoria': ['#F9CB9C', '#000000'],
    'Bioma':      ['#D9EAD3', '#000000'],
    'PE Seguro':  ['#CFE2F3', '#000000'],
    'Eleições':   ['#D9D2E9', '#000000'],
    'CPRH':       ['#38761D', '#FFFFFF']
  }
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Escalas - 2º GB')
    .addItem('Pré-escala', 'abrirPainel')
    .addItem('Mostrar Escala', 'abrirPainelMatriz')
    .addItem('Escalas de Serviço', 'abrirPainelGuarnicao')
    .addSeparator()
    .addItem('Configurações', 'abrirPainelParametros')
    .addItem('Conferir Integridade dos Dados', 'abrirPainelIntegridade')
    .addToUi();
}

/* ------------------------------------------------------------------ leitura */

/** A aba da escala do mês. Se ainda tiver o nome antigo (MATRIZ), renomeia; com criar=true cria quando não existe. */
function abaDaEscala_(ss, criar) {
  let aba = ss.getSheetByName(CONFIG.ABA_MATRIZ);
  if (!aba) {
    const antiga = ss.getSheetByName('MATRIZ');
    if (antiga) { antiga.setName(CONFIG.ABA_MATRIZ); aba = antiga; }
  }
  if (!aba && criar) aba = ss.insertSheet(CONFIG.ABA_MATRIZ);
  return aba;
}

function lerAba_(nome) {
  const aba = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!aba) throw new Error('Aba não encontrada: "' + nome + '".');
  const valores = aba.getDataRange().getValues();
  if (valores.length === 0) throw new Error('A aba "' + nome + '" está vazia.');
  return { nome: nome, cab: valores[0].map(normalizar_), linhas: valores.slice(1) };
}

/** Acha a coluna pelo cabeçalho (sem acento/caixa/pontuação); aceita "começa com" (ex.: "ANTIG. (2°GB)"). */
function coluna_(t, rotulo, obrigatoria) {
  const alvo = normalizar_(rotulo);
  let i = t.cab.indexOf(alvo);
  if (i < 0) i = t.cab.findIndex(function (c) { return c.indexOf(alvo) === 0; });
  if (i < 0 && obrigatoria) throw new Error('Não achei a coluna "' + rotulo + '" na linha 1 da aba "' + t.nome + '".');
  return i;
}

function texto_(v) { return String(v == null ? '' : v).trim(); }

function ehData_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v); }

/** Data da célula -> 'aaaa-mm-dd' no fuso da planilha ('' se não for uma data reconhecível). */
function diaComoTexto_(v, tz) {
  if (ehData_(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = texto_(v);
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : '';
}

function lerAlocacoes_(tz) {
  const t = lerAba_(CONFIG.ABA_ALOCACOES);
  const cMat = coluna_(t, 'MATRÍCULA', true), cData = coluna_(t, 'DATA', true);
  const cServ = coluna_(t, 'SERVIÇO', true), cTurno = coluna_(t, 'TURNO', true);
  const cFunc = coluna_(t, 'FUNÇÃO', false), cUni = coluna_(t, 'UNIDADE', false);
  const alocs = [];
  let semData = 0, incompletas = 0;
  t.linhas.forEach(function (l, idx) {
    const mat = texto_(l[cMat]);
    if (!mat) return;
    const dia = diaComoTexto_(l[cData], tz);
    const servico = texto_(l[cServ]), turno = texto_(l[cTurno]);
    if (!dia) { semData++; return; }
    if (!servico || !turno) { incompletas++; return; }
    alocs.push({ mat: mat, dia: dia, servico: servico, turno: turno, funcao: cFunc < 0 ? '' : texto_(l[cFunc]), unidade: cUni < 0 ? '' : texto_(l[cUni]), linha: idx + 2 });
  });
  return { alocs: alocs, semData: semData, incompletas: incompletas };
}

function lerMilitares_() {
  const t = lerAba_(CONFIG.ABA_MILITARES);
  const c = {
    mat: coluna_(t, 'MATRÍCULA', true), nome: coluna_(t, 'NOME DE GUERRA', true), secao: coluna_(t, 'SEÇÃO', true),
    posto: coluna_(t, 'POSTO/GRAD', false), jornada: coluna_(t, 'JORNADA', false),
    equipe: coluna_(t, 'EQUIPE', false), antig: coluna_(t, 'ANTIG', false), motorista: coluna_(t, 'MOTORISTA', false)
  };
  const pega = function (l, i) { return i < 0 ? '' : l[i]; };
  const res = [];
  t.linhas.forEach(function (l, ordem) {
    const mat = texto_(l[c.mat]);
    if (!mat) return;
    res.push({
      mat: mat, nome: texto_(l[c.nome]), posto: texto_(pega(l, c.posto)), secao: texto_(l[c.secao]),
      jornada: texto_(pega(l, c.jornada)), equipe: texto_(pega(l, c.equipe)), antig: pega(l, c.antig), ordem: ordem,
      // true só se a coluna MOTORISTA existir e tiver algo como SIM/S/X (o "-" e o vazio contam como não)
      temColunaMotorista: c.motorista >= 0,
      motorista: c.motorista >= 0 && ['SIM', 'S', 'X', 'MOTORISTA', '1', 'TRUE', 'VERDADEIRO'].indexOf(normalizar_(l[c.motorista])) >= 0
    });
  });
  return res;
}

/** Catálogo (aba TURNOS): quais serviços existem em cada letra de turno, e os pares válidos. */
function lerCatalogo_() {
  const t = lerAba_(CONFIG.ABA_TURNOS);
  const cS = coluna_(t, 'SERVIÇO', true), cT = coluna_(t, 'TURNO', true);
  const porTurno = {}, pares = {};
  t.linhas.forEach(function (l) {
    const s = texto_(l[cS]), tu = texto_(l[cT]);
    if (!s || !tu) return;
    pares[s + '|' + tu] = true;
    if (!porTurno[tu]) porTurno[tu] = [];
    if (porTurno[tu].indexOf(s) < 0) porTurno[tu].push(s);
  });
  return { porTurno: porTurno, pares: pares };
}

/** Mês e seção da aba ESCALA DO MÊS (B1 e B2). Se o mês não estiver preenchido, pergunta. */
function lerParametros_(aba, ui, tz) {
  const v = aba.getRange(CONFIG.LINHA_MES, 2).getValue();
  let mes = '';
  if (ehData_(v)) mes = Utilities.formatDate(v, tz, 'yyyy-MM');
  else if (/^\d{4}-\d{2}$/.test(texto_(v))) mes = texto_(v);
  if (!mes) {
    const r = ui.prompt('Carregar escala', 'Mês da escala (aaaa-mm), por exemplo 2026-10:', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return null;
    mes = r.getResponseText().trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: "' + mes + '". Use o formato aaaa-mm.');
  }
  const secao = texto_(aba.getRange(CONFIG.LINHA_SECAO, 2).getValue()) || valorParametro_('SECAO_PADRAO', mes);
  return { mes: mes, secao: secao };
}

/** Lê a escala que está na aba (ou null se a aba ainda não tem uma). */
function lerMatrizAtual_(aba, tz) {
  const ult = aba.getLastRow(), ultC = aba.getLastColumn();
  if (ult < CONFIG.PRIMEIRA_LINHA || ultC < CONFIG.PRIMEIRA_COL_DIA) return null;
  if (normalizar_(aba.getRange(CONFIG.LINHA_CABECALHO, CONFIG.COL_MAT).getValue()) !== 'MATRICULA') return null;
  const nl = ult - CONFIG.PRIMEIRA_LINHA + 1, nd = ultC - CONFIG.PRIMEIRA_COL_DIA + 1;
  const ident = aba.getRange(CONFIG.PRIMEIRA_LINHA, 1, nl, CONFIG.PRIMEIRA_COL_DIA - 1).getValues();
  const cab = aba.getRange(CONFIG.LINHA_CABECALHO, CONFIG.PRIMEIRA_COL_DIA, 1, nd).getValues()[0];
  const grade = aba.getRange(CONFIG.PRIMEIRA_LINHA, CONFIG.PRIMEIRA_COL_DIA, nl, nd).getValues();
  return {
    dias: cab.map(function (v) { return diaComoTexto_(v, tz); }),
    linhas: ident.map(function (r) { return { mat: texto_(r[CONFIG.COL_MAT - 1]), turno: texto_(r[CONFIG.COL_TURNO - 1]) }; }),
    celulas: grade
  };
}

/**
 * Compara a matriz que está na aba com a tabela, usando os dias da própria
 * matriz (assim funciona mesmo depois de você trocar o mês em B1).
 */
function diferencasDaMatrizAtual_(aba, alocsTabela, tz) {
  const m = lerMatrizAtual_(aba, tz);
  if (!m) return null;
  const diasValidos = {};
  m.dias.forEach(function (d) { if (d) diasValidos[d] = true; });
  const daTabela = alocsTabela.filter(function (a) { return diasValidos[a.dia]; });
  const volta = desmontarMatriz_(m.linhas, m.dias, m.celulas);
  return { cmp: compararAlocacoes_(daTabela, volta.alocs), orfas: volta.orfas };
}

/* ------------------------------------------------------------------ desenho */

function renderizarMatriz_(aba, modelo, par, catalogo, tz) {
  const nl = modelo.linhas.length, nd = modelo.dias.length;
  const r0 = CONFIG.PRIMEIRA_LINHA, c0 = CONFIG.PRIMEIRA_COL_DIA;
  const nCols = c0 + nd - 1;
  const nLinhasTotal = r0 + nl;                       // uma linha de folga

  // garante tamanho e limpa TUDO (clear() sozinho não remove validações nem notas)
  if (aba.getMaxRows() < nLinhasTotal) aba.insertRowsAfter(aba.getMaxRows(), nLinhasTotal - aba.getMaxRows());
  if (aba.getMaxColumns() < nCols) aba.insertColumnsAfter(aba.getMaxColumns(), nCols - aba.getMaxColumns());
  const tudo = aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns());
  tudo.clear();
  tudo.clearDataValidations();
  tudo.clearNote();
  aba.setConditionalFormatRules([]);
  aba.setFrozenRows(0);
  aba.setFrozenColumns(0);

  // parâmetros
  aba.getRange(1, 1, 2, 1).setValues([['MÊS'], ['SEÇÃO']]).setFontWeight('bold');
  aba.getRange(CONFIG.LINHA_MES, 2).setValue(Utilities.parseDate(par.mes + '-01', tz, 'yyyy-MM-dd')).setNumberFormat('mm/yyyy');
  aba.getRange(CONFIG.LINHA_SECAO, 2).setValue(par.secao);

  // cabeçalho
  const nomesSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  aba.getRange(CONFIG.LINHA_SEMANA, c0, 1, nd).setValues([modelo.dias.map(function (d) { return nomesSemana[diaDaSemana_(d)]; })]);
  aba.getRange(CONFIG.LINHA_CABECALHO, 1, 1, c0 - 1).setValues([['MATRÍCULA', 'MILITAR', 'EQUIPE', 'TURNO']]);
  aba.getRange(CONFIG.LINHA_CABECALHO, c0, 1, nd)
    .setValues([modelo.dias.map(function (d) { return Utilities.parseDate(d, tz, 'yyyy-MM-dd'); })])
    .setNumberFormat('dd');

  // corpo
  aba.getRange(r0, CONFIG.COL_MAT, nl, 1).setNumberFormat('@');
  aba.getRange(r0, 1, nl, c0 - 1).setValues(modelo.linhas.map(function (l) { return [l.mat, l.nome, l.grupo, l.turno]; }));
  aba.getRange(r0, c0, nl, nd).setValues(modelo.celulas);

  // lista suspensa por linha: só os serviços que existem naquela letra de turno
  const regras = {};
  Object.keys(catalogo.porTurno).forEach(function (t) {
    regras[t] = SpreadsheetApp.newDataValidation()
      .requireValueInList(catalogo.porTurno[t], true)
      .setAllowInvalid(false)
      .setHelpText('Serviços possíveis no turno ' + t + ' (aba TURNOS).')
      .build();
  });
  aba.getRange(r0, c0, nl, nd).setDataValidations(modelo.linhas.map(function (l) {
    const r = regras[l.turno] || null;
    const linha = [];
    for (let j = 0; j < nd; j++) linha.push(r);
    return linha;
  }));

  // aparência
  aba.getRange(1, 1, nLinhasTotal, nCols).setFontFamily('Arial').setFontSize(10);
  aba.getRange(CONFIG.LINHA_CABECALHO, 1, 1, nCols)
    .setBackground('#2F5D50').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
  aba.getRange(CONFIG.LINHA_SEMANA, c0, 1, nd).setHorizontalAlignment('center').setFontColor('#5F6368').setFontSize(8);
  aba.getRange(r0, CONFIG.COL_TURNO, nl, 1).setHorizontalAlignment('center');
  aba.getRange(r0, c0, nl, nd).setHorizontalAlignment('center');
  aba.setColumnWidth(CONFIG.COL_MAT, 85);
  aba.setColumnWidth(CONFIG.COL_MILITAR, 200);
  aba.setColumnWidth(CONFIG.COL_EQUIPE, 105);
  aba.setColumnWidth(CONFIG.COL_TURNO, 55);
  aba.setColumnWidths(c0, nd, 72);

  // fins de semana
  const colsFds = [], rotFds = [];
  modelo.dias.forEach(function (d, j) {
    const w = diaDaSemana_(d);
    if (w === 0 || w === 6) {
      colsFds.push(aba.getRange(r0, c0 + j, nl, 1).getA1Notation());
      rotFds.push(aba.getRange(CONFIG.LINHA_SEMANA, c0 + j).getA1Notation());
    }
  });
  if (colsFds.length) {
    aba.getRangeList(colsFds).setBackground('#F1F3F4');
    aba.getRangeList(rotFds).setFontColor('#C5221F');
  }

  // 2ª e 3ª linha do mesmo militar: identificação em cinza (continua preenchida, para o filtro/ordenação não quebrar)
  const cinza = [];
  modelo.linhas.forEach(function (l, i) {
    if (i > 0 && modelo.linhas[i - 1].mat === l.mat) cinza.push(aba.getRange(r0 + i, 1, 1, c0 - 1).getA1Notation());
  });
  if (cinza.length) aba.getRangeList(cinza).setFontColor('#9AA0A6');

  // linhas divisórias: fina entre militares, grossa entre grupos (equipes)
  const fimMilitar = [], fimGrupo = [];
  modelo.linhas.forEach(function (l, i) {
    const prox = modelo.linhas[i + 1];
    if (l.ultimaDoMilitar) fimMilitar.push(aba.getRange(r0 + i, 1, 1, nCols).getA1Notation());
    if (l.ultimaDoMilitar && (!prox || prox.grupo !== l.grupo)) fimGrupo.push(r0 + i);
  });
  if (fimMilitar.length) aba.getRangeList(fimMilitar).setBorder(null, null, true, null, null, null);
  fimGrupo.forEach(function (r) {
    aba.getRange(r, 1, 1, nCols).setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  // cor por serviço
  const grade = aba.getRange(r0, c0, nl, nd);
  aba.setConditionalFormatRules(Object.keys(CONFIG.CORES).map(function (nome) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(nome)
      .setBackground(CONFIG.CORES[nome][0]).setFontColor(CONFIG.CORES[nome][1])
      .setRanges([grade]).build();
  }));

  // células em que a tabela tem mais de um serviço para a mesma chave
  modelo.colisoes.forEach(function (c) {
    aba.getRange(r0 + c.linha, c0 + c.coluna)
      .setNote('Conflito na tabela ALOCAÇÕES TABULADAS: ' + c.valores.join(' / ') + '. A escala mostra só o primeiro.')
      .setBorder(true, true, true, true, false, false, '#EA4335', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  aba.setFrozenRows(CONFIG.LINHA_CABECALHO);
  aba.setFrozenColumns(CONFIG.COL_TURNO);
}

/* ------------------------------------------------------------- mensagens */

function descreverChave_(chave) {
  const p = chave.split('|');
  return p[0] + ', ' + formatarDia_(p[1]) + ', turno ' + p[2];
}

function textoDiferencas_(d) {
  const c = d.cmp;
  const linhas = [];
  if (c.soNaTabela.length) linhas.push('Na tabela e não na escala carregada (' + c.soNaTabela.length + '):');
  c.soNaTabela.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave) + ' — ' + x.servico); });
  if (c.soNaMatriz.length) linhas.push('Na escala carregada e não na tabela (' + c.soNaMatriz.length + '):');
  c.soNaMatriz.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave) + ' — ' + x.servico); });
  if (c.divergentes.length) linhas.push('Serviço diferente (' + c.divergentes.length + '):');
  c.divergentes.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave) + ' — tabela: ' + x.tabela + ' | escala: ' + x.matriz); });
  if (c.conflitosNaTabela.length) linhas.push('A própria tabela tem serviços diferentes para a mesma chave (' + c.conflitosNaTabela.length + '):');
  c.conflitosNaTabela.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave) + ' — ' + x.valores.join(' / ')); });
  if (d.orfas) linhas.push('Células preenchidas sem matrícula, turno ou data válidos: ' + d.orfas);
  return linhas.join('\n');
}

/**
 * Edições SUAS que ainda não foram salvas na tabela: a escala como está na planilha contra a
 * cópia de referência (a escala como foi carregada). Mudanças que só aconteceram na tabela
 * não contam: elas não se perdem ao recarregar. Sem cópia de referência (escala carregada
 * numa versão antiga), cai na comparação direta com a tabela. null se não há escala carregada.
 */
function edicoesNaoSalvas_(aba, alocsTabela, tz) {
  const m = lerMatrizAtual_(aba, tz);
  if (!m) return null;
  const base = lerBase_(tz);
  if (!base) return diferencasDaMatrizAtual_(aba, alocsTabela, tz);
  const volta = desmontarMatriz_(m.linhas, m.dias, m.celulas);
  return { cmp: compararAlocacoes_(base, volta.alocs), orfas: volta.orfas };
}

function textoEdicoes_(d) {
  const c = d.cmp;
  const linhas = [];
  if (c.soNaMatriz.length) linhas.push('Incluídas (' + c.soNaMatriz.length + '):');
  c.soNaMatriz.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave) + ' — ' + x.servico); });
  if (c.soNaTabela.length) linhas.push('Apagadas (' + c.soNaTabela.length + '):');
  c.soNaTabela.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave) + ' — era ' + x.servico); });
  if (c.divergentes.length) linhas.push('Serviço trocado (' + c.divergentes.length + '):');
  c.divergentes.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave) + ' — ' + x.tabela + ' → ' + x.matriz); });
  if (d.orfas) linhas.push('Células preenchidas sem matrícula, turno ou data válidos: ' + d.orfas);
  return linhas.join('\n');
}

const MESES_ = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 'Escala de novembro de 2026 da 1ª SB' */
function tituloEscala_(mes, secao) {
  return 'Escala de ' + MESES_[Number(mes.slice(5)) - 1] + ' de ' + mes.slice(0, 4) + ' da ' + secao;
}

/* --------------------------------------------------------- ações do menu */

function montarMatriz() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  try {
    const tz = ss.getSpreadsheetTimeZone();
    const aba = abaDaEscala_(ss, true);
    const par = lerParametros_(aba, ui, tz);
    if (!par) return;

    const lidas = lerAlocacoes_(tz);
    const militares = lerMilitares_();
    const catalogo = lerCatalogo_();

    // não descarta, sem avisar, edições suas que ainda não foram salvas na tabela
    const antes = edicoesNaoSalvas_(aba, lidas.alocs, tz);
    if (antes && (antes.cmp.total > 0 || antes.orfas > 0)) {
      const r = ui.alert('Atenção',
        'A escala carregada tem alterações que ainda não foram salvas na tabela:\n\n' + textoEdicoes_(antes) +
        '\n\nCarregar a escala de novo descarta essas alterações (para guardá-las, escolha Não e use "Salvar alterações" no painel). Continuar?',
        ui.ButtonSet.YES_NO);
      if (r !== ui.Button.YES) return;
    }

    const modelo = montarModeloMatriz_(lidas.alocs, militares,
      { mes: par.mes, secao: par.secao, turnosBase: CONFIG.TURNOS_BASE, catalogo: catalogo.pares });
    if (modelo.linhas.length === 0) throw new Error('Nenhum militar da seção "' + par.secao + '" e nenhuma alocação em ' + par.mes + '.');
    Object.keys(modelo.letras.reduce(function (o, t) { if (!catalogo.porTurno[t]) o[t] = 1; return o; }, {})).forEach(function (t) {
      modelo.avisos.push('Turno "' + t + '" não existe na aba TURNOS: as linhas desse turno ficam sem lista suspensa.');
    });

    renderizarMatriz_(aba, modelo, par, catalogo, tz);
    SpreadsheetApp.flush();
    registrarBase_(aba, tz);              // a matriz recém-desenhada vira a referência da sincronização
    ss.setActiveSheet(aba);

    // leitura de volta, feita na própria planilha
    const depois = diferencasDaMatrizAtual_(aba, lidas.alocs, tz);
    const avisos = modelo.avisos.slice();
    if (lidas.semData) avisos.push(lidas.semData + ' linha(s) da tabela sem data reconhecível foram ignoradas.');
    if (lidas.incompletas) avisos.push(lidas.incompletas + ' linha(s) da tabela sem serviço ou turno foram ignoradas.');

    let msg = '• ' + modelo.resumo.militares + ' militares, ' + modelo.linhas.length + ' linhas (turnos ' + modelo.letras.join('/') + '), ' + modelo.dias.length + ' dias\n' +
      '• ' + modelo.resumo.alocacoesMes + ' alocações no mês → ' + modelo.resumo.celulasPreenchidas + ' células preenchidas\n' +
      '• Conferência lendo a planilha de volta: ' + (depois ? (depois.cmp.total === 0 && !depois.orfas ? '0 diferenças' : '\n' + textoDiferencas_(depois)) : 'não foi possível conferir');
    if (avisos.length) msg += '\n\nAvisos:\n- ' + avisos.slice(0, 10).join('\n- ');
    ui.alert(tituloEscala_(par.mes, par.secao), msg, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Não foi possível carregar a escala', e.message, ui.ButtonSet.OK);
  }
}

function conferirMatriz() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  try {
    const tz = ss.getSpreadsheetTimeZone();
    const aba = abaDaEscala_(ss, false);
    const d = aba ? diferencasDaMatrizAtual_(aba, lerAlocacoes_(tz).alocs, tz) : null;
    if (!d) { ui.alert('Escalas', 'Ainda não há uma escala carregada. Use "Carregar escala" no painel Mostrar Escala.', ui.ButtonSet.OK); return; }
    ui.alert('Conferência escala carregada × tabela',
      d.cmp.total === 0 && !d.orfas ? 'A escala carregada e a tabela estão iguais (0 diferenças).' : textoDiferencas_(d),
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Não foi possível conferir', e.message, ui.ButtonSet.OK);
  }
}