/**
 * ESCALAS DE SERVIÇO — camada do Google Sheets das guarnições (postos/funções por escala).
 * Depende de nucleo.gs, matriz.gs, pre_escala.gs, pre_escala_painel.gs, sincronia.gs,
 * sincronia_painel.gs, choques.gs, choques_painel.gs e guarnicao.gs.
 * Tela: sidebar_guarnicao.html (crie como "HTML" com esse nome exato).
 *
 * Acesso: menu "Escalas - 2º GB" > "Escalas de Serviço".
 *
 * ABAS (você edita; o código só lê):
 *   ESCALAS                ESCALA | SERVIÇOS | TÍTULO | MILITARES | DIAS
 *   GUARNIÇÕES POR ESCALA  VIGÊNCIA (A PARTIR DE) | ESCALA | TURNO | GUARNIÇÃO          (B58, ex-MODELOS DE GUARNIÇÃO)
 *   GUARNIÇÕES             a composição de cada guarnição: função, mínimo, máximo, CNH  (cadastro_guarnicoes.gs)
 *
 * B58 (RN-09): GUARNIÇÕES POR ESCALA é só o vínculo — quais guarnições atendem cada escala e
 * turno. Os postos de cada turno são as funções das guarnições vinculadas, lidas de GUARNIÇÕES no
 * mês da grade (vinculosParaModelo_). A aba no formato antigo (UNIDADE, FUNÇÃO, VAGAS, EXIGE CNH)
 * continua sendo lida como antes até o usuário clicar em "Converter para o formato novo".
 * ABAS GERADAS:
 *   ESCALA          a grade de edição (uma escala e um mês por vez)
 *   IMPRESSÃO       o documento no formato das escalas oficiais, para exportar em PDF
 *   _BASE_GUARNICAO, _LISTA_MILITARES   (ocultas) referência da grade e lista do dropdown
 *
 * A função e a guarnição de cada militar ficam na própria linha da tabela ALOCAÇÕES, nas
 * colunas FUNÇÃO e UNIDADE (a UNIDADE guarda o nome da guarnição do posto).
 */

const GUARN_ABA = {
  GRADE: 'ESCALA',                      // B52: chamava-se GUARNIÇÃO; abaAtual_ renomeia a antiga. Não confundir com a aba de cadastro ESCALAS
  // B58: literal, não GUARN_VINCULO_ABA_ (guarnicao.gs). Os .gs são avaliados em ordem não garantida
  // entre arquivos; um const de topo lendo o de outro arquivo pode cair na zona morta e derrubar a
  // carga inteira (some o menu). Tem de ser igual a GUARN_VINCULO_ABA_.
  IMPRESSAO: 'IMPRESSÃO', ESCALAS: 'ESCALAS', VINCULOS: 'GUARNIÇÕES POR ESCALA',   // ex-MODELOS DE GUARNIÇÃO; abaAtual_ renomeia a antiga
  BASE: '_BASE_GUARNICAO', LISTA: '_LISTA_MILITARES'
};

// layout da aba ESCALA (a grade de guarnição)
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
// B36 (RN-94): isto é só a semente das abas de cadastro. Nenhuma função é lida do código.
// B58: a semente do vínculo liga o PE Seguro à guarnição AR do exemplo da aba GUARNIÇÕES; a
// composição (funções, mínimo, máximo, CNH) está lá, não aqui.
const GUARN_CABECALHO_VINCULOS_ = ['VIGÊNCIA (A PARTIR DE)', 'ESCALA', 'TURNO', 'GUARNIÇÃO'];
const GUARN_EXEMPLO_VINCULOS_ = [
  GUARN_CABECALHO_VINCULOS_,
  ['', 'PE Seguro', 'TODOS', 'AR']
];

