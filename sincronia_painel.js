/**
 * PAINEL MOSTRAR ESCALA — camada do Google Sheets da sincronia planilha da escala -> tabela.
 * Depende de nucleo.gs, matriz.gs, pre_escala.gs (painelDados, validarEntrada_) e sincronia.gs.
 * Tela: sidebar_matriz.html (crie como "HTML" com esse nome exato).
 *
 * A "cópia de referência" da matriz fica numa aba oculta (_BASE_MATRIZ):
 * é gravada quando a matriz é montada e atualizada a cada salvamento.
 */

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
  const linhas = [['MATRÍCULA', 'DIA', 'TURNO', 'SERVIÇO']].concat(alocs.map(function (a) { return [a.mat, a.dia, a.turno, a.servico]; }));
  if (aba.getMaxRows() < linhas.length) aba.insertRowsAfter(aba.getMaxRows(), linhas.length - aba.getMaxRows());
  aba.getRange(1, 1, linhas.length, 4).setNumberFormat('@').setValues(linhas);
  aba.hideSheet();
}

/** null se a aba não existe (matriz montada antes desta versão). */
function lerBase_(tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(ABA_BASE_);
  if (!aba) return null;
  const v = aba.getDataRange().getValues();
  if (v.length < 1 || normalizar_(v[0][0]) !== 'MATRICULA') return null;
  return v.slice(1).filter(function (r) { return texto_(r[0]) !== ''; }).map(function (r) {
    return { mat: texto_(r[0]), dia: diaComoTexto_(r[1], tz), turno: texto_(r[2]), servico: texto_(r[3]) };
  });
}

/** Chamada por montarMatriz() logo depois de desenhar: a matriz recém-montada vira a referência. */
function registrarBase_(aba, tz) {
  const m = lerMatrizAtual_(aba, tz);
  if (!m) return;
  salvarBase_(desmontarMatriz_(m.linhas, m.dias, m.celulas).alocs);
}

/* ------------------------------------------------------------ análise */

function analisarSincronia_(tz) {
  const ss = SpreadsheetApp.getActive();
  const aba = abaDaEscala_(ss, false);
  const m = aba ? lerMatrizAtual_(aba, tz) : null;
  if (!m) throw new Error('Não há escala carregada. Carregue a escala do mês primeiro.');
  const base = lerBase_(tz);
  if (!base) throw new Error('Esta escala não tem referência salva (foi carregada antes desta versão). Carregue a escala do mês de novo.');

  const rep = linhasRepetidas_(m.linhas);
  if (rep.length) {
    throw new Error('A escala tem linhas repetidas para o mesmo militar e turno (' +
      rep.slice(0, 3).map(function (k) { return k.replace('|', ' turno '); }).join('; ') + (rep.length > 3 ? '…' : '') +
      '). Apague a linha repetida e tente de novo.');
  }

  const desm = desmontarMatriz_(m.linhas, m.dias, m.celulas);
  const dias = {};
  m.dias.forEach(function (d) { if (d) dias[d] = true; });
  const todas = lerAlocacoes_(tz).alocs;                     // todos os meses: o dia 31 precisa enxergar o dia 01
  const tabela = todas.filter(function (a) { return dias[a.dia]; });
  const hor = lerHorarios_();
  const res = calcularSincronizacao_(base, desm.alocs, tabela, lerCatalogo_().pares, { horarios: hor.porChave, todas: alocsComExpediente_(todas, hor, tz) });
  return { res: res, base: base, matriz: desm.alocs, orfas: desm.orfas, dias: m.dias, avisosTurnos: hor.avisos };
}

function nomesPorMatricula_() {
  const mapa = {};
  lerMilitares_().forEach(function (x) { if (!(x.mat in mapa)) mapa[x.mat] = [x.posto, x.nome].filter(Boolean).join(' '); });
  return mapa;
}

function formatarItem_(i, nomes) {
  return {
    tipo: i.tipo,
    nome: nomes[i.mat] || ('matrícula ' + i.mat),
    dia: i.dia.slice(8) + '/' + i.dia.slice(5, 7),
    turno: i.turno,
    de: i.de || '',
    para: i.para || '',
    tabela: i.tabela || '',
    choca: (i.com || []).map(function (c) {
      const d = c.dia.slice(8) + '/' + c.dia.slice(5, 7);
      if (c.tipo === 'emenda') return 'emenda proibida: JES seguido de Pronto (' + c.servico + ' ' + c.turno + ' em ' + d + ')';
      if (c.implicito) return 'choca com o expediente do Adm em ' + d + ' (' + horasTexto_(c.minutos) + ' h)';
      return 'choca com ' + c.servico + ' ' + c.turno + ' em ' + d + ' (' + horasTexto_(c.minutos) + ' h)';
    }).join('; ')
  };
}

const LIMITE_LISTA_ = 40;

