/**
 * PAINEL MOSTRAR ESCALA — camada do Google Sheets da sincronia planilha da escala -> tabela.
 * Depende de nucleo.js, matriz.js, pre_escala.js (painelDados, validarEntrada_), sincronia.js e choques_painel.js.
 * Tela: sidebar_matriz.html (crie como "HTML" com esse nome exato).
 *
 * A "cópia de referência" da escala fica numa aba oculta (_BASE_MATRIZ):
 * é gravada quando a escala é carregada e atualizada a cada salvamento.
 * Colunas: MATRÍCULA, DIA, SERVIÇO, TURNO, FORA. FORA = 1 marca o serviço que não coube nas linhas por
 * militar quando a escala foi carregada: ele não está na grade, continua na tabela e nunca é apagado pelo salvamento.
 */

const MSG_RECARREGAR_ = 'Esta escala foi carregada antes da última atualização do sistema (ou não tem referência salva). Carregue a escala de novo.';

const ABA_BASE_ = '_BASE_MATRIZ';

function abrirPainelMatriz() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_matriz').setTitle('Mostrar Escala');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ------------------------------------------------------------ cópia de referência */

function salvarBase_(alocs) {
  const ss = SpreadsheetApp.getActive();
  const aba = ss.getSheetByName(ABA_BASE_) || ss.insertSheet(ABA_BASE_);
  aba.clearContents();
  const linhas = [['MATRÍCULA', 'DIA', 'SERVIÇO', 'TURNO', 'FORA']].concat(alocs.map(function (a) { return [a.mat, a.dia, a.servico, a.turno, a.fora ? '1' : '']; }));
  if (aba.getMaxRows() < linhas.length) aba.insertRowsAfter(aba.getMaxRows(), linhas.length - aba.getMaxRows());
  aba.getRange(1, 1, linhas.length, 5).setNumberFormat('@').setValues(linhas);
  aba.hideSheet();
}

/** null se a aba não existe ou se é de uma versão anterior (colunas MATRÍCULA, DIA, TURNO, SERVIÇO): a escala precisa ser recarregada. */
function lerBase_(tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(ABA_BASE_);
  if (!aba) return null;
  const v = aba.getDataRange().getValues();
  if (v.length < 1 || normalizar_(v[0][0]) !== 'MATRICULA' || normalizar_(v[0][2]) !== 'SERVICO' || normalizar_(v[0][3]) !== 'TURNO') return null;
  return v.slice(1).filter(function (r) { return texto_(r[0]) !== ''; }).map(function (r) {
    return { mat: texto_(r[0]), dia: diaComoTexto_(r[1], tz), servico: texto_(r[2]), turno: texto_(r[3]), fora: texto_(r[4]) === '1' };
  });
}

/**
 * Chamada por montarMatriz() logo depois de desenhar: a escala recém-carregada vira a referência.
 * fora: os serviços do mês que não couberam nas linhas por militar (modelo.foraDaGrade).
 */
function registrarBase_(aba, tz, rot, fora) {
  const m = lerMatrizAtual_(aba, tz);
  if (!m) return;
  const volta = desmontarMatriz_(m.linhas, m.dias, m.celulas, rot);
  salvarBase_(volta.alocs.concat((fora || []).map(function (f) { return { mat: f.mat, dia: f.dia, servico: f.servico, turno: f.turno, fora: true }; })));
}

/* ------------------------------------------------------------ análise */

function analisarSincronia_(tz) {
  const ss = SpreadsheetApp.getActive();
  const aba = abaDaEscala_(ss, false);
  if (aba && layoutAntigo_(aba)) throw new Error(MSG_RECARREGAR_);
  const m = aba ? lerMatrizAtual_(aba, tz) : null;
  if (!m) throw new Error('Não há escala carregada. Carregue a escala do mês primeiro.');
  const todaBase = lerBase_(tz);
  if (!todaBase) throw new Error(MSG_RECARREGAR_);
  const base = todaBase.filter(function (b) { return !b.fora; });
  const fora = todaBase.filter(function (b) { return b.fora; });

  const hor = lerHorarios_();
  const catalogo = lerCatalogo_();
  const rot = montarRotulos_(hor.porChave, catalogo.pares);
  const desm = desmontarMatriz_(m.linhas, m.dias, m.celulas, rot);
  const dias = {};
  m.dias.forEach(function (d) { if (d) dias[d] = true; });
  const todas = lerAlocacoes_(tz).alocs;                     // todos os meses: o dia 31 precisa enxergar o dia 01
  const tabela = todas.filter(function (a) { return dias[a.dia]; });
  const res = calcularSincronizacao_(base, desm.alocs, tabela, catalogo.pares,
    { horarios: hor.porChave, todas: alocsComExpediente_(todas, hor, tz), ilegiveis: desm.ilegiveis, regras: contextoDeRegras_() });
  return { res: res, base: base, fora: fora, matriz: desm.alocs, orfas: desm.orfas, repetidas: desm.repetidas, dias: m.dias, avisosTurnos: hor.avisos, rot: rot };
}

