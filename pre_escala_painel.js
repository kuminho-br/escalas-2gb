/**
 * PAINEL DA PRÉ-ESCALA — camada do Google Sheets (sidebar + leitura/gravação).
 * Depende de nucleo.gs, matriz.gs (CONFIG, leitores) e pre_escala.gs (lógica).
 * A tela é o arquivo sidebar_pre_escala.html (crie-o como "HTML" no editor,
 * com o nome exato: sidebar_pre_escala).
 *
 * O painel nunca confia no que o navegador manda: mês, seção e equipe são
 * validados aqui e a pré-escala é recalculada com os dados lidos NA HORA da
 * gravação, dentro de um bloqueio (LockService), para duas pessoas não
 * gravarem ao mesmo tempo.
 */

function abrirPainel() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_pre_escala').setTitle('Pré-escala');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ------------------------------------------------------------ validação */

function validarEntrada_(mes, secao, equipe) {
  mes = String(mes || '').trim();
  secao = String(secao || '').trim();
  equipe = String(equipe || '').trim().toUpperCase();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: use o formato aaaa-mm.');
  if (!secao || secao.length > 40) throw new Error('Informe a seção (por exemplo, 1ª SB).');
  if (equipe && CICLO_EQUIPES_.indexOf(equipe) < 0) throw new Error('Equipe inválida.');
  return { mes: mes, secao: secao, equipe: equipe };
}

/* ------------------------------------------------------------ chamadas da tela */

/** Valores iniciais: o mês seguinte ao último mês que já tem alocações. */
function painelDados() {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const alocs = lerAlocacoes_(tz).alocs;
  let ultimo = '';
  alocs.forEach(function (a) { const m = a.dia.slice(0, 7); if (m > ultimo) ultimo = m; });
  return {
    mesSugerido: ultimo ? proximoMes_(ultimo) : Utilities.formatDate(new Date(), tz, 'yyyy-MM'),
    secao: valorParametro_('SECAO_PADRAO'),
    equipes: CICLO_EQUIPES_
  };
}

/** Lê tudo, detecta a equipe e simula a geração. Não grava nada. */
function analisar_(mes, secao, equipeManual, tz) {
  const alocs = lerAlocacoes_(tz).alocs;
  const militares = lerMilitares_();
  const deteccao = detectarEquipeInicial_(alocs, militares, { mes: mes, secao: secao });
  const equipe = equipeManual || deteccao.equipe;
  const out = { alocs: alocs, militares: militares, deteccao: deteccao, equipe: equipe, geracao: null };
  if (equipe) out.geracao = gerarPreEscala_(alocs, militares, { mes: mes, secao: secao, equipeDia1: equipe });
  return out;
}

/** Prévia para a tela (só dados simples, sem as listas completas). */
function painelPrevia(mes, secao, equipeManual) {
  const v = validarEntrada_(mes, secao, equipeManual);
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const r = analisar_(v.mes, v.secao, v.equipe, tz);
  return {
    mes: v.mes,
    secao: v.secao,
    equipe: r.equipe || '',
    manual: !!v.equipe,
    deteccao: r.deteccao,
    geracao: r.geracao ? { resumo: r.geracao.resumo, porEquipe: r.geracao.porEquipe, avisos: r.geracao.avisos } : null
  };
}

/** Grava a pré-escala na tabela de alocações e confere lendo de volta. */
function painelGerar(mes, secao, equipe) {
  const v = validarEntrada_(mes, secao, equipe);
  if (!v.equipe) throw new Error('Escolha a equipe do dia 01 antes de gerar.');
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const r = analisar_(v.mes, v.secao, v.equipe, tz);
    const novas = r.geracao.novas;
    if (novas.length === 0) return { gravadas: 0, pendentes: 0, mensagem: 'Nada a gravar: todas as vagas do Pronto já estão ocupadas.' };
    gravarAlocacoes_(novas, tz);
    SpreadsheetApp.flush();
    const depois = lerAlocacoes_(tz).alocs;
    const sobra = gerarPreEscala_(depois, r.militares, { mes: v.mes, secao: v.secao, equipeDia1: v.equipe });
    return {
      gravadas: novas.length,
      pendentes: sobra.novas.length,
      mensagem: novas.length + ' alocações gravadas em ' + CONFIG.ABA_ALOCACOES + '.'
    };
  } finally {
    lock.releaseLock();
  }
}

/** Carrega a escala do mês (usa as células B1/B2 da aba ESCALA DO MÊS, como o menu). */
function painelAbrirMatriz(mes, secao) {
  const v = validarEntrada_(mes, secao, '');
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const aba = abaDaEscala_(ss, true);
  aba.getRange(CONFIG.LINHA_MES, 2).setValue(Utilities.parseDate(v.mes + '-01', tz, 'yyyy-MM-dd')).setNumberFormat('mm/yyyy');
  aba.getRange(CONFIG.LINHA_SECAO, 2).setValue(v.secao);
  montarMatriz();
}

/* ------------------------------------------------------------ gravação */

/**
 * Acrescenta as alocações no fim da tabela, achando as colunas pelo cabeçalho.
 * O "fim" é a última linha com matrícula (e não getLastRow, que pode contar
 * formatação ou fórmulas soltas abaixo da tabela).
 */
function gravarAlocacoes_(novas, tz) {
  garantirSaldoSoDoAdm_(novas);                         // RN-03
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_ALOCACOES);
  if (!aba) throw new Error('Aba não encontrada: "' + CONFIG.ABA_ALOCACOES + '".');
  const nCols = aba.getLastColumn();
  const cab = aba.getRange(1, 1, 1, nCols).getValues()[0].map(normalizar_);
  const col = function (rotulo) {
    const i = cab.indexOf(normalizar_(rotulo));
    if (i < 0) throw new Error('Não achei a coluna "' + rotulo + '" na aba "' + CONFIG.ABA_ALOCACOES + '".');
    return i;
  };
  const cMat = col('MATRÍCULA'), cServ = col('SERVIÇO'), cData = col('DATA'), cTurno = col('TURNO');
  const cFunc = cab.indexOf(normalizar_('FUNÇÃO'));
  const cUni = cab.indexOf(normalizar_('UNIDADE'));

  const mats = aba.getRange(1, cMat + 1, aba.getMaxRows(), 1).getValues();
  let ultima = 1;
  for (let i = mats.length - 1; i >= 1; i--) { if (String(mats[i][0]).trim() !== '') { ultima = i + 1; break; } }
  const inicio = ultima + 1;
  const fim = inicio + novas.length - 1;
  if (fim > aba.getMaxRows()) aba.insertRowsAfter(aba.getMaxRows(), fim - aba.getMaxRows());

  const linhas = novas.map(function (a) {
    const l = [];
    for (let j = 0; j < nCols; j++) l.push('');
    l[cMat] = a.mat;
    l[cServ] = a.servico;
    l[cData] = Utilities.parseDate(a.dia, tz, 'yyyy-MM-dd');
    l[cTurno] = a.turno;
    if (cFunc >= 0) l[cFunc] = a.funcao || '';
    if (cUni >= 0) l[cUni] = a.unidade || '';
    return l;
  });
  aba.getRange(inicio, cMat + 1, novas.length, 1).setNumberFormat('@');
  aba.getRange(inicio, cData + 1, novas.length, 1).setNumberFormat('dd/MM/yyyy');
  aba.getRange(inicio, 1, novas.length, nCols).setValues(linhas);
}