function resumoParaTela_(a, nomes) {
  const r = a.res;
  const aplicar = []
    .concat(r.inserir.map(function (x) { return { tipo: 'inclusao', mat: x.mat, dia: x.dia, turno: x.turno, de: '', para: x.servico }; }))
    .concat(r.atualizar.map(function (x) { const p = x.chave.split('|'); return { tipo: 'alteracao', mat: p[0], dia: p[1], turno: p[2], de: '', para: x.servico }; }))
    .concat(r.remover.map(function (x) { const p = x.chave.split('|'); return { tipo: 'exclusao', mat: p[0], dia: p[1], turno: p[2], de: '', para: '' }; }));
  // para exibir "de → para" nas alterações e exclusões, completa o "de" com a referência
  const B = mapaServicos_(a.base);
  aplicar.forEach(function (x) { if (x.tipo !== 'inclusao') x.de = B[x.mat + '|' + x.dia + '|' + x.turno] || ''; });
  const cortar = function (lista) { return lista.slice(0, LIMITE_LISTA_).map(function (i) { return formatarItem_(i, nomes); }); };
  const avisos = (a.avisosTurnos || []).slice();
  if (a.orfas) avisos.push(a.orfas + ' célula(s) preenchida(s) em linha sem matrícula, turno ou data foram ignoradas.');
  return {
    resumo: r.resumo,
    aplicar: cortar(aplicar),
    aplicarTotal: aplicar.length,
    conflitos: cortar(r.conflitos),
    invalidas: cortar(r.invalidas),
    choques: cortar(r.choques),
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
    const total = r.inserir.length + r.remover.length + r.atualizar.length;
    if (total > 0) {
      aplicarSincronizacao_(r, tz);
      SpreadsheetApp.flush();
    }
    // a referência avança nas chaves aplicadas (e nas que já estavam iguais na tabela)
    salvarBase_(novaBase_(a.base, a.matriz, r));
    SpreadsheetApp.flush();

    const depois = analisarSincronia_(tz).res;
    const restantes = depois.inserir.length + depois.remover.length + depois.atualizar.length;
    const tela = resumoParaTela_({ res: r, base: a.base, orfas: a.orfas, dias: a.dias, avisosTurnos: a.avisosTurnos }, nomes);
    return {
      gravadas: { inclusoes: r.inserir.length, exclusoes: r.remover.length, alteracoes: r.atualizar.length },
      conflitos: tela.conflitos,
      invalidas: tela.invalidas,
      choques: tela.choques,
      totalConflitos: r.conflitos.length,
      totalInvalidas: r.invalidas.length,
      totalChoques: r.choques.length,
      restantes: restantes,
      avisos: tela.avisos
    };
  } finally {
    lock.releaseLock();
  }
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

/** Atualiza serviço (limpando a função), apaga linhas e acrescenta as novas. Nessa ordem: os números de linha ainda valem. */
function aplicarSincronizacao_(res, tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_ALOCACOES);
  if (!aba) throw new Error('Aba não encontrada: "' + CONFIG.ABA_ALOCACOES + '".');
  const c = colunasAlocacoes_(aba);

  // 1. alterações: reescreve só o bloco de linhas afetado, nas colunas SERVIÇO e FUNÇÃO
  if (res.atualizar.length) {
    const linhas = [];
    res.atualizar.forEach(function (u) { u.linhas.forEach(function (l) { linhas.push(l); }); });
    const ini = Math.min.apply(null, linhas), fim = Math.max.apply(null, linhas), n = fim - ini + 1;
    const serv = aba.getRange(ini, c.cServ + 1, n, 1).getValues();
    const func = c.cFunc >= 0 ? aba.getRange(ini, c.cFunc + 1, n, 1).getValues() : null;
    const uni = c.cUni >= 0 ? aba.getRange(ini, c.cUni + 1, n, 1).getValues() : null;
    res.atualizar.forEach(function (u) {
      u.linhas.forEach(function (l) {
        serv[l - ini][0] = u.servico;
        if (func) func[l - ini][0] = '';
        if (uni) uni[l - ini][0] = '';            // mudou o serviço: o posto (função e unidade) deixa de valer
      });
    });
    aba.getRange(ini, c.cServ + 1, n, 1).setValues(serv);
    if (func) aba.getRange(ini, c.cFunc + 1, n, 1).setValues(func);
    if (uni) aba.getRange(ini, c.cUni + 1, n, 1).setValues(uni);
  }

  // 2. exclusões: de baixo para cima, em faixas contíguas
  if (res.remover.length) {
    const linhas = [];
    res.remover.forEach(function (r) { r.linhas.forEach(function (l) { linhas.push(l); }); });
    faixasParaApagar_(linhas).forEach(function (f) { aba.deleteRows(f.inicio, f.qtd); });
  }

  // 3. inclusões: no fim da tabela
  if (res.inserir.length) gravarAlocacoes_(res.inserir, tz);
}