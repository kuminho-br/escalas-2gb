/**
 * ESCALAS DE SERVIÇO — camada do Google Sheets das guarnições (postos/funções por escala).
 * Depende de nucleo.gs, matriz.gs, pre_escala.gs, pre_escala_painel.gs, sincronia.gs,
 * sincronia_painel.gs, choques.gs, choques_painel.gs e guarnicao.gs.
 * Tela: sidebar_guarnicao.html (crie como "HTML" com esse nome exato).
 *
 * Acesso: menu "Escalas - 2º GB" > "Escalas de Serviço".
 *
 * ABAS (você edita; o código só lê):
 *   ESCALAS               ESCALA | SERVIÇOS | TÍTULO | MILITARES | DIAS
 *   MODELOS DE GUARNIÇÃO  ESCALA | TURNO | UNIDADE | FUNÇÃO | VAGAS
 * ABAS GERADAS:
 *   GUARNIÇÃO       a grade de edição (uma escala e um mês por vez)
 *   IMPRESSÃO       o documento no formato das escalas oficiais, para exportar em PDF
 *   _BASE_GUARNICAO, _LISTA_MILITARES   (ocultas) referência da grade e lista do dropdown
 *
 * A função (e a unidade, se houver) de cada militar fica na própria linha da tabela
 * ALOCAÇÕES TABULADAS, nas colunas FUNÇÃO e UNIDADE. UNIDADE só é necessária se algum
 * modelo usar unidade (ex.: Pronto: ACO, Incêndio, APH, Salvamento).
 */

const GUARN_ABA = {
  GRADE: 'GUARNIÇÃO', IMPRESSAO: 'IMPRESSÃO', ESCALAS: 'ESCALAS', MODELOS: 'MODELOS DE GUARNIÇÃO',
  BASE: '_BASE_GUARNICAO', LISTA: '_LISTA_MILITARES'
};

// layout da aba GUARNIÇÃO
const GUARN_L = {
  ESCALA: 1, MES: 2, SERVICOS: 3, MILITARES: 4, CAB: 5, PRIMEIRA: 6,
  DATA: 1, DIA: 2, TURNO: 3, HORARIO: 4, UNIDADE: 5, FUNCAO: 6, MILITAR: 7, SERVICO: 8, OBS: 9, NCOLS: 9
};

// cabeçalho e assinatura do documento impresso: fixos da 1ª SB por enquanto (ajuste aqui se mudar);
// quando houver mais de uma SB, passam a depender da SB escolhida
const GUARN_CABECALHO_ = ['ESTADO DE PERNAMBUCO', 'SECRETARIA DE DEFESA SOCIAL', 'CORPO DE BOMBEIROS MILITAR DE PERNAMBUCO', '1ª SB / 2º GB - CARUARU', 'DINTER 1'];
const GUARN_ASSINATURA_ = ['José ANDERSON Torres Bezerra - 2º Ten QOC BM', 'Comandante da 1ª SB'];

// modelos de exemplo (as quatro escalas simples, como nos PDFs). O Pronto você configura depois.
const GUARN_EXEMPLO_ESCALAS_ = [
  ['ESCALA', 'SERVIÇOS', 'TÍTULO', 'MILITARES', 'DIAS'],
  ['Defensoria', 'Defensoria', 'ESCALA DEFENSORIA PÚBLICA CARUARU', 'TODOS', 'TODOS'],
  ['PE Seguro', 'PE Seguro', 'ESCALA OPERAÇÃO PERNAMBUCO SEGURO', 'TODOS', 'TODOS'],
  ['Bioma', 'Bioma', 'ESCALA OPERAÇÃO GUARDIÕES DO BIOMA', 'TODOS', 'TODOS'],
  ['CPRH', 'CPRH', 'ESCALA DE SERVIÇO CPRH', 'TODOS', 'SÓ ESCALADOS']
];
const GUARN_EXEMPLO_MODELOS_ = [
  ['ESCALA', 'TURNO', 'UNIDADE', 'FUNÇÃO', 'VAGAS'],
  ['Defensoria', 'TODOS', '', 'CHEFE', 1],
  ['Defensoria', 'TODOS', '', 'AUXILIAR', 1],
  ['PE Seguro', 'TODOS', '', 'MOTORISTA', 1],
  ['PE Seguro', 'TODOS', '', 'CHEFE', 1],
  ['PE Seguro', 'TODOS', '', 'SOCORRISTA', 2],
  ['Bioma', 'TODOS', '', 'MOTORISTA', 1],
  ['Bioma', 'TODOS', '', 'CHEFE', 1],
  ['Bioma', 'TODOS', '', 'COMBATENTE', 2],
  ['CPRH', 'TODOS', '', 'CHEFE', 1],
  ['CPRH', 'TODOS', '', 'MOTORISTA', 1],
  ['CPRH', 'TODOS', '', 'COMBATENTE', 1]
];