function nomesPorMatricula_() {
  const mapa = {};
  lerMilitares_().forEach(function (x) { if (!(x.mat in mapa)) mapa[x.mat] = [x.posto, x.nome].filter(Boolean).join(' '); });
  return mapa;
}

function formatarItem_(i, nomes, rot) {
  const rotulo = function (p) { return p ? rotuloDe_(rot, p.servico, p.turno) : ''; };
  return {
    tipo: i.tipo,
    nome: nomes[i.mat] || ('matrícula ' + i.mat),
    dia: i.dia.slice(8) + '/' + i.dia.slice(5, 7),
    de: rotulo(i.de),
    para: rotulo(i.para),
    texto: i.texto || '',
    motivo: (i.motivos || []).map(function (m) { return m.texto; }).join('; '),
    tabela: (i.tabelaPares || []).map(rotulo).join(' / '),
    temTabela: !!i.tabelaPares,
    choca: (i.com || []).map(function (c) {
      const d = c.dia.slice(8) + '/' + c.dia.slice(5, 7);
      if (c.tipo === 'emenda') return 'emenda proibida: JES seguido de Pronto (' + rotuloDe_(rot, c.servico, c.turno) + ' em ' + d + ')';
      if (c.implicito) return 'choca com o expediente do Adm em ' + d + ' (' + horasTexto_(c.minutos) + ' h)';
      return 'choca com ' + rotuloDe_(rot, c.servico, c.turno) + ' em ' + d + ' (' + horasTexto_(c.minutos) + ' h)';
    }).join('; ')
  };
}

const LIMITE_LISTA_ = 40;

function resumoParaTela_(a, nomes) {
  const r = a.res, rot = a.rot;
  const parDe = function (k) { const p = partesDaChave_(k); return { servico: p.servico, turno: p.turno }; };
  const aplicar = []
    .concat(r.inserir.map(function (x) {
      return { tipo: x.troca ? 'alteracao' : 'inclusao', mat: x.mat, dia: x.dia, de: x.troca ? parDe(x.troca) : null, para: { servico: x.servico, turno: x.turno } };
    }))
    .concat(r.remover.filter(function (x) { return !x.troca; }).map(function (x) {
      const p = partesDaChave_(x.chave);
      return { tipo: 'exclusao', mat: p.mat, dia: p.dia, de: parDe(x.chave), para: null };
    }));
  const cortar = function (lista) { return lista.slice(0, LIMITE_LISTA_).map(function (i) { return formatarItem_(i, nomes, rot); }); };
  const avisos = (a.avisosTurnos || []).slice();
  if (a.orfas) avisos.push(a.orfas + ' célula(s) preenchida(s) em linha sem matrícula ou data foram ignoradas.');
  if (a.repetidas) avisos.push(a.repetidas + ' célula(s) repetem um serviço já lançado para o mesmo militar e dia; só a primeira vale.');
  if (a.fora && a.fora.length) avisos.push(a.fora.length + ' serviço(s) ficaram fora da grade quando a escala foi carregada (poucas linhas por militar). Continuam na tabela e não serão apagados.');
  return {
    resumo: r.resumo,
    aplicar: cortar(aplicar),
    aplicarTotal: aplicar.length,
    conflitos: cortar(r.conflitos),
    invalidas: cortar(r.invalidas),
    choques: cortar(r.choques),
    regras: cortar(r.regras),
    avisos: avisos,
    mes: a.dias[0] ? a.dias[0].slice(0, 7) : ''
  };
}

/* ------------------------------------------------------------ chamadas da tela */

function painelDadosMatriz() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const base = painelDados();
  const aba = abaDaEscala_(ss, false);
  const m = aba ? lerMatrizAtual_(aba, tz) : null;
  if (m && m.dias[0]) {
    base.mesSugerido = m.dias[0].slice(0, 7);
    base.secao = texto_(aba.getRange(CONFIG.LINHA_SECAO, 2).getValue()) || base.secao;
  }
  base.aberturaAutomatica = garantirGatilhoDeEdicao_();      // RN-31 (B21)
  return base;
}

/** Só lê e compara. Não grava nada. */
function painelSincPrevia() {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return resumoParaTela_(analisarSincronia_(tz), nomesPorMatricula_());
}