function abrirPainelGuarnicao() {
  migrarAbas_();                                         // B52: abas com nome antigo são renomeadas ao abrir o painel
  const html = HtmlService.createHtmlOutputFromFile('sidebar_guarnicao').setTitle('Escalas de Serviço');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ------------------------------------------------------------ leitura dos modelos */

/**
 * Os moldes das escalas no mês pedido ('aaaa-mm'; vazio = o mês de hoje).
 * B58: a composição vem do cadastro de GUARNIÇÕES daquele mês, e o vínculo tem vigência (RN-93),
 * então o molde depende do mês. Retorna o resultado de montarModelosGuarnicao_ com também
 * { semAbas, formatoAntigo, temColunaExigeCnh, mes, cadastro }.
 */
function lerModelosGuarnicao_(mes, tz) {
  const ss = SpreadsheetApp.getActive();
  tz = tz || ss.getSpreadsheetTimeZone();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''))) mes = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const catal = lerAba_(CONFIG.ABA_TURNOS);
  const cS = coluna_(catal, 'SERVIÇO', true), cT = coluna_(catal, 'TURNO', true);
  const turnosPorServico = Object.create(null);
  catal.linhas.forEach(function (l) {
    const s = texto_(l[cS]), t = texto_(l[cT]);
    if (!s || !t) return;
    if (!turnosPorServico[s]) turnosPorServico[s] = [];
    if (turnosPorServico[s].indexOf(t) < 0) turnosPorServico[s].push(t);
  });

  if (!ss.getSheetByName(GUARN_ABA.ESCALAS) || !abaAtual_(ss, GUARN_ABA.VINCULOS)) {
    return { escalas: {}, ordem: [], avisos: [], semAbas: true, formatoAntigo: false, mes: mes };
  }
  const tE = lerAba_(GUARN_ABA.ESCALAS), tM = lerAba_(GUARN_ABA.VINCULOS);
  const e = { escala: coluna_(tE, 'ESCALA', true), servicos: coluna_(tE, 'SERVIÇOS', false), titulo: coluna_(tE, 'TÍTULO', false), militares: coluna_(tE, 'MILITARES', false), dias: coluna_(tE, 'DIAS', false) };
  const pega = function (l, i) { return i < 0 ? '' : l[i]; };
  const escalas = tE.linhas.map(function (l) { return { escala: l[e.escala], servicos: pega(l, e.servicos), titulo: pega(l, e.titulo), militares: pega(l, e.militares), dias: pega(l, e.dias) }; });

  const cGuarn = coluna_(tM, 'GUARNIÇÃO', false);
  if (cGuarn < 0) {
    // formato antigo (ex-MODELOS DE GUARNIÇÃO): lido como era, até o usuário converter
    const m = { escala: coluna_(tM, 'ESCALA', true), turno: coluna_(tM, 'TURNO', false), unidade: coluna_(tM, 'UNIDADE', false), funcao: coluna_(tM, 'FUNÇÃO', true), vagas: coluna_(tM, 'VAGAS', false), cnh: coluna_(tM, 'EXIGE CNH', false) };
    const mod = montarModelosGuarnicao_(escalas,
      tM.linhas.map(function (l) { return { escala: l[m.escala], turno: pega(l, m.turno), unidade: pega(l, m.unidade), funcao: l[m.funcao], vagas: pega(l, m.vagas), exigeCnh: pega(l, m.cnh) }; }),
      turnosPorServico, { aba: GUARN_ABA.VINCULOS });
    mod.avisos.unshift('A aba ' + GUARN_ABA.VINCULOS + ' ainda está no formato antigo (UNIDADE, FUNÇÃO e VAGAS em cada linha) e está sendo lida como antes (B58). ' +
      'No formato novo ela só vincula ESCALA e TURNO a uma GUARNIÇÃO cadastrada em GUARNIÇÕES, que é de onde passam a vir as funções, as vagas e a CNH. Use o botão "Converter para o formato novo" do painel Escalas de Serviço.');
    mod.semAbas = false; mod.formatoAntigo = true; mod.temColunaExigeCnh = m.cnh >= 0; mod.mes = mes;
    return mod;
  }

  // B58 itens 2 e 3: o vínculo ESCALA/TURNO → GUARNIÇÃO, com a composição do cadastro no mês
  const m = { vig: coluna_(tM, 'VIGÊNCIA', false), escala: coluna_(tM, 'ESCALA', true), turno: coluna_(tM, 'TURNO', false) };
  const vinculos = tM.linhas.map(function (l, i) {
    let vig = pega(l, m.vig);
    if (vig instanceof Date) vig = Utilities.formatDate(vig, tz, 'yyyy-MM');          // digitou 11/2026 e a planilha virou data
    return { linha: i + 2, vigencia: texto_(vig), escala: texto_(l[m.escala]), turno: texto_(pega(l, m.turno)), guarnicao: texto_(l[cGuarn]) };
  });
  const cad = guarnicoesDoMes_(mes, tz);
  const v = vinculosParaModelo_(vinculos, cad, mes);
  const mod = montarModelosGuarnicao_(escalas, v.linhas, turnosPorServico, { aba: GUARN_ABA.VINCULOS });
  if (!cad.existe) mod.avisos.unshift('A aba GUARNIÇÕES não existe: sem ela nenhuma guarnição vinculada em ' + GUARN_ABA.VINCULOS + ' tem composição, e nenhuma escala tem posto. Crie a aba pelo botão "Criar abas e colunas que faltam".');
  // problemas do cadastro (vigência inválida, máximo < mínimo...) tiram posto da grade: aparecem aqui também
  mod.avisos = cad.avisos.concat(v.avisos, mod.avisos);
  mod.semAbas = false; mod.formatoAntigo = false; mod.temColunaExigeCnh = true; mod.mes = mes; mod.cadastro = cad;
  // no formato novo a guarnição do posto é sempre gravada na UNIDADE da alocação
  Object.keys(mod.escalas).forEach(function (n) { mod.escalas[n].usaUnidade = true; });
  return mod;
}