function abrirPainelGuarnicao() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_guarnicao').setTitle('Escalas de Serviço');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ------------------------------------------------------------ leitura dos modelos */

function lerModelosGuarnicao_() {
  const ss = SpreadsheetApp.getActive();
  const catal = lerAba_(CONFIG.ABA_TURNOS);
  const cS = coluna_(catal, 'SERVIÇO', true), cT = coluna_(catal, 'TURNO', true);
  const turnosPorServico = Object.create(null);
  catal.linhas.forEach(function (l) {
    const s = texto_(l[cS]), t = texto_(l[cT]);
    if (!s || !t) return;
    if (!turnosPorServico[s]) turnosPorServico[s] = [];
    if (turnosPorServico[s].indexOf(t) < 0) turnosPorServico[s].push(t);
  });

  if (!ss.getSheetByName(GUARN_ABA.ESCALAS) || !ss.getSheetByName(GUARN_ABA.MODELOS)) {
    return { escalas: {}, ordem: [], avisos: [], semAbas: true };
  }
  const tE = lerAba_(GUARN_ABA.ESCALAS), tM = lerAba_(GUARN_ABA.MODELOS);
  const e = { escala: coluna_(tE, 'ESCALA', true), servicos: coluna_(tE, 'SERVIÇOS', false), titulo: coluna_(tE, 'TÍTULO', false), militares: coluna_(tE, 'MILITARES', false), dias: coluna_(tE, 'DIAS', false) };
  const m = { escala: coluna_(tM, 'ESCALA', true), turno: coluna_(tM, 'TURNO', false), unidade: coluna_(tM, 'UNIDADE', false), funcao: coluna_(tM, 'FUNÇÃO', true), vagas: coluna_(tM, 'VAGAS', false) };
  const pega = function (l, i) { return i < 0 ? '' : l[i]; };
  const mod = montarModelosGuarnicao_(
    tE.linhas.map(function (l) { return { escala: l[e.escala], servicos: pega(l, e.servicos), titulo: pega(l, e.titulo), militares: pega(l, e.militares), dias: pega(l, e.dias) }; }),
    tM.linhas.map(function (l) { return { escala: l[m.escala], turno: pega(l, m.turno), unidade: pega(l, m.unidade), funcao: l[m.funcao], vagas: pega(l, m.vagas) }; }),
    turnosPorServico
  );
  mod.semAbas = false;
  return mod;
}

/** Cabeçalho da tabela de alocações: confere se as colunas que a escala precisa existem. */
function exigirColunasAlocacoes_(esc) {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_ALOCACOES);
  if (!aba) throw new Error('Aba não encontrada: "' + CONFIG.ABA_ALOCACOES + '".');
  const cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(normalizar_);
  if (cab.indexOf(normalizar_('FUNÇÃO')) < 0) throw new Error('Não achei a coluna "FUNÇÃO" na aba "' + CONFIG.ABA_ALOCACOES + '".');
  if (esc.usaUnidade && cab.indexOf(normalizar_('UNIDADE')) < 0) {
    throw new Error('O modelo da escala "' + esc.nome + '" usa UNIDADE. Adicione uma coluna chamada UNIDADE (pode ficar vazia) na aba "' + CONFIG.ABA_ALOCACOES + '" e tente de novo.');
  }
}

/* ------------------------------------------------------------ meta e referência */

