/**
 * ESCALA NA PLANILHA ("matriz" no código; na tela se diz "escala") — camada do Google Sheets
 * (lê as abas, desenha a escala do mês, confere).
 * A lógica de conversão está em nucleo.js.
 *
 * Uso:  menu "Escalas - 2º GB" > "Mostrar Grade Geral" (P17 item 3; antes "Mostrar Escala") abre o painel, que carrega a escala
 *       (mês em B1, seção em B2 da aba GRADE GERAL) e salva as edições na tabela.
 *       menu "Escalas - 2º GB" > "Conferir Integridade dos Dados" abre o painel de integridade
 *       (choques de horário, catálogo de turnos e escala carregada × tabela; só lê e relata)
 *
 * montarMatriz() é chamada pelo painel (não tem mais item próprio no menu). Antes de
 * recarregar uma escala que tenha edições suas ainda não salvas na tabela, ela pede confirmação.
 * Mudanças que vieram da tabela (outra pessoa, ou a pré-escala) não pedem confirmação.
 */

/** B57: identifica o código que está rodando (aparece no diagnóstico e no log). */
const VERSAO_DO_CODIGO_ = 'p16-funcoes-viaturas · B57';

const CONFIG = {
  ABA_ALOCACOES: 'ALOCAÇÕES',             // B52: chamava-se ALOCAÇÕES TABULADAS; abaAtual_ renomeia a antiga
  ABA_MILITARES: 'MILITARES',
  ABA_TURNOS: 'TURNOS',
  ABA_MATRIZ: 'GRADE GERAL',            // B52: chamava-se MATRIZ e depois ESCALA DO MÊS; abaAtual_ renomeia a antiga

  // layout da aba GRADE GERAL (a linha é "militar + posição": não há coluna de turno)
  LINHA_MES: 1, LINHA_SECAO: 2, LINHA_SEMANA: 3, LINHA_CABECALHO: 4, PRIMEIRA_LINHA: 5,
  COL_MAT: 1, COL_MILITAR: 2, COL_EQUIPE: 3, PRIMEIRA_COL_DIA: 4,
  // P17 item 2: a largura vem do conteúdo (autoResizeColumns); estes são só os mínimos, em px
  LARGURA_MIN_DIA: 40, LARGURA_MIN_IDENT: 60,
  FOLGA_DIA: 24,                      // a seta da lista suspensa não entra na conta do autoResize
  FOLGA_IDENT: 12,
  COR_REPETIDA: '#E8EAED'             // P17 item 4: texto quase branco do que se repete na identificação
  // P17 item 1: as cores dos serviços saíram daqui; ver CORES_DOS_SERVICOS_ e corDoServico_ (nucleo.js)
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Escalas - 2º GB')
    .addItem('Escala Automática', 'abrirPainel')                   // P17 item 6: antes "Pré-escala"
    .addItem('Mostrar Grade Geral', 'abrirPainelMatriz')            // P17 item 3: antes "Mostrar Escala"
    .addItem('Escalas de Serviço', 'abrirPainelGuarnicao')
    // B36 (RN-94): o menu do Apps Script é montado aqui e não dá para habilitar conforme a célula
    // selecionada; o item valida a célula ativa no clique (ver alocar_funcao.js).
    .addItem('Alocar em Função', 'alocarEmFuncao')
    .addSeparator()
    .addItem('Configurações', 'abrirPainelParametros')
    .addItem('Conferir Integridade dos Dados', 'abrirPainelIntegridade')
    .addItem('Diagnóstico de motoristas', 'diagnosticoMotoristas')      // B57: temporário, sai quando a causa for confirmada
    .addToUi();
}

/* ------------------------------------------------------------------ leitura */

/**
 * B52: a aba com esse nome, renomeando sozinha a que ainda estiver com um nome antigo
 * (ver ABAS_NOMES_ANTIGOS_ em nucleo.js). O usuário não renomeia nada à mão. Se a nova e a antiga
 * existirem juntas, nenhuma é apagada: vale a nova, e avisosDeAbas_ conta isso aos painéis.
 * A busca é sempre pelo nome inteiro (getSheetByName), nunca por "começa com" ou "contém".
 * Para qualquer outra aba, é o mesmo que getSheetByName. null se não existe.
 */
function abaAtual_(ss, nome) {
  const aba = ss.getSheetByName(nome);
  if (aba || !ABAS_NOMES_ANTIGOS_[nome]) return aba;
  const plano = planoDeMigracaoDeAbas_(ss.getSheets().map(function (s) { return s.getName(); }), nome);
  if (!plano.renomear.length) return null;
  const antiga = ss.getSheetByName(plano.renomear[0].de);
  antiga.setName(nome);                                   // só o nome muda: dados, formatação e abas de referência ficam como estão
  return antiga;
}