/** Cabeçalho da tabela de alocações: confere se as colunas que a escala precisa existem. */
function exigirColunasAlocacoes_(esc) {
  const aba = abaAtual_(SpreadsheetApp.getActive(), CONFIG.ABA_ALOCACOES);
  if (!aba) throw new Error('Aba não encontrada: "' + CONFIG.ABA_ALOCACOES + '".');
  const cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(normalizar_);
  if (cab.indexOf(normalizar_('FUNÇÃO')) < 0) throw new Error('Não achei a coluna "FUNÇÃO" na aba "' + CONFIG.ABA_ALOCACOES + '".');
  if (esc.usaUnidade && cab.indexOf(normalizar_('UNIDADE')) < 0) {
    throw new Error('A escala "' + esc.nome + '" tem postos de guarnição, e a guarnição de cada militar é gravada na coluna UNIDADE da aba "' + CONFIG.ABA_ALOCACOES +
      '", que não existe. Crie a coluna pelo botão "Criar abas e colunas que faltam" (no fim do painel) e tente de novo.');
  }
}

/* ------------------------------------------------------------ meta e referência */

function lerMetaGrade_() {
  const aba = abaAtual_(SpreadsheetApp.getActive(), GUARN_ABA.GRADE);
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
  const aba = abaAtual_(ss, GUARN_ABA.GRADE);
  const meta = aba ? lerMetaGrade_() : null;
  if (!meta) throw new Error('Não há grade montada. Escolha a escala e o mês e clique em "Montar grade".');
  const mod = lerModelosGuarnicao_(meta.mes, tz);
  const esc = mod.escalas[meta.escala];
  if (!esc) throw new Error('A escala "' + meta.escala + '" não tem mais postos em ' + meta.mes + ' (abas ESCALAS, GUARNIÇÕES POR ESCALA e GUARNIÇÕES). Monte a grade de novo.');
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
  // B36/B38 (RN-94, RN-12): funções de condutor e CNH vêm do cadastro
  const ctx = contextoDeCnh_(mod, mil, meta.mes, tz);
  const res = calcularGuarnicao_(base, grade, tabelaMes, esc, {
    horarios: hor.porChave, todas: todas, motoristas: motoristas,
    funcoesComCnh: ctx.funcoesComCnh, cnh: ctx.cnh, cnhPorUnidade: ctx.cnhPorUnidade, postos: ctx.postos   // B58 item 3
  });
  const atual = montarGrade_(esc, meta.mes, todas);
  return { res: res, esc: esc, meta: meta, base: base, atual: atual, avisos: mod.avisos.concat(hor.avisos, ctx.avisos) };
}

/**
 * B36/B38 (RN-94, RN-12): o que o código precisa saber sobre condutores, tudo vindo de cadastro.
 * B58 item 3: no formato novo, a regra é POR POSTO e vem do vínculo — a função de cada guarnição
 * vinculada diz, na coluna CNH da aba GUARNIÇÕES, se é de condutor e que categoria exige
 * (postosDoModelo_ / regraDoPosto_). A UNIDADE antiga não entra mais nisso.
 * No formato antigo de GUARNIÇÕES POR ESCALA continua a regra de antes: EXIGE CNH marca a função e
 * a categoria é a da guarnição cujo nome está na UNIDADE do posto.
 */