function lerMetaGrade_() {
  const aba = SpreadsheetApp.getActive().getSheetByName(GUARN_ABA.GRADE);
  if (!aba) return null;
  const escala = texto_(aba.getRange(GUARN_L.ESCALA, 2).getValue());
  const v = aba.getRange(GUARN_L.MES, 2).getValue();
  let mes = '';
  if (ehData_(v)) mes = Utilities.formatDate(v, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM');
  else if (/^\d{4}-\d{2}$/.test(texto_(v))) mes = texto_(v);
  if (!escala || !mes) return null;
  return { escala: escala, mes: mes };
}

function salvarBaseGuarnicao_(meta, base) {
  const ss = SpreadsheetApp.getActive();
  const aba = ss.getSheetByName(GUARN_ABA.BASE) || ss.insertSheet(GUARN_ABA.BASE);
  aba.clearContents();
  const linhas = [['ESCALA', meta.escala, 'MÊS', meta.mes], ['MATRÍCULA', 'DIA', 'TURNO', 'SERVIÇO', 'FUNÇÃO', 'UNIDADE', 'FORA']]
    .concat(base.map(function (a) { return [a.mat, a.dia, a.turno, a.servico, a.funcao || '', a.unidade || '', a.fora ? '1' : '']; }));
  const nCols = 7;
  linhas.forEach(function (l) { while (l.length < nCols) l.push(''); });
  if (aba.getMaxRows() < linhas.length) aba.insertRowsAfter(aba.getMaxRows(), linhas.length - aba.getMaxRows());
  aba.getRange(1, 1, linhas.length, nCols).setNumberFormat('@').setValues(linhas);
  aba.hideSheet();
}

/** null se não existe ou se é de outra escala/mês. */
function lerBaseGuarnicao_(meta, tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(GUARN_ABA.BASE);
  if (!aba) return null;
  const v = aba.getDataRange().getValues();
  if (v.length < 2 || texto_(v[0][1]) !== meta.escala || texto_(v[0][3]) !== meta.mes) return null;
  return v.slice(2).filter(function (r) { return texto_(r[0]) !== ''; }).map(function (r) {
    return { mat: texto_(r[0]), dia: diaComoTexto_(r[1], tz), turno: texto_(r[2]), servico: texto_(r[3]), funcao: texto_(r[4]), unidade: texto_(r[5]), fora: texto_(r[6]) === '1' };
  });
}

/** A grade como está agora na planilha. */
function lerGrade_(aba, tz) {
  const ultima = aba.getLastRow();
  if (ultima < GUARN_L.PRIMEIRA) return [];
  const v = aba.getRange(GUARN_L.PRIMEIRA, 1, ultima - GUARN_L.PRIMEIRA + 1, GUARN_L.NCOLS).getValues();
  const out = [];
  v.forEach(function (r, i) {
    const dia = diaComoTexto_(r[GUARN_L.DATA - 1], tz), turno = texto_(r[GUARN_L.TURNO - 1]), funcao = texto_(r[GUARN_L.FUNCAO - 1]);
    if (!dia || !turno || !funcao) return;
    const txt = texto_(r[GUARN_L.MILITAR - 1]);
    out.push({ linha: GUARN_L.PRIMEIRA + i, dia: dia, turno: turno, unidade: texto_(r[GUARN_L.UNIDADE - 1]), funcao: funcao, texto: txt, mat: matriculaDoRotulo_(txt) });
  });
  return out;
}

/* ------------------------------------------------------------ análise */

function analisarGuarnicao_(tz) {
  const ss = SpreadsheetApp.getActive();
  const aba = ss.getSheetByName(GUARN_ABA.GRADE);
  const meta = aba ? lerMetaGrade_() : null;
  if (!meta) throw new Error('Não há grade montada. Escolha a escala e o mês e clique em "Montar grade".');
  const mod = lerModelosGuarnicao_();
  const esc = mod.escalas[meta.escala];
  if (!esc) throw new Error('A escala "' + meta.escala + '" não existe mais nas abas ESCALAS e MODELOS DE GUARNIÇÃO. Monte a grade de novo.');
  exigirColunasAlocacoes_(esc);
  const base = lerBaseGuarnicao_(meta, tz);
  if (!base) throw new Error('A grade não tem referência salva (ou é de outra escala/mês). Monte a grade de novo.');

  const grade = lerGrade_(aba, tz);
  const todas = lerAlocacoes_(tz).alocs;
  const tabelaMes = todas.filter(function (a) { return a.dia.slice(0, 7) === meta.mes; });
  const mil = lerMilitares_();
  const hor = lerHorarios_();
  let motoristas = null;
  if (mil.length && mil[0].temColunaMotorista) {
    motoristas = Object.create(null);
    mil.forEach(function (m) { if (m.motorista) motoristas[m.mat] = true; });
  }
  const res = calcularGuarnicao_(base, grade, tabelaMes, esc, { horarios: hor.porChave, todas: todas, motoristas: motoristas });
  const atual = montarGrade_(esc, meta.mes, todas);
  return { res: res, esc: esc, meta: meta, base: base, atual: atual, avisos: mod.avisos.concat(hor.avisos) };
}

const LIMITE_LISTA_G_ = 40;

function dm_(dia) { return dia.slice(8) + '/' + dia.slice(5, 7); }

function textoItemG_(i, tipo) {
  const posto = (i.funcao || 'sem função') + (i.unidade ? ' / ' + i.unidade : '');
  if (tipo === 'conflito') return posto + ' · a tabela mudou: ' + i.tabela;
  if (tipo === 'invalida') {
    if (i.motivo === 'duplicado') return 'aparece em dois postos no mesmo turno (' + i.funcao + ')';
    if (i.motivo === 'nao-escalado') return 'não está escalado neste serviço e turno (' + posto + '). Escale o militar antes.';
    return 'célula do militar ilegível: "' + i.texto + '". Escolha um nome da lista.';
  }
  if (tipo === 'choque') {
    return 'entrar em ' + posto + ' choca com ' + (i.com || []).map(function (c) {
      return c.servico + ' ' + c.turno + ' em ' + dm_(c.dia) + ' (' + horasTexto_(c.minutos) + ' h)';
    }).join('; ');
  }
  return posto;
}

function formatarItemG_(i, nomes, tipo) {
  return {
    nome: i.mat ? (nomes[i.mat] || ('matrícula ' + i.mat)) : '(célula sem matrícula)',
    dia: i.dia ? dm_(i.dia) : '',
    turno: i.turno || '',
    texto: textoItemG_(i, tipo)
  };
}

function resumoParaTelaG_(a, nomes) {
  const r = a.res, B = Object.create(null);
  a.base.forEach(function (x) { B[chaveBloco_(x)] = x; });
  const aplicar = [];
  r.inserir.forEach(function (x) { aplicar.push({ tipo: 'inclusao', mat: x.mat, dia: x.dia, turno: x.turno, texto: 'entra como ' + x.funcao + (x.unidade ? ' / ' + x.unidade : '') + ' (' + x.servico + ')' }); });
  r.atualizar.forEach(function (x) {
    const p = x.chave.split('|'), b = B[x.chave];
    aplicar.push({ tipo: 'funcao', mat: p[0], dia: p[1], turno: p[2], texto: ((b && b.funcao) || 'sem função') + ' → ' + (x.funcao || 'sem função') + (x.unidade ? ' / ' + x.unidade : '') });
  });
  r.remover.forEach(function (x) {
    const p = x.chave.split('|'), b = B[x.chave];
    aplicar.push({ tipo: 'exclusao', mat: p[0], dia: p[1], turno: p[2], texto: 'sai de ' + ((b && b.funcao) || 'escala') });
  });
  const cortar = function (lista, tipo) { return lista.slice(0, LIMITE_LISTA_G_).map(function (i) { return Object.assign(formatarItemG_(i, nomes, tipo), { tipo: i.tipo || tipo }); }); };
  const aplicarFmt = aplicar.slice(0, LIMITE_LISTA_G_).map(function (i) {
    return { tipo: i.tipo, nome: nomes[i.mat] || ('matrícula ' + i.mat), dia: dm_(i.dia), turno: i.turno, texto: i.texto };
  });
  const avisosMot = r.avisosMotorista.slice(0, 10).map(function (x) {
    return (nomes[x.mat] || x.mat) + ' em ' + x.funcao + ' (' + dm_(x.dia) + ' ' + x.turno + ') não está marcado como motorista na aba MILITARES.';
  });
  if (r.avisosMotorista.length > 10) avisosMot.push('e mais ' + (r.avisosMotorista.length - 10) + ' aviso(s) de motorista.');
  return {
    escala: a.meta.escala,
    mes: a.meta.mes,
    resumo: r.resumo,
    aplicar: aplicarFmt,
    aplicarTotal: aplicar.length,
    conflitos: cortar(r.conflitos, 'conflito'),
    invalidas: cortar(r.invalidas, 'invalida'),
    choques: cortar(r.choques, 'choque'),
    avisosMotorista: avisosMot,
    avisos: a.avisos.concat(a.atual.avisos),
    situacao: { vagas: a.atual.vagas, preenchidas: a.atual.preenchidas, semFuncao: a.atual.escaladosSemFuncao }
  };
}

/* ------------------------------------------------------------ chamadas da tela */

function painelDadosGuarnicao() {
  const mod = lerModelosGuarnicao_();
  const meta = lerMetaGrade_();
  let ultimo = '';                                    // sem grade montada, sugere o último mês que tem alocações
  lerAlocacoes_(SpreadsheetApp.getActive().getSpreadsheetTimeZone()).alocs.forEach(function (a) { const m = a.dia.slice(0, 7); if (m > ultimo) ultimo = m; });
  return {
    semAbas: !!mod.semAbas,
    escalas: mod.ordem.map(function (n) {
      const e = mod.escalas[n];
      return { nome: n, servicos: e.servicos.join(', '), militares: e.militares, turnos: e.turnos.length, usaUnidade: e.usaUnidade };
    }),
    avisos: mod.avisos,
    escalaAtual: meta ? meta.escala : '',
    mesSugerido: meta ? meta.mes : ultimo
  };
}

/** Cria as abas ESCALAS e MODELOS DE GUARNIÇÃO com os exemplos, sem sobrescrever nada que já exista. */
function painelGuarnicaoExemplos() {
  const ss = SpreadsheetApp.getActive();
  const criadas = [];
  [[GUARN_ABA.ESCALAS, GUARN_EXEMPLO_ESCALAS_, 5], [GUARN_ABA.MODELOS, GUARN_EXEMPLO_MODELOS_, 5]].forEach(function (x) {
    if (ss.getSheetByName(x[0])) return;
    const aba = ss.insertSheet(x[0]);
    aba.getRange(1, 1, x[1].length, x[2]).setValues(x[1]);
    aba.getRange(1, 1, 1, x[2]).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    criadas.push(x[0]);
  });
  return { criadas: criadas };
}

function painelGuarnicaoMontar(escala, mes) {
  mes = String(mes == null ? '' : mes).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const mod = lerModelosGuarnicao_();
  const esc = mod.escalas[escala];
  if (!esc) throw new Error('Escolha uma escala da lista (ela precisa estar nas abas ESCALAS e MODELOS DE GUARNIÇÃO).');
  exigirColunasAlocacoes_(esc);

  // não apaga edições ainda não salvas sem perguntar
  if (lerMetaGrade_()) {
    let pendentes = 0;
    try { const a = analisarGuarnicao_(tz); pendentes = a.res.inserir.length + a.res.atualizar.length + a.res.remover.length; } catch (e) { pendentes = 0; }
    if (pendentes > 0) {
      const ui = SpreadsheetApp.getUi();
      const r = ui.alert('Escalas de Serviço', 'A grade atual tem ' + pendentes + ' alteração(ões) ainda não salva(s). Montar de novo apaga essas edições. Continuar?', ui.ButtonSet.YES_NO);
      if (r !== ui.Button.YES) return { cancelado: true };
    }
  }

  const todas = lerAlocacoes_(tz).alocs;
  const grade = montarGrade_(esc, mes, todas);
  const mil = lerMilitares_();
  const hor = lerHorarios_();
  renderizarGrade_(esc, mes, grade, todas, mil, hor, tz);
  salvarBaseGuarnicao_({ escala: esc.nome, mes: mes }, grade.base);
  SpreadsheetApp.flush();
  return { ok: true, vagas: grade.vagas, preenchidas: grade.preenchidas, semFuncao: grade.escaladosSemFuncao };
}

function painelGuarnicaoPrevia() {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return resumoParaTelaG_(analisarGuarnicao_(tz), nomesPorMatricula_());
}

function painelGuarnicaoSalvar() {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const a = analisarGuarnicao_(tz);                       // relê tudo agora, dentro do bloqueio
    const r = a.res;
    const total = r.inserir.length + r.remover.length + r.atualizar.length;
    if (total > 0) {
      aplicarGuarnicao_(r, tz);
      SpreadsheetApp.flush();
    }
    salvarBaseGuarnicao_(a.meta, novaBaseGuarnicao_(a.base, r));
    SpreadsheetApp.flush();

    const depois = analisarGuarnicao_(tz).res;
    const restantes = depois.inserir.length + depois.remover.length + depois.atualizar.length;
    return {
      gravadas: { inclusoes: r.inserir.length, funcoes: r.atualizar.length, exclusoes: r.remover.length },
      totalConflitos: r.conflitos.length,
      totalInvalidas: r.invalidas.length,
      totalChoques: r.choques.length,
      restantes: restantes
    };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------ gravação na tabela */

/** Atualiza função e unidade, apaga linhas e acrescenta as novas. Nessa ordem: os números de linha ainda valem. */
function aplicarGuarnicao_(res, tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_ALOCACOES);
  if (!aba) throw new Error('Aba não encontrada: "' + CONFIG.ABA_ALOCACOES + '".');
  const c = colunasAlocacoes_(aba);
  if (c.cFunc < 0) throw new Error('Não achei a coluna "FUNÇÃO" na aba "' + CONFIG.ABA_ALOCACOES + '".');

  if (res.atualizar.length) {
    const linhas = [];
    res.atualizar.forEach(function (u) { u.linhas.forEach(function (l) { linhas.push(l); }); });
    const ini = Math.min.apply(null, linhas), fim = Math.max.apply(null, linhas), n = fim - ini + 1;
    const func = aba.getRange(ini, c.cFunc + 1, n, 1).getValues();
    const uni = c.cUni >= 0 ? aba.getRange(ini, c.cUni + 1, n, 1).getValues() : null;
    res.atualizar.forEach(function (u) {
      u.linhas.forEach(function (l) {
        func[l - ini][0] = u.funcao;
        if (uni) uni[l - ini][0] = u.unidade;
      });
    });
    aba.getRange(ini, c.cFunc + 1, n, 1).setValues(func);
    if (uni) aba.getRange(ini, c.cUni + 1, n, 1).setValues(uni);
  }

  if (res.remover.length) {
    const linhas = [];
    res.remover.forEach(function (r) { r.linhas.forEach(function (l) { linhas.push(l); }); });
    faixasParaApagar_(linhas).forEach(function (f) { aba.deleteRows(f.inicio, f.qtd); });
  }

  if (res.inserir.length) gravarAlocacoes_(res.inserir, tz);
}

/* ------------------------------------------------------------ a grade na planilha */

function renderizarGrade_(esc, mes, grade, todas, mil, hor, tz) {
  const ss = SpreadsheetApp.getActive();
  const aba = ss.getSheetByName(GUARN_ABA.GRADE) || ss.insertSheet(GUARN_ABA.GRADE);
  const L = GUARN_L;
  aba.clear();
  aba.clearConditionalFormatRules();
  aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).clearDataValidations().clearNote();

  const milPorMat = Object.create(null);
  mil.forEach(function (m) { if (!(m.mat in milPorMat)) milPorMat[m.mat] = m; });
  const rotulo = function (mat) { return rotuloMilitar_(milPorMat[mat], mat); };

  // horário de cada turno (do primeiro serviço da escala que o tenha)
  const horarioTurno = Object.create(null);
  esc.turnos.forEach(function (t) {
    let h = null;
    esc.servicos.some(function (s) { h = hor.porChave[s + '|' + t] || null; return !!h; });
    horarioTurno[t] = h ? horarioCurto_(h.ini) + '–' + horarioCurto_(h.fim) : '';
  });

  // quem está escalado em cada dia e turno (para o dropdown de escalas só com "ESCALADOS")
  const escaladosNoBloco = Object.create(null);
  todas.forEach(function (a) {
    if (esc.servicos.indexOf(a.servico) < 0 || a.dia.slice(0, 7) !== mes) return;
    const k = a.dia + '|' + a.turno;
    if (!escaladosNoBloco[k]) escaladosNoBloco[k] = [];
    if (escaladosNoBloco[k].indexOf(a.mat) < 0) escaladosNoBloco[k].push(a.mat);
  });

  // metadados e cabeçalho
  aba.getRange(1, 1, 4, 2).setValues([['ESCALA', esc.nome], ['MÊS', ''], ['SERVIÇOS', esc.servicos.join(', ')], ['MILITARES', esc.militares === 'TODOS' ? 'TODOS (preencher o posto cria a alocação)' : 'ESCALADOS (só quem já está escalado)']]);
  aba.getRange(L.MES, 2).setNumberFormat('@').setValue(mes);
  aba.getRange(1, 1, 4, 1).setFontWeight('bold');
  const cab = ['DATA', 'DIA', 'TURNO', 'HORÁRIO', 'UNIDADE', 'FUNÇÃO', 'MILITAR', 'SERVIÇO', 'SEM FUNÇÃO NESTE TURNO'];
  aba.getRange(L.CAB, 1, 1, L.NCOLS).setValues([cab]).setBackground('#2F5D50').setFontColor('#FFFFFF').setFontWeight('bold');

  // linhas
  const n = grade.linhas.length;
  const rows = [], regras = [];
  const listaGeral = listaDeMilitares_(mil);
  let regraGeral = null;
  if (esc.militares === 'TODOS') {
    regraGeral = SpreadsheetApp.newDataValidation().requireValueInRange(listaGeral, true).setAllowInvalid(false).build();
  }
  const regraPorBloco = Object.create(null);
  let anterior = '';
  grade.linhas.forEach(function (l) {
    const bloco = l.dia + '|' + l.turno;
    let obs = '';
    if (bloco !== anterior && grade.semFuncao[bloco]) {
      obs = grade.semFuncao[bloco].map(function (x) {
        const m = milPorMat[x.mat];
        return (m ? m.nome : x.mat) + (x.funcao ? ' (' + x.funcao + ' fora do modelo)' : '');
      }).join(', ');
    }
    anterior = bloco;
    rows.push([Utilities.parseDate(l.dia, tz, 'yyyy-MM-dd'), GUARN_DIAS_SEMANA_[diaDaSemana_(l.dia)], l.turno, horarioTurno[l.turno], l.unidade, l.funcao, l.mat ? rotulo(l.mat) : '', l.servico, obs]);

    if (esc.militares === 'TODOS') regras.push([regraGeral]);
    else {
      if (!(bloco in regraPorBloco)) {
        const lista = (escaladosNoBloco[bloco] || []).map(rotulo).sort();
        regraPorBloco[bloco] = lista.length ? SpreadsheetApp.newDataValidation().requireValueInList(lista, true).setAllowInvalid(false).build() : null;
      }
      regras.push([regraPorBloco[bloco]]);
    }
  });

  if (n > 0) {
    const r0 = L.PRIMEIRA;
    aba.getRange(r0, 1, n, L.NCOLS).setValues(rows);
    aba.getRange(r0, L.DATA, n, 1).setNumberFormat('dd/MM/yyyy');
    aba.getRange(r0, L.MILITAR, n, 1).setDataValidations(regras);
    aba.getRange(r0, L.OBS, n, 1).setFontColor('#B31412');

    // fim de semana em cinza e uma linha grossa entre os dias
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && grade.linhas[j + 1].dia === grade.linhas[i].dia) j++;
      const dow = diaDaSemana_(grade.linhas[i].dia);
      if (dow === 0 || dow === 6) aba.getRange(r0 + i, L.DATA, j - i + 1, L.FUNCAO).setBackground('#F1F3F4');
      aba.getRange(r0 + i, 1, 1, L.NCOLS).setBorder(true, false, false, false, false, false, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
      i = j + 1;
    }

    // cores do serviço (como na matriz) e vagas vazias em destaque
    const faixaServ = aba.getRange(r0, L.SERVICO, n, 1), faixaMil = aba.getRange(r0, L.MILITAR, n, 1);
    const cf = esc.servicos.filter(function (s) { return CONFIG.CORES[s]; }).map(function (s) {
      return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s).setBackground(CONFIG.CORES[s][0]).setFontColor(CONFIG.CORES[s][1]).setRanges([faixaServ]).build();
    });
    cf.push(SpreadsheetApp.newConditionalFormatRule().whenCellEmpty().setBackground('#FFF4D6').setRanges([faixaMil]).build());
    aba.setConditionalFormatRules(cf);
  }

  [90, 100, 60, 90, 170, 190, 230, 90, 300].forEach(function (w, k) { aba.setColumnWidth(k + 1, w); });
  aba.setFrozenRows(L.CAB);
  ss.setActiveSheet(aba);
}