/** B52: renomeia de uma vez as cinco abas que ainda estiverem com nome antigo. Chamada ao abrir cada painel. */
function migrarAbas_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(ABAS_NOMES_ANTIGOS_).forEach(function (nome) { abaAtual_(ss, nome); });
}

/** B52: avisos de aba nova e antiga existindo ao mesmo tempo (nenhuma é apagada). */
function avisosDeAbas_() {
  const ss = SpreadsheetApp.getActive();
  return planoDeMigracaoDeAbas_(ss.getSheets().map(function (s) { return s.getName(); })).avisos;
}

/** A aba da grade geral (a escala do mês na planilha). Com criar=true cria quando não existe. */
function abaDaEscala_(ss, criar) {
  let aba = abaAtual_(ss, CONFIG.ABA_MATRIZ);
  if (!aba && criar) aba = ss.insertSheet(CONFIG.ABA_MATRIZ);
  return aba;
}

function lerAba_(nome, opcoes) {
  const aba = abaAtual_(SpreadsheetApp.getActive(), nome);
  if (!aba) throw new Error('Aba não encontrada: "' + nome + '".');
  const faixa = aba.getDataRange();
  const valores = faixa.getValues();
  if (valores.length === 0) throw new Error('A aba "' + nome + '" está vazia.');
  const t = { nome: nome, cab: valores[0].map(normalizar_), linhas: valores.slice(1) };
  // B57: o texto como aparece na tela, para as colunas sim/não e de categoria (ver lerMilitares_)
  if (opcoes && opcoes.exibidos) t.exibidos = faixa.getDisplayValues().slice(1);
  return t;
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

/**
 * Data da célula -> 'aaaa-mm-dd' no fuso da planilha ('' se não for uma data reconhecível).
 * B31 (RN-40): aceita também dia e mês com um só dígito ("5/1/2026"), que é como a planilha
 * devolve a célula quando ela foi digitada como texto em vez de data.
 */
function diaComoTexto_(v, tz) {
  if (ehData_(v)) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = texto_(v);
  const dois = function (x) { return ('0' + x).slice(-2); };
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + dois(m[2]) + '-' + dois(m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? m[1] + '-' + dois(m[2]) + '-' + dois(m[3]) : '';
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

/** Valores que contam como "sim" nas colunas MOTORISTA e VOLUNTÁRIO JES. */
const SIM_MILITARES_ = ['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'];

/**
 * B57 (RN-12): na sandbox, com "Sim" na coluna MOTORISTA, ninguém era lido como motorista — e o
 * mesmo código, com os mesmos dados exportados, lê os 76. A aba MILITARES é uma Tabela do Sheets.
 * Duas medidas enquanto a causa não é confirmada:
 *   - a célula é aceita como "sim" pelo valor (getValues) OU pelo texto exibido (getDisplayValues);
 *     se uma coluna tipada da Tabela devolver algo que não é o texto, o exibido ainda vale;
 *   - instrumentação: na primeira leitura de cada execução, o console recebe o índice da coluna, o
 *     cabeçalho e o valor bruto das primeiras linhas (ver diagnosticoMotoristas, em matriz.js).
 * Ao confirmar a causa, a instrumentação sai (a leitura pelo texto exibido pode ficar).
 */
let LOG_MILITARES_FEITO_ = false;

function simDaCelula_(valor, exibido) {
  return SIM_MILITARES_.indexOf(normalizar_(valor)) >= 0 || SIM_MILITARES_.indexOf(normalizar_(exibido)) >= 0;
}

function lerMilitares_() {
  const t = lerAba_(CONFIG.ABA_MILITARES, { exibidos: true });
  const c = {
    mat: coluna_(t, 'MATRÍCULA', true), nome: coluna_(t, 'NOME DE GUERRA', true), secao: coluna_(t, 'SEÇÃO', true),
    posto: coluna_(t, 'POSTO/GRAD', false), jornada: coluna_(t, 'JORNADA', false),
    equipe: coluna_(t, 'EQUIPE', false), antig: coluna_(t, 'ANTIG', false), motorista: coluna_(t, 'MOTORISTA', false),
    vjes: coluna_(t, 'VOLUNTÁRIO JES', false), cnh: coluna_(t, 'CNH', false)
  };
  const pega = function (l, i) { return i < 0 ? '' : l[i]; };
  const exib = t.exibidos || [];
  const res = [];
  t.linhas.forEach(function (l, ordem) {
    const mat = texto_(l[c.mat]);
    if (!mat) return;
    const e = exib[ordem] || [];
    res.push({
      mat: mat, nome: texto_(l[c.nome]), posto: texto_(pega(l, c.posto)), secao: texto_(l[c.secao]),
      jornada: texto_(pega(l, c.jornada)), equipe: texto_(pega(l, c.equipe)), antig: pega(l, c.antig), ordem: ordem,
      // true só se a coluna MOTORISTA existir e tiver algo como SIM/S/X (o "-" e o vazio contam como não)
      temColunaMotorista: c.motorista >= 0,
      motorista: c.motorista >= 0 && (simDaCelula_(l[c.motorista], e[c.motorista]) || normalizar_(l[c.motorista]) === 'MOTORISTA'),
      // RN-46: atributo "voluntário JES" (sim/não). Só vale se a coluna existir; vazio e "não" contam como não.
      temColunaVoluntarioJes: c.vjes >= 0,
      voluntarioJes: c.vjes >= 0 && simDaCelula_(l[c.vjes], e[c.vjes]),
      // RN-12: categoria(s) de CNH do militar. Sem a coluna, lista vazia.
      // B59: letra a letra, na notação oficial ("AD" = A e D; "B, D" também vale); ver categoriasCnh_
      temColunaCnh: c.cnh >= 0
    });
    const m = res[res.length - 1];
    const cat = categoriasCnh_(c.cnh >= 0 ? (texto_(pega(l, c.cnh)) || texto_(pega(e, c.cnh))) : '');
    m.cnh = cat.categorias;
    m.cnhInvalida = cat.invalidas;              // o que não é categoria (A a E): o painel avisa
  });
  if (!LOG_MILITARES_FEITO_) {                       // B57: uma vez por execução
    LOG_MILITARES_FEITO_ = true;
    try { console.log(JSON.stringify(relatorioMotoristas_(t, c, res))); } catch (err) { /* o log nunca derruba a leitura */ }
  }
  return res;
}

/** B57: o que o código está vendo na coluna MOTORISTA (para o log e para diagnosticoMotoristas). */
function relatorioMotoristas_(t, c, res) {
  const exib = t.exibidos || [];
  const bruto = function (x) {
    return { valor: x, tipo: Object.prototype.toString.call(x), json: JSON.stringify(x), codigos: String(x == null ? '' : x).split('').map(function (ch) { return ch.charCodeAt(0); }), normalizado: normalizar_(x) };
  };
  const amostra = [];
  for (let i = 0; i < t.linhas.length && amostra.length < 5; i++) {
    const l = t.linhas[i];
    if (texto_(l[c.mat]) === '') continue;
    amostra.push({ linhaDaPlanilha: i + 2, mat: texto_(l[c.mat]), motorista: c.motorista >= 0 ? bruto(l[c.motorista]) : null, exibido: c.motorista >= 0 ? (exib[i] || [])[c.motorista] : null });
  }
  return {
    b57: 'lerMilitares_', versao: VERSAO_DO_CODIGO_,
    indiceMotorista: c.motorista, cabecalhoNesseIndice: c.motorista >= 0 ? t.cab[c.motorista] : null,
    cabecalho: t.cab, linhas: t.linhas.length, militares: res.length,
    motoristas: res.filter(function (m) { return m.motorista; }).length,
    comCnh: res.filter(function (m) { return m.cnh.length; }).length,
    amostra: amostra
  };
}

/**
 * B57: diagnóstico para rodar na sandbox (menu Escalas - 2º GB > Diagnóstico de motoristas, ou
 * direto no editor do Apps Script). Mostra, e grava no log da execução, qual projeto está rodando,
 * a versão do código e o que lerMilitares_ vê na coluna MOTORISTA.
 */
function diagnosticoMotoristas() {
  const t = lerAba_(CONFIG.ABA_MILITARES, { exibidos: true });
  const c = { mat: coluna_(t, 'MATRÍCULA', true), motorista: coluna_(t, 'MOTORISTA', false), cnh: coluna_(t, 'CNH', false) };
  const res = lerMilitares_();
  const rel = relatorioMotoristas_(t, c, res);
  rel.scriptId = ScriptApp.getScriptId();
  rel.planilha = SpreadsheetApp.getActive().getId();
  console.log(JSON.stringify(rel));
  const linhas = [
    'Versão do código: ' + rel.versao,
    'ID do projeto Apps Script: ' + rel.scriptId,
    'Coluna MOTORISTA: índice ' + rel.indiceMotorista + ' (cabeçalho lido: ' + rel.cabecalhoNesseIndice + ')',
    'Militares lidos: ' + rel.militares + ' · motoristas: ' + rel.motoristas + ' · com CNH: ' + rel.comCnh,
    '',
    'Primeiras linhas (valor bruto da coluna MOTORISTA):'
  ].concat(rel.amostra.map(function (a) {
    return 'linha ' + a.linhaDaPlanilha + ' · ' + a.mat + ' · valor ' + (a.motorista ? a.motorista.json + ' (' + a.motorista.tipo + ', códigos ' + a.motorista.codigos.join(' ') + ')' : '—') + ' · exibido "' + a.exibido + '"';
  })).concat(['', 'O mesmo texto foi gravado no log da execução (Apps Script > Execuções). Copie e mande à Programação.']);
  try { SpreadsheetApp.getUi().alert('Diagnóstico de motoristas (B57)', linhas.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK); } catch (err) { /* rodando no editor, sem planilha aberta */ }
  return rel;
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

/** Mês e seção da aba GRADE GERAL (B1 e B2). Se o mês não estiver preenchido, pergunta. */
function lerParametros_(aba, ui, tz) {
  const v = aba.getRange(CONFIG.LINHA_MES, 2).getValue();
  let mes = '';
  if (ehData_(v)) mes = Utilities.formatDate(v, tz, 'yyyy-MM');
  else if (/^\d{4}-\d{2}$/.test(texto_(v))) mes = texto_(v);
  if (!mes) {
    const r = ui.prompt('Carregar grade geral', 'Mês da grade geral (aaaa-mm), por exemplo 2026-10:', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return null;
    mes = r.getResponseText().trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: "' + mes + '". Use o formato aaaa-mm.');
  }
  const secao = texto_(aba.getRange(CONFIG.LINHA_SECAO, 2).getValue()) || valorParametro_('SECAO_PADRAO', mes);
  return { mes: mes, secao: secao };
}

/** true se a aba tem a grade de uma versão anterior (com a coluna TURNO no lugar do 1º dia). Precisa ser recarregada. */
function layoutAntigo_(aba) {
  if (aba.getLastRow() < CONFIG.LINHA_CABECALHO) return false;
  return normalizar_(aba.getRange(CONFIG.LINHA_CABECALHO, CONFIG.PRIMEIRA_COL_DIA).getValue()) === 'TURNO';
}

/** Lê a escala que está na aba (ou null se a aba ainda não tem uma, ou se é de uma versão anterior). */
function lerMatrizAtual_(aba, tz) {
  const ult = aba.getLastRow(), ultC = aba.getLastColumn();
  if (ult < CONFIG.PRIMEIRA_LINHA || ultC < CONFIG.PRIMEIRA_COL_DIA) return null;
  if (normalizar_(aba.getRange(CONFIG.LINHA_CABECALHO, CONFIG.COL_MAT).getValue()) !== 'MATRICULA') return null;
  if (layoutAntigo_(aba)) return null;
  const nl = ult - CONFIG.PRIMEIRA_LINHA + 1, nd = ultC - CONFIG.PRIMEIRA_COL_DIA + 1;
  const ident = aba.getRange(CONFIG.PRIMEIRA_LINHA, 1, nl, CONFIG.PRIMEIRA_COL_DIA - 1).getValues();
  const cab = aba.getRange(CONFIG.LINHA_CABECALHO, CONFIG.PRIMEIRA_COL_DIA, 1, nd).getValues()[0];
  const grade = aba.getRange(CONFIG.PRIMEIRA_LINHA, CONFIG.PRIMEIRA_COL_DIA, nl, nd).getValues();
  return {
    dias: cab.map(function (v) { return diaComoTexto_(v, tz); }),
    linhas: ident.map(function (r) { return { mat: texto_(r[CONFIG.COL_MAT - 1]) }; }),
    celulas: grade
  };
}

/**
 * Compara a escala que está na aba com a tabela, usando os dias da própria
 * escala (assim funciona mesmo depois de você trocar o mês em B1).
 * Os serviços que não couberam na grade quando ela foi carregada (FORA na referência) não contam
 * como "só na tabela": eles não aparecem na grade por escolha dos parâmetros, e continuam na tabela.
 */
function diferencasDaMatrizAtual_(aba, alocsTabela, tz, rot) {
  const m = lerMatrizAtual_(aba, tz);
  if (!m) return null;
  const diasValidos = {};
  m.dias.forEach(function (d) { if (d) diasValidos[d] = true; });
  const base = lerBase_(tz) || [];
  const fora = Object.create(null);
  base.forEach(function (b) { if (b.fora) fora[chaveAloc_(b)] = true; });
  const daTabela = alocsTabela.filter(function (a) { return diasValidos[a.dia] && !fora[chaveAloc_(a)]; });
  const volta = desmontarMatriz_(m.linhas, m.dias, m.celulas, rot);
  return { cmp: compararAlocacoes_(daTabela, volta.alocs), orfas: volta.orfas + volta.ilegiveis.length };
}

/* ------------------------------------------------------------------ desenho */

function renderizarMatriz_(aba, modelo, par, rot, tz) {
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
  aba.showRows(1, aba.getMaxRows());                 // RN-02: uma escala nova começa com todas as linhas visíveis

  // parâmetros
  aba.getRange(1, 1, 2, 1).setValues([['MÊS'], ['SEÇÃO']]).setFontWeight('bold');
  aba.getRange(CONFIG.LINHA_MES, 2).setValue(Utilities.parseDate(par.mes + '-01', tz, 'yyyy-MM-dd')).setNumberFormat('mm/yyyy');
  aba.getRange(CONFIG.LINHA_SECAO, 2).setValue(par.secao);

  // cabeçalho
  const nomesSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  aba.getRange(CONFIG.LINHA_SEMANA, c0, 1, nd).setValues([modelo.dias.map(function (d) { return nomesSemana[diaDaSemana_(d)]; })]);
  aba.getRange(CONFIG.LINHA_CABECALHO, 1, 1, c0 - 1).setValues([['MATRÍCULA', 'MILITAR', 'EQUIPE']]);
  aba.getRange(CONFIG.LINHA_CABECALHO, c0, 1, nd)
    .setValues([modelo.dias.map(function (d) { return Utilities.parseDate(d, tz, 'yyyy-MM-dd'); })])
    .setNumberFormat('dd');

  // corpo
  aba.getRange(r0, CONFIG.COL_MAT, nl, 1).setNumberFormat('@');
  aba.getRange(r0, 1, nl, c0 - 1).setValues(modelo.linhas.map(function (l) { return [l.mat, l.nome, l.grupo]; }));
  aba.getRange(r0, c0, nl, nd).setValues(modelo.celulas);

  // lista suspensa: serviço + horário, como na aba TURNOS. RN-03: o Saldo só aparece nas linhas de militar do Adm.
  if (rot.lista.length) {
    const listas = listasDeCelula_(rot);
    const regraDe = function (lista, ajuda) {
      return SpreadsheetApp.newDataValidation().requireValueInList(lista, true).setAllowInvalid(false).setHelpText(ajuda).build();
    };
    const regraAdm = regraDe(listas.comSaldo, 'Serviço e horário, como na aba TURNOS.');
    const regraOutros = regraDe(listas.semSaldo, 'Serviço e horário, como na aba TURNOS. Saldo só para militar do Adm.');
    const ehAdm = function (i) { return modelo.linhas[i].grupo === 'ADM'; };
    let ini = 0;                                           // faixas seguidas de linhas do mesmo tipo
    for (let i = 1; i <= nl; i++) {
      if (i < nl && ehAdm(i) === ehAdm(ini)) continue;
      aba.getRange(r0 + ini, c0, i - ini, nd).setDataValidation(ehAdm(ini) ? regraAdm : regraOutros);
      ini = i;
    }
  }

  // aparência
  aba.getRange(1, 1, nLinhasTotal, nCols).setFontFamily('Arial').setFontSize(10);
  aba.getRange(CONFIG.LINHA_CABECALHO, 1, 1, nCols)
    .setBackground('#2F5D50').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
  aba.getRange(CONFIG.LINHA_SEMANA, c0, 1, nd).setHorizontalAlignment('center').setFontColor('#5F6368').setFontSize(8);
  aba.getRange(r0, c0, nl, nd).setHorizontalAlignment('center');
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

  // P17 item 4 (RN-02): o que se repete na identificação fica em tom quase branco, sem mesclar células
  // (decisão de 14/11). Os valores continuam em todas as linhas, para o filtro e a ordenação não quebrarem.
  // Antes era cinza médio (#9AA0A6) e só nas linhas extras do militar; agora a EQUIPE também, quando
  // repete a da linha de cima.
  const desenho = desenhoDasLinhas_(modelo.linhas);
  const repetidas = desenho.repeteMilitar.map(function (i) { return aba.getRange(r0 + i, 1, 1, c0 - 1).getA1Notation(); })
    .concat(desenho.repeteEquipe.map(function (i) { return aba.getRange(r0 + i, CONFIG.COL_EQUIPE).getA1Notation(); }));
  if (repetidas.length) aba.getRangeList(repetidas).setFontColor(CONFIG.COR_REPETIDA);

  // Linhas divisórias: fina entre militares, grossa entre grupos (equipes).
  // B34 (RN-02): a borda vai em CIMA da primeira linha de cada militar, não embaixo da última.
  // A última linha de um militar pode estar oculta pelo botão "Ocultar linhas vazias", e com ela
  // desaparecia a divisória; a primeira linha nunca é oculta, então o separador sempre aparece.
  // P17 item 7 (RN-02): entre grupos (Alfa, Bravo, Charlie, Delta, Adm, sem equipe, outras seções) a
  // borda passa de média a grossa, e o nome da equipe fica em negrito na 1ª linha de cada grupo.
  const inicioMilitar = desenho.inicioMilitar.map(function (i) { return aba.getRange(r0 + i, 1, 1, nCols).getA1Notation(); });
  if (inicioMilitar.length) aba.getRangeList(inicioMilitar).setBorder(true, null, null, null, null, null);
  desenho.inicioGrupo.forEach(function (i) {
    aba.getRange(r0 + i, 1, 1, nCols).setBorder(true, null, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_THICK);
  });
  const nomesDeGrupo = [0].concat(desenho.inicioGrupo).map(function (i) { return aba.getRange(r0 + i, CONFIG.COL_EQUIPE).getA1Notation(); });
  aba.getRangeList(nomesDeGrupo).setFontWeight('bold');
  // fecha a tabela embaixo (a borda de fora não separa ninguém; se a última linha estiver oculta, só o contorno some)
  aba.getRange(r0 + nl - 1, 1, 1, nCols).setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // cor por serviço
  // a célula é "Serviço HH–HH" (ou "Serviço (T)"): a cor vem do começo do texto, o nome do serviço + espaço.
  // P17 item 1 (RN-02): uma regra para CADA serviço da aba TURNOS, com a mesma cor da legenda e da grade
  // de guarnição.
  // P17 correção: a regra é "o texto começa com", nativa do Sheets, e não mais uma fórmula REGEXMATCH.
  // A fórmula era montada com "," e a planilha está em português, onde o separador é ";": o Sheets
  // gravava a fórmula como texto e nenhuma célula era pintada (já acontecia antes da P17). A condição
  // nativa não depende do idioma da planilha e já ignora maiúscula/minúscula. Nome mais longo primeiro,
  // para "PE Seguro" não ser pego por um serviço que se chamasse só "PE" (vale a primeira regra que casa).
  const grade = aba.getRange(r0, c0, nl, nd);
  const cores = coresDosServicos_(Object.keys(rot.porRotulo).map(function (k) { return rot.porRotulo[k].servico; }));
  aba.setConditionalFormatRules(Object.keys(cores)
    .sort(function (a, b) { return b.length - a.length || (a < b ? -1 : 1); })
    .map(function (nome) {
      return SpreadsheetApp.newConditionalFormatRule()
        .whenTextStartsWith(nome + ' ')
        .setBackground(cores[nome][0]).setFontColor(cores[nome][1])
        .setRanges([grade]).build();
    }));

  // P17 item 2 (RN-02): cada coluna na largura do próprio conteúdo, para nada ficar cortado.
  // Fica por último: depende da fonte, do negrito e dos valores já aplicados.
  // Larguras fixas cortavam nomes longos e serviços como "Defensoria 07–19 (A)". O autoResize do
  // Sheets não conta a seta da lista suspensa, daí a folga; o mínimo segura colunas vazias.
  SpreadsheetApp.flush();
  aba.autoResizeColumns(1, nCols);
  for (let c = 1; c <= nCols; c++) {
    const dia = c >= c0;
    aba.setColumnWidth(c, Math.max(aba.getColumnWidth(c) + (dia ? CONFIG.FOLGA_DIA : CONFIG.FOLGA_IDENT),
      dia ? CONFIG.LARGURA_MIN_DIA : CONFIG.LARGURA_MIN_IDENT));
  }

  aba.setFrozenRows(CONFIG.LINHA_CABECALHO);
  aba.setFrozenColumns(CONFIG.COL_EQUIPE);
}

/* ------------------------------------------------------------- mensagens */

/** 'mat|dia|serviço|turno' -> 'SD BM JUAN, 05/11/2026, Pronto 08–20' */
function descreverChave_(chave, rot, nomes) {
  const p = partesDaChave_(chave);
  return ((nomes && nomes[p.mat]) || ('matrícula ' + p.mat)) + ', ' + formatarDia_(p.dia) + ', ' + rotuloDe_(rot, p.servico, p.turno);
}

function textoDiferencas_(d, rot) {
  const c = d.cmp, nomes = nomesPorMatricula_();
  const linhas = [];
  if (c.soNaTabela.length) linhas.push('Na tabela e não na grade geral carregada (' + c.soNaTabela.length + '):');
  c.soNaTabela.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave, rot, nomes)); });
  if (c.soNaEscala.length) linhas.push('Na grade geral carregada e não na tabela (' + c.soNaEscala.length + '):');
  c.soNaEscala.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave, rot, nomes)); });
  if (d.orfas) linhas.push('Células preenchidas sem matrícula ou data válidas, ou com texto que não se entende: ' + d.orfas);
  return linhas.join('\n');
}