function contextoDeCnh_(mod, mil, mes, tz) {
  const avisos = [];
  const funcoesComCnh = funcoesQueExigemCnh_(mod);
  const temFuncoes = Object.keys(funcoesComCnh).length > 0;
  const postos = mod.formatoAntigo ? Object.create(null) : postosDoModelo_(mod);
  if (mod.formatoAntigo && !mod.temColunaExigeCnh) {
    avisos.push('A aba GUARNIÇÕES POR ESCALA (formato antigo) não tem a coluna EXIGE CNH (RN-94): por ora vale a regra antiga, pelo nome da função ("MOTORISTA"). Converta a aba para o formato novo: a CNH passa a vir da função em GUARNIÇÕES.');
  } else if (!temFuncoes && Object.keys(mod.escalas || {}).length) {
    avisos.push(mod.formatoAntigo
      ? 'Nenhuma função está marcada com EXIGE CNH = SIM na aba GUARNIÇÕES POR ESCALA (RN-94): por ora vale a regra antiga, pelo nome da função.'
      : 'Nenhuma função das guarnições vinculadas tem CNH na aba GUARNIÇÕES (RN-12): por ora vale a regra antiga, pelo nome da função ("MOTORISTA"). Ponha a categoria na linha da função de condutor de cada guarnição.');
  }

  const temColunaCnh = mil.some(function (m) { return m.temColunaCnh; });
  const cnh = Object.create(null);
  mil.forEach(function (m) { if (!(m.mat in cnh)) cnh[m.mat] = m.cnh || []; });
  // B59 (RN-12): CNH fora do padrão (só valem as letras A a E) não vira categoria; o painel diz quem é
  const foraDoPadrao = mil.filter(function (m) { return m.cnhInvalida && m.cnhInvalida.length; });
  if (foraDoPadrao.length) {
    avisos.push(foraDoPadrao.length + ' militar(es) com CNH fora do padrão na aba MILITARES (só valem as categorias A, B, C, D e E, juntas como "AD" ou separadas como "A, D"): ' +
      foraDoPadrao.slice(0, 5).map(function (m) { return (m.nome || m.mat) + ' ("' + m.cnhInvalida.join(', ') + '")'; }).join('; ') +
      (foraDoPadrao.length > 5 ? '…' : '') + '. Essa parte não conta como categoria (RN-12).');
  }

  // formato antigo: a CNH exigida é da GUARNIÇÃO cujo nome está na UNIDADE do posto
  const cnhPorUnidade = Object.create(null), unidadesCadastradas = Object.create(null);
  const cad = mod.cadastro || guarnicoesDoMes_(mes, tz);
  cad.guarnicoes.forEach(function (g) {
    unidadesCadastradas[normalizar_(g.id)] = true;
    if (mod.formatoAntigo && g.cnh.length) cnhPorUnidade[normalizar_(g.id)] = g.cnh;
  });
  const algumaExige = Object.keys(cnhPorUnidade).length > 0 ||
    Object.keys(postos).some(function (k) { return postos[k].cnh && postos[k].cnh.length; });
  const ctx = { funcoesComCnh: funcoesComCnh, cnh: cnh, cnhPorUnidade: cnhPorUnidade, postos: postos, unidadesCadastradas: unidadesCadastradas, temColunaCnh: temColunaCnh, avisos: avisos };
  if (algumaExige && !temColunaCnh) {
    avisos.push('Há posto que exige categoria de CNH, mas a aba MILITARES não tem a coluna CNH (RN-12): a checagem de habilitação fica desligada (vale só o quadro de motoristas).');
    // sem a coluna CNH ninguém teria categoria: a exigência sai, e fica só o quadro de motoristas
    ctx.cnhPorUnidade = Object.create(null);
    Object.keys(postos).forEach(function (k) { postos[k] = { exigeCnh: postos[k].exigeCnh, cnh: [] }; });
    ctx.temColunaCnh = false;
  }
  return ctx;
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
  // B38 (RN-12): quem está no quadro de motoristas mas sem CNH compatível com a guarnição do posto
  (r.avisosCnh || []).slice(0, 10).forEach(function (x) {
    avisosMot.push((nomes[x.mat] || x.mat) + ' em ' + x.funcao + ' (' + dm_(x.dia) + ' ' + x.turno + ') não tem CNH ' + x.exigida + ', exigida pela guarnição ' + x.unidade + ' (RN-12).');
  });
  if ((r.avisosCnh || []).length > 10) avisosMot.push('e mais ' + (r.avisosCnh.length - 10) + ' aviso(s) de CNH.');
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
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const meta = lerMetaGrade_();
  let ultimo = '';                                    // sem grade montada, sugere o último mês que tem alocações
  lerAlocacoes_(tz).alocs.forEach(function (a) { const m = a.dia.slice(0, 7); if (m > ultimo) ultimo = m; });
  const mesSugerido = meta ? meta.mes : ultimo;
  const mod = lerModelosGuarnicao_(mesSugerido, tz);      // B58: o molde depende do mês (vigência e cadastro)
  return {
    semAbas: !!mod.semAbas,
    formatoAntigo: !!mod.formatoAntigo,                    // B58: mostra o botão de converter
    escalas: mod.ordem.map(function (n) {
      const e = mod.escalas[n];
      return { nome: n, servicos: e.servicos.join(', '), militares: e.militares, turnos: e.turnos.length, usaUnidade: e.usaUnidade };
    }),
    avisos: avisosDeAbas_().concat(mod.avisos),              // B52
    escalaAtual: meta ? meta.escala : '',
    mesSugerido: mesSugerido
  };
}