/** Aplica as mudanças da matriz na tabela, atualiza a referência e confere. */
function painelSincSalvar() {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const a = analisarSincronia_(tz);                       // relê tudo agora, dentro do bloqueio
    const r = a.res;
    const nomes = nomesPorMatricula_();
    const total = r.inserir.length + r.remover.length;
    if (total > 0) {
      aplicarSincronizacao_(r, tz);
      SpreadsheetApp.flush();
    }
    // a referência avança nas chaves aplicadas (e nas que já estavam iguais na tabela)
    salvarBase_(novaBase_(a.base, a.matriz, r, a.fora));
    SpreadsheetApp.flush();

    const depois = analisarSincronia_(tz).res;
    const restantes = depois.inserir.length + depois.remover.length;
    const tela = resumoParaTela_(a, nomes);
    return {
      gravadas: { inclusoes: r.resumo.inclusoes, exclusoes: r.resumo.exclusoes, alteracoes: r.resumo.alteracoes },
      conflitos: tela.conflitos,
      invalidas: tela.invalidas,
      choques: tela.choques,
      regras: tela.regras,
      totalConflitos: r.conflitos.length,
      totalInvalidas: r.invalidas.length,
      totalChoques: r.choques.length,
      totalRegras: r.regras.length,
      restantes: restantes,
      avisos: tela.avisos
    };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------ ocultar linhas vazias (RN-02, B20) */

/**
 * As linhas extras vazias da escala carregada (números de linha da planilha).
 * Só ocultar/mostrar: nenhuma linha é inserida ou apagada e a sincronia continua lendo a grade inteira.
 */
function linhasExtrasVaziasDaEscala_() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const aba = abaDaEscala_(ss, false);
  const m = aba ? lerMatrizAtual_(aba, tz) : null;
  if (!m) return { aba: aba, m: null, linhas: [] };
  const idx = linhasExtrasVazias_(m.linhas, m.celulas);
  return { aba: aba, m: m, linhas: idx.map(function (i) { return CONFIG.PRIMEIRA_LINHA + i; }) };
}

/** Estado do botão: há escala? quantas linhas dá para ocultar? já estão ocultas? */
function painelLinhasEstado() {
  const x = linhasExtrasVaziasDaEscala_();
  return {
    temEscala: !!x.m,
    qtd: x.linhas.length,
    ocultas: x.linhas.length > 0 && x.aba.isRowHiddenByUser(x.linhas[0])
  };
}

/** Alterna: se as linhas vazias estão ocultas, mostra todas as linhas da grade; senão oculta as extras vazias. */
function painelLinhasAlternar() {
  const x = linhasExtrasVaziasDaEscala_();
  if (!x.m) throw new Error('Não há escala carregada. Carregue a escala do mês primeiro.');
  const ocultas = x.linhas.length > 0 && x.aba.isRowHiddenByUser(x.linhas[0]);
  if (ocultas) {
    x.aba.showRows(CONFIG.PRIMEIRA_LINHA, x.m.celulas.length);
  } else {
    faixasParaApagar_(x.linhas).forEach(function (f) { x.aba.hideRows(f.inicio, f.qtd); });
  }
  SpreadsheetApp.flush();
  return painelLinhasEstado();
}

/* ------------------------------------------------------------ gravação */

function colunasAlocacoes_(aba) {
  const nCols = aba.getLastColumn();
  const cab = aba.getRange(1, 1, 1, nCols).getValues()[0].map(normalizar_);
  const col = function (rotulo) {
    const i = cab.indexOf(normalizar_(rotulo));
    if (i < 0) throw new Error('Não achei a coluna "' + rotulo + '" na aba "' + CONFIG.ABA_ALOCACOES + '".');
    return i;
  };
  return { nCols: nCols, cServ: col('SERVIÇO'), cFunc: cab.indexOf(normalizar_('FUNÇÃO')), cUni: cab.indexOf(normalizar_('UNIDADE')) };
}

/** Apaga as linhas que saíram e acrescenta as novas. Nessa ordem: os números de linha ainda valem. */
function aplicarSincronizacao_(res, tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_ALOCACOES);
  if (!aba) throw new Error('Aba não encontrada: "' + CONFIG.ABA_ALOCACOES + '".');

  // 1. exclusões (inclui a linha antiga de cada troca): de baixo para cima, em faixas contíguas
  if (res.remover.length) {
    const linhas = [];
    res.remover.forEach(function (r) { r.linhas.forEach(function (l) { linhas.push(l); }); });
    faixasParaApagar_(linhas).forEach(function (f) { aba.deleteRows(f.inicio, f.qtd); });
  }

  // 2. inclusões (inclui a linha nova de cada troca): no fim da tabela
  if (res.inserir.length) gravarAlocacoes_(res.inserir, tz);
}