/**
 * Edições SUAS que ainda não foram salvas na tabela: a escala como está na planilha contra a
 * cópia de referência (a escala como foi carregada). Mudanças que só aconteceram na tabela
 * não contam: elas não se perdem ao recarregar. Sem cópia de referência (escala carregada
 * numa versão antiga), cai na comparação direta com a tabela. null se não há escala carregada.
 */
function edicoesNaoSalvas_(aba, alocsTabela, tz, rot) {
  const m = lerMatrizAtual_(aba, tz);
  if (!m) return null;
  const base = lerBase_(tz);
  if (!base) return diferencasDaMatrizAtual_(aba, alocsTabela, tz, rot);
  const volta = desmontarMatriz_(m.linhas, m.dias, m.celulas, rot);
  return { cmp: compararAlocacoes_(base.filter(function (b) { return !b.fora; }), volta.alocs), orfas: volta.orfas + volta.ilegiveis.length };
}

function textoEdicoes_(d, rot) {
  const c = d.cmp, nomes = nomesPorMatricula_();
  const linhas = [];
  if (c.soNaEscala.length) linhas.push('Incluídas (' + c.soNaEscala.length + '):');
  c.soNaEscala.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave, rot, nomes)); });
  if (c.soNaTabela.length) linhas.push('Apagadas (' + c.soNaTabela.length + '):');
  c.soNaTabela.slice(0, 6).forEach(function (x) { linhas.push('   • ' + descreverChave_(x.chave, rot, nomes)); });
  if (d.orfas) linhas.push('Células preenchidas sem matrícula ou data válidas, ou com texto que não se entende: ' + d.orfas);
  return linhas.join('\n');
}