/**
 * Cria as abas e as colunas de cadastro que faltam, sem sobrescrever nada que já exista:
 * ESCALAS e GUARNIÇÕES POR ESCALA (com exemplos), GUARNIÇÕES (B58: é de lá que vem a composição),
 * a coluna UNIDADE em ALOCAÇÕES (guarda a guarnição do posto) e a ORIGEM em TURNOS (B49 item 2).
 */
function painelGuarnicaoExemplos() {
  const ss = SpreadsheetApp.getActive();
  const criadas = [];
  const novaAba = function (nome, linhas) {
    const aba = ss.insertSheet(nome);
    const n = linhas[0].length;
    aba.getRange(1, 1, linhas.length, n).setValues(linhas);
    aba.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
    aba.setFrozenRows(1);
    return aba;
  };
  if (!ss.getSheetByName(GUARN_ABA.ESCALAS)) { novaAba(GUARN_ABA.ESCALAS, GUARN_EXEMPLO_ESCALAS_); criadas.push(GUARN_ABA.ESCALAS); }
  if (!abaAtual_(ss, GUARN_ABA.VINCULOS)) {
    const aba = novaAba(GUARN_ABA.VINCULOS, GUARN_EXEMPLO_VINCULOS_);
    aba.getRange(2, 1, 300, 1).setNumberFormat('@');                    // vigência é texto (aaaa-mm)
    validacoesDosVinculos_(aba);
    criadas.push(GUARN_ABA.VINCULOS);
  }
  // B58: sem GUARNIÇÕES não há composição; a aba nasce com o exemplo do cadastro
  if (cadgGarantirAba_().criada) criadas.push('GUARNIÇÕES');
  // B60: cada operação de coluna fica em try-catch isolado para não impedir as demais
  // (a Tabela do Sheets pode provocar erros inesperados em qualquer uma delas)
  try {
    if (garantirColunaUnidadeAlocacoes_()) criadas.push('coluna UNIDADE (em ' + CONFIG.ABA_ALOCACOES + ', guarda a guarnição de cada militar)');
  } catch (e) { criadas.push('ERRO ao criar UNIDADE: ' + e.message); }
  // B49 item 2 (RN-13): a origem do serviço passa a ser cadastro
  try {
    if (garantirColunaOrigem_()) criadas.push('coluna ORIGEM (em TURNOS; o JES já vem como PJES, como era no código)');
  } catch (e) { criadas.push('ERRO ao criar ORIGEM: ' + e.message); }
  // B58 item 1 (RN-09): TIPOS DE SERVIÇO saiu do cadastro de GUARNIÇÕES; vazia, a coluna é apagada
  try {
    if (cadgRetirarTiposDeServico_() === 'apagada') criadas.push('coluna TIPOS DE SERVIÇO apagada de GUARNIÇÕES (estava vazia e não é mais lida)');
  } catch (e) { criadas.push('ERRO ao retirar TIPOS DE SERVIÇO: ' + e.message); }
  return { criadas: criadas };
}

/** Listas suspensas da aba de vínculos: ESCALA vem de ESCALAS e GUARNIÇÃO de GUARNIÇÕES (aceita outro texto, com aviso). */
function validacoesDosVinculos_(aba) {
  const ss = SpreadsheetApp.getActive();
  const cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(normalizar_);
  const liga = function (colunaAqui, nomeAba, colunaLa) {
    const i = cab.indexOf(normalizar_(colunaAqui));
    const outra = abaAtual_(ss, nomeAba);
    if (i < 0 || !outra) return;
    const j = outra.getRange(1, 1, 1, outra.getLastColumn()).getValues()[0].map(normalizar_).indexOf(normalizar_(colunaLa));
    if (j < 0) return;
    aba.getRange(2, i + 1, 300, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(outra.getRange(2, j + 1, Math.max(outra.getMaxRows() - 1, 1), 1), true).setAllowInvalid(true).build());
  };
  liga('ESCALA', GUARN_ABA.ESCALAS, 'ESCALA');
  liga('GUARNIÇÃO', 'GUARNIÇÕES', 'GUARNIÇÃO');
}