/** Lista de todos os militares (hoje: qualquer seção) numa aba oculta, para o dropdown das escalas "TODOS". */
function listaDeMilitares_(mil) {
  const ss = SpreadsheetApp.getActive();
  const aba = ss.getSheetByName(GUARN_ABA.LISTA) || ss.insertSheet(GUARN_ABA.LISTA);
  aba.clearContents();
  const rotulos = mil.map(function (m) { return rotuloMilitar_(m, m.mat); }).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  const lista = rotulos.length ? rotulos : ['(sem militares)'];
  if (aba.getMaxRows() < lista.length) aba.insertRowsAfter(aba.getMaxRows(), lista.length - aba.getMaxRows());
  aba.getRange(1, 1, lista.length, 1).setValues(lista.map(function (x) { return [x]; }));
  aba.hideSheet();
  return aba.getRange(1, 1, lista.length, 1);
}

/* ------------------------------------------------------------ impressão */

/** Gera o documento da escala (aba IMPRESSÃO) a partir do que está GRAVADO na tabela. */
function painelGuarnicaoImprimir(escala, mes) {
  mes = String(mes == null ? '' : mes).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const mod = lerModelosGuarnicao_();
  const esc = mod.escalas[escala];
  if (!esc) throw new Error('Escolha uma escala da lista.');
  exigirColunasAlocacoes_(esc);

  const grade = montarGrade_(esc, mes, lerAlocacoes_(tz).alocs);
  const mil = {};
  lerMilitares_().forEach(function (m) { if (!(m.mat in mil)) mil[m.mat] = m; });
  const hor = lerHorarios_();
  const linhas = linhasParaImpressao_(grade, esc, mil, hor.porChave);

  // alterações da grade ainda não salvas não entram no documento: avisa
  let pendentes = 0;
  const meta = lerMetaGrade_();
  if (meta && meta.escala === esc.nome && meta.mes === mes) {
    try { const a = analisarGuarnicao_(tz); pendentes = a.res.inserir.length + a.res.atualizar.length + a.res.remover.length; } catch (e) { pendentes = 0; }
  }

  const aba = ss.getSheetByName(GUARN_ABA.IMPRESSAO) || ss.insertSheet(GUARN_ABA.IMPRESSAO);
  aba.clear();
  aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).breakApart();

  const comUni = esc.usaUnidade;
  const cab = comUni ? ['DATA', 'DIA', 'TURNO', 'UNIDADE', 'FUNÇÃO', 'GRADUAÇÃO', 'NOME', 'MATRÍCULA'] : ['DATA', 'DIA', 'TURNO', 'FUNÇÃO', 'GRADUAÇÃO', 'NOME', 'MATRÍCULA'];
  const nCols = cab.length;
  const larguras = comUni ? [90, 100, 150, 150, 190, 90, 150, 90] : [90, 100, 150, 190, 90, 150, 90];
  const corpo = linhas.map(function (l) {
    const r = [formatarDia_(l.dia), l.semana, l.turno];
    if (comUni) r.push(l.unidade);
    return r.concat([l.funcao, l.grad, l.nome, l.mat]);
  });

  // textos centralizados (cabeçalho oficial e título)
  const topo = GUARN_CABECALHO_.concat(['', esc.titulo + ' - ' + mesPorExtenso_(mes)]);
  topo.forEach(function (t, i) {
    const r = aba.getRange(i + 1, 1, 1, nCols);
    r.merge().setValue(t).setHorizontalAlignment('center').setFontWeight(i === 1 || i === 2 ? 'bold' : 'normal');
  });
  aba.getRange(topo.length, 1, 1, nCols).setFontWeight('bold').setFontSize(12);
  const linhaCab = topo.length + 1;
  aba.getRange(linhaCab, 1, 1, nCols).setValues([cab]).setFontWeight('bold').setBackground('#D9D9D9').setHorizontalAlignment('center');

  const r0 = linhaCab + 1;
  if (corpo.length) {
    aba.getRange(r0, 1, corpo.length, nCols).setNumberFormat('@').setValues(corpo);
    aba.getRange(r0, 1, corpo.length, nCols).setVerticalAlignment('middle');
    // DATA, DIA e TURNO mesclados por bloco (dia + turno), como nos PDFs
    let i = 0;
    while (i < linhas.length) {
      let j = i;
      while (j + 1 < linhas.length && linhas[j + 1].bloco === linhas[i].bloco) j++;
      if (j > i) [1, 2, 3].forEach(function (c) { aba.getRange(r0 + i, c, j - i + 1, 1).merge(); });
      i = j + 1;
    }
    aba.getRange(linhaCab, 1, corpo.length + 1, nCols).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }

  // assinatura
  const rAss = r0 + corpo.length + 2;
  GUARN_ASSINATURA_.forEach(function (t, i) {
    aba.getRange(rAss + i, 1, 1, nCols).merge().setValue(t).setHorizontalAlignment('center').setFontWeight(i === 0 ? 'bold' : 'normal');
  });

  larguras.forEach(function (w, k) { aba.setColumnWidth(k + 1, w); });
  ss.setActiveSheet(aba);
  return { linhas: corpo.length, aba: GUARN_ABA.IMPRESSAO, pendentes: pendentes };
}