const MESES_ = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 'Escala de novembro de 2026 da 1ª SB' */
function tituloEscala_(mes, secao) {
  return 'Escala de ' + MESES_[Number(mes.slice(5)) - 1] + ' de ' + mes.slice(0, 4) + ' da ' + secao;
}

/** Os textos de célula (serviço + horário) a partir da aba TURNOS. */
function lerRotulos_(catalogoPares) {
  const hor = lerHorarios_();
  return { rot: montarRotulos_(hor.porChave, catalogoPares), hor: hor };
}

/* --------------------------------------------------------- ações do menu */

/**
 * B48 (RN-94, RN-81): regrava as notas de função de toda a grade geral a partir da tabela.
 * Chamada ao carregar a escala, depois de salvar no painel Mostrar Grade Geral e depois de "Alocar em
 * Função". rot e alocs são opcionais (relidos quando faltam). Não mexe em valores nem validações.
 */
function atualizarNotasDeFuncao_(aba, tz, rot, alocs) {
  aba = aba || abaDaEscala_(SpreadsheetApp.getActive(), false);
  if (!aba) return 0;
  const m = lerMatrizAtual_(aba, tz);
  if (!m || !m.linhas.length || !m.dias.length) return 0;
  if (!rot) rot = montarRotulos_(lerHorarios_().porChave, lerCatalogo_().pares);
  if (!alocs) alocs = lerAlocacoes_(tz).alocs;
  const notas = notasDeFuncao_(m.linhas, m.dias, m.celulas, rot, alocs);
  aba.getRange(CONFIG.PRIMEIRA_LINHA, CONFIG.PRIMEIRA_COL_DIA, notas.length, notas[0].length).setNotes(notas);
  return notas.reduce(function (n, l) { return n + l.filter(Boolean).length; }, 0);
}

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
    const lr = lerRotulos_(catalogo.pares);
    const rot = lr.rot;

    // não descarta, sem avisar, edições suas que ainda não foram salvas na tabela
    if (layoutAntigo_(aba)) {
      const r = ui.alert('Atenção',
        'A grade geral carregada é de uma versão anterior do sistema e precisa ser carregada de novo. ' +
        'Se ela tiver alterações que não foram salvas na tabela, elas serão perdidas. Continuar?',
        ui.ButtonSet.YES_NO);
      if (r !== ui.Button.YES) return;
    } else {
      const antes = edicoesNaoSalvas_(aba, lidas.alocs, tz, rot);
      if (antes && (antes.cmp.total > 0 || antes.orfas > 0)) {
        const r = ui.alert('Atenção',
          'A grade geral carregada tem alterações que ainda não foram salvas na tabela:\n\n' + textoEdicoes_(antes, rot) +
          '\n\nCarregar a grade geral de novo descarta essas alterações (para guardá-las, escolha Não e use "Salvar alterações" no painel). Continuar?',
          ui.ButtonSet.YES_NO);
        if (r !== ui.Button.YES) return;
      }
    }

    const linhasPorMilitar = valorParametro_('LINHAS_POR_MILITAR', par.mes);
    const modelo = montarModeloMatriz_(lidas.alocs, militares,
      { mes: par.mes, secao: par.secao, linhas: linhasPorMilitar, rotulos: rot, horarios: lr.hor.porChave, catalogo: catalogo.pares });
    if (modelo.linhas.length === 0) throw new Error('Nenhum militar da seção "' + par.secao + '" e nenhuma alocação em ' + par.mes + '.');
    if (!rot.lista.length) modelo.avisos.push('A aba TURNOS não tem nenhum turno com horário legível: a grade geral fica sem lista suspensa.');
    lr.hor.avisos.forEach(function (t) { modelo.avisos.push(t); });

    renderizarMatriz_(aba, modelo, par, rot, tz);
    atualizarNotasDeFuncao_(aba, tz, rot, lidas.alocs);     // B48: a função vira nota na célula
    SpreadsheetApp.flush();
    registrarBase_(aba, tz, rot, modelo.foraDaGrade);      // a escala recém-desenhada vira a referência da sincronização
    ss.setActiveSheet(aba);

    // leitura de volta, feita na própria planilha
    const depois = diferencasDaMatrizAtual_(aba, lidas.alocs, tz, rot);
    const avisos = modelo.avisos.slice();
    if (lidas.semData) avisos.push(lidas.semData + ' linha(s) da tabela sem data reconhecível foram ignoradas.');
    if (lidas.incompletas) avisos.push(lidas.incompletas + ' linha(s) da tabela sem serviço ou turno foram ignoradas.');

    let msg = '• ' + modelo.resumo.militares + ' militares, ' + modelo.resumo.linhasPorMilitar + ' linha(s) cada, ' + modelo.dias.length + ' dias\n' +
      '• ' + modelo.resumo.alocacoesMes + ' alocações no mês → ' + modelo.resumo.celulasPreenchidas + ' células preenchidas' +
      (modelo.resumo.foraDaGrade ? ' (' + modelo.resumo.foraDaGrade + ' fora da grade)' : '') + '\n' +
      '• Conferência lendo a planilha de volta: ' + (depois ? (depois.cmp.total === 0 && !depois.orfas ? '0 diferenças' : '\n' + textoDiferencas_(depois, rot)) : 'não foi possível conferir');
    if (avisos.length) msg += '\n\nAvisos:\n- ' + avisos.slice(0, 10).join('\n- ');
    ui.alert(tituloEscala_(par.mes, par.secao), msg, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Não foi possível carregar a grade geral', e.message, ui.ButtonSet.OK);
  }
}

function conferirMatriz() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  try {
    const tz = ss.getSpreadsheetTimeZone();
    const aba = abaDaEscala_(ss, false);
    const rot = aba ? lerRotulos_(lerCatalogo_().pares).rot : null;
    const d = aba ? diferencasDaMatrizAtual_(aba, lerAlocacoes_(tz).alocs, tz, rot) : null;
    if (!d) { ui.alert('Escalas', 'Ainda não há uma grade geral carregada. Use "Carregar grade geral" no painel Mostrar Grade Geral.', ui.ButtonSet.OK); return; }
    ui.alert('Conferência grade geral carregada × tabela',
      d.cmp.total === 0 && !d.orfas ? 'A grade geral carregada e a tabela estão iguais (0 diferenças).' : textoDiferencas_(d, rot),
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Não foi possível conferir', e.message, ui.ButtonSet.OK);
  }
}