/**
 * B58: acrescenta a coluna UNIDADE à aba ALOCAÇÕES, se faltar. Só o cabeçalho.
 * Usa a primeira coluna sem cabeçalho e sem dado depois da última coluna com cabeçalho (a aba da
 * sandbox tem uma assim, dentro da Tabela); se não houver, entra no fim.
 *
 * B60 (RN-94): a aba pode ser uma Tabela do Sheets. Escrever fora da fronteira da Tabela
 * (nCols + 1) cria a célula na planilha mas a Tabela não a inclui — fica invisível.
 * insertColumnAfter expande a Tabela antes de setValue; numa aba sem Tabela, funciona igual.
 */
function garantirColunaUnidadeAlocacoes_() {
  const aba = abaAtual_(SpreadsheetApp.getActive(), CONFIG.ABA_ALOCACOES);
  if (!aba) return false;
  const nCols = Math.max(aba.getLastColumn(), 1);
  const cab = aba.getRange(1, 1, 1, nCols).getValues()[0].map(function (x) { return String(x == null ? '' : x).trim(); });
  if (cab.map(normalizar_).indexOf('UNIDADE') >= 0) return false;
  let ultimaComNome = -1;
  cab.forEach(function (c, i) { if (c !== '') ultimaComNome = i; });
  let col = nCols + 1;
  const n = aba.getLastRow() - 1;
  for (let i = ultimaComNome + 1; i < nCols; i++) {
    const vazia = n < 1 || aba.getRange(2, i + 1, n, 1).getDisplayValues().every(function (r) { return String(r[0]).trim() === ''; });
    if (vazia) { col = i + 1; break; }
  }
  // B60: se a coluna é além da última, insere para expandir a Tabela do Sheets
  if (col > nCols) aba.insertColumnAfter(nCols);
  aba.getRange(1, col).setValue('UNIDADE').setFontWeight('bold');
  if (n > 0) aba.getRange(2, col, n, 1).setNumberFormat('@');
  SpreadsheetApp.flush();
  return true;
}

/**
 * B58 item 2: converte a aba GUARNIÇÕES POR ESCALA do formato antigo (ESCALA | TURNO | UNIDADE |
 * FUNÇÃO | VAGAS | EXIGE CNH) para o novo (VIGÊNCIA | ESCALA | TURNO | GUARNIÇÃO).
 * Uma linha nova por ESCALA + TURNO + UNIDADE preenchida, com a UNIDADE virando a GUARNIÇÃO.
 * Linhas sem UNIDADE não têm guarnição a vincular: o escalante vincula à mão depois.
 * Nada se perde: a aba antiga é renomeada para GUARNIÇÕES POR ESCALA (FORMATO ANTIGO), com tudo
 * dentro, e a nova é criada ao lado. Pede confirmação antes.
 */
function painelGuarnicaoConverterVinculos() {
  const ss = SpreadsheetApp.getActive();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const velha = abaAtual_(ss, GUARN_ABA.VINCULOS);
    if (!velha) throw new Error('A aba ' + GUARN_ABA.VINCULOS + ' não existe. Use "Criar abas e colunas que faltam".');
    const t = lerAba_(GUARN_ABA.VINCULOS);
    if (coluna_(t, 'GUARNIÇÃO', false) >= 0) return { convertida: false, motivo: 'A aba já está no formato novo.' };
    const c = { escala: coluna_(t, 'ESCALA', true), turno: coluna_(t, 'TURNO', false), unidade: coluna_(t, 'UNIDADE', false) };
    const r = converterVinculosAntigos_(t.linhas.map(function (l) {
      return { escala: texto_(l[c.escala]), turno: c.turno < 0 ? '' : texto_(l[c.turno]), unidade: c.unidade < 0 ? '' : texto_(l[c.unidade]) };
    }));

    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert('Converter ' + GUARN_ABA.VINCULOS,
      'A aba passa a só vincular ESCALA e TURNO a uma GUARNIÇÃO cadastrada em GUARNIÇÕES; as funções, vagas e CNH passam a vir de lá.\n\n' +
      r.linhas.length + ' vínculo(s) criado(s) a partir da coluna UNIDADE.\n' +
      (r.semUnidade ? r.semUnidade + ' linha(s) sem UNIDADE não têm guarnição a vincular' + (r.escalasSemVinculo.length ? ' (escalas ' + r.escalasSemVinculo.join(', ') + ')' : '') +
        ': essas escalas ficam sem posto até você vincular uma guarnição a elas.\n' : '') +
      '\nA aba atual é guardada, inteira, como "' + GUARN_VINCULOS_ANTIGA_ + '". Continuar?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return { convertida: false, cancelado: true };

    if (ss.getSheetByName(GUARN_VINCULOS_ANTIGA_)) throw new Error('Já existe a aba "' + GUARN_VINCULOS_ANTIGA_ + '" (de uma conversão anterior). Renomeie ou apague essa aba e tente de novo.');
    velha.setName(GUARN_VINCULOS_ANTIGA_);                // a antiga fica inteira, só muda de nome
    const nova = ss.insertSheet(GUARN_ABA.VINCULOS, velha.getIndex());
    const linhas = [GUARN_CABECALHO_VINCULOS_].concat(r.linhas.map(function (x) { return ['', x.escala, x.turno, x.guarnicao]; }));
    nova.getRange(1, 1, Math.max(linhas.length, 300), 1).setNumberFormat('@');
    nova.getRange(1, 1, linhas.length, GUARN_CABECALHO_VINCULOS_.length).setValues(linhas);
    nova.getRange(1, 1, 1, GUARN_CABECALHO_VINCULOS_.length).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
    nova.setFrozenRows(1);
    [130, 160, 90, 260].forEach(function (w, i) { nova.setColumnWidth(i + 1, w); });
    validacoesDosVinculos_(nova);
    return { convertida: true, vinculos: r.linhas.length, semUnidade: r.semUnidade, escalasSemVinculo: r.escalasSemVinculo, antiga: GUARN_VINCULOS_ANTIGA_ };
  } finally {
    lock.releaseLock();
  }
}

const GUARN_VINCULOS_ANTIGA_ = 'GUARNIÇÕES POR ESCALA (FORMATO ANTIGO)';

function painelGuarnicaoMontar(escala, mes) {
  mes = String(mes == null ? '' : mes).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const mod = lerModelosGuarnicao_(mes, tz);
  const esc = mod.escalas[escala];
  if (!esc) throw new Error('A escala "' + escala + '" não tem posto em ' + mes + ': ela precisa estar em ESCALAS e ter guarnição vinculada em GUARNIÇÕES POR ESCALA (com composição em GUARNIÇÕES). Veja os avisos do painel.');
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
  const ctxCnh = contextoDeCnh_(mod, mil, mes, tz);
  const rend = renderizarGrade_(esc, mes, grade, todas, mil, hor, tz, ctxCnh);
  salvarBaseGuarnicao_({ escala: esc.nome, mes: mes }, grade.base);
  SpreadsheetApp.flush();
  return {
    ok: true, vagas: grade.vagas, preenchidas: grade.preenchidas, semFuncao: grade.escaladosSemFuncao,
    semLista: rend.semLista, postosDeCondutor: rend.postosDeCondutor,   // B54
    avisos: ctxCnh.avisos
  };
}

function painelGuarnicaoPrevia() {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return resumoParaTelaG_(analisarGuarnicao_(tz), nomesPorMatricula_());
}

/**
 * esperado (B49 item 5, como no B35): quantas alterações a tela mostrava quando o usuário confirmou.
 * Se a tela esperava gravar algo e na releitura não há nada, a lista estava desatualizada e a tela
 * avisa, em vez de mostrar "Gravado: 0" como se fosse sucesso.
 */
function painelGuarnicaoSalvar(esperado) {
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
      restantes: restantes,
      desatualizado: total === 0 && parseInt(esperado, 10) > 0
    };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------ gravação na tabela */

/** Atualiza função e unidade, apaga linhas e acrescenta as novas. Nessa ordem: os números de linha ainda valem. */
function aplicarGuarnicao_(res, tz) {
  const aba = abaAtual_(SpreadsheetApp.getActive(), CONFIG.ABA_ALOCACOES);
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

function renderizarGrade_(esc, mes, grade, todas, mil, hor, tz, ctxCnh) {
  const ss = SpreadsheetApp.getActive();
  const aba = abaAtual_(ss, GUARN_ABA.GRADE) || ss.insertSheet(GUARN_ABA.GRADE);
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
  // B38 (RN-12): num posto que exige CNH, a lista só traz quem está no quadro de motoristas e tem
  // categoria compatível com a guarnição do posto (coluna UNIDADE casada com a coluna GUARNIÇÃO do
  // cadastro — a guarnição pode não ter viatura). Sem exigência cadastrada, vale só o quadro de
  // motoristas. Nada disso está escrito no código: vem das abas de cadastro.
  // B58 item 3: a regra de cada posto (é de condutor? que categoria?) vem do vínculo — regraDoPosto_
  const cnhCtx = ctxCnh || { funcoesComCnh: Object.create(null), cnh: Object.create(null), cnhPorUnidade: Object.create(null), postos: Object.create(null), unidadesCadastradas: Object.create(null) };
  const todosOsMats = mil.map(function (m) { return m.mat; });
  const condutoresDe = function (exigida, candidatos) {
    return candidatos.filter(function (mat) {
      const m = milPorMat[mat];
      if (!m || !m.motorista) return false;
      return exigida.length === 0 || cnhAtende_(m.cnh, exigida);
    });
  };
  const listaEmRegra = function (lista) {
    return lista.length ? SpreadsheetApp.newDataValidation().requireValueInList(lista.map(rotulo).sort(), true).setAllowInvalid(false).build() : null;
  };
  // B54 (RN-12, RN-81): nenhuma célula fica sem lista sem dizer por quê; a nota explica.
  const notas = [];
  let semLista = 0, postosDeCondutor = 0;
  let anterior = '';
  grade.linhas.forEach(function (l) {
    const bloco = l.dia + '|' + l.turno;
    const regraCnh = regraDoPosto_(cnhCtx, l.unidade, l.funcao);
    const exigeCnh = regraCnh.exigeCnh;
    let obs = '';
    if (bloco !== anterior && grade.semFuncao[bloco]) {
      obs = grade.semFuncao[bloco].map(function (x) {
        const m = milPorMat[x.mat];
        return (m ? m.nome : x.mat) + (x.funcao ? ' (' + x.funcao + ' fora do modelo)' : '');
      }).join(', ');
    }
    anterior = bloco;
    rows.push([Utilities.parseDate(l.dia, tz, 'yyyy-MM-dd'), GUARN_DIAS_SEMANA_[diaDaSemana_(l.dia)], l.turno, horarioTurno[l.turno], l.unidade, l.funcao, l.mat ? rotulo(l.mat) : '', l.servico, obs]);

    const candidatos = esc.militares === 'TODOS' ? todosOsMats : (escaladosNoBloco[bloco] || []);
    let regra, nota = '';
    if (exigeCnh) {                                       // B38 (RN-12)
      postosDeCondutor++;
      const k = bloco + '#' + chaveSlot_(l.unidade, l.funcao);
      const habilitados = condutoresDe(regraCnh.exigida, candidatos);
      if (!(k in regraPorBloco)) regraPorBloco[k] = listaEmRegra(habilitados);
      regra = regraPorBloco[k];
      nota = motivoDaLista_({
        funcao: l.funcao, unidade: l.unidade, exigeCnh: true, escalaTodos: esc.militares === 'TODOS',
        candidatos: candidatos.length,
        motoristas: candidatos.filter(function (mat) { return milPorMat[mat] && milPorMat[mat].motorista; }).length,
        habilitados: habilitados.length, exigida: regraCnh.exigida,
        temColunaCnh: !!cnhCtx.temColunaCnh,
        cadastrada: !!(cnhCtx.unidadesCadastradas || {})[normalizar_(l.unidade)]
      });
    } else if (esc.militares === 'TODOS') {
      regra = regraGeral;
    } else {
      if (!(bloco in regraPorBloco)) regraPorBloco[bloco] = listaEmRegra(candidatos);
      regra = regraPorBloco[bloco];
      nota = motivoDaLista_({ funcao: l.funcao, unidade: l.unidade, exigeCnh: false, escalaTodos: false, candidatos: candidatos.length });
    }
    if (!regra) semLista++;
    regras.push([regra]);
    notas.push([nota]);
  });

  if (n > 0) {
    const r0 = L.PRIMEIRA;
    aba.getRange(r0, 1, n, L.NCOLS).setValues(rows);
    aba.getRange(r0, L.DATA, n, 1).setNumberFormat('dd/MM/yyyy');
    aba.getRange(r0, L.MILITAR, n, 1).setDataValidations(regras);
    aba.getRange(r0, L.MILITAR, n, 1).setNotes(notas);                  // B54: a célula diz por que a lista está vazia ou curta
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
  return { semLista: semLista, postosDeCondutor: postosDeCondutor };
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
  const mod = lerModelosGuarnicao_(mes, tz);
  const esc = mod.escalas[escala];
  if (!esc) throw new Error('Escolha uma escala da lista (a escala "' + escala + '" não tem posto em ' + mes + ').');
  exigirColunasAlocacoes_(esc);

  const grade = montarGrade_(esc, mes, lerAlocacoes_(tz).alocs);
  const mil = {};
  lerMilitares_().forEach(function (m) { if (!(m.mat in mil)) mil[m.mat] = m; });
  const hor = lerHorarios_();
  const linhas = linhasParaImpressao_(grade, esc, mil, hor.porChave, lerOrigens_().origens);   // B49 item 2

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