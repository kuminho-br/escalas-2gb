/**
 * PAINEL DE INTEGRIDADE — camada do Google Sheets da checagem de choques.
 * Depende de nucleo.js, matriz.js, pre_escala.js, sincronia.js, sincronia_painel.js e choques.js.
 * Tela: sidebar_integridade.html (crie como "HTML" com esse nome exato).
 *
 * Acesso: menu "Escalas - 2º GB" > "Conferir Integridade dos Dados".
 * Os choques também são checados na hora de salvar a matriz (painel "Mostrar Escala").
 */

function abrirPainelIntegridade() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_integridade').setTitle('Integridade dos Dados');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Lê a aba TURNOS pelo TEXTO que aparece na célula (getDisplayValues):
 * células de hora chegam como datas de 1899 se lidas como valor.
 */
function lerHorarios_() {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_TURNOS);
  if (!aba) throw new Error('Aba não encontrada: "' + CONFIG.ABA_TURNOS + '".');
  const v = aba.getDataRange().getDisplayValues();
  if (v.length === 0) throw new Error('A aba "' + CONFIG.ABA_TURNOS + '" está vazia.');
  const cab = v[0].map(normalizar_);
  const col = function (rotulo, obrigatoria) {
    const alvo = normalizar_(rotulo);
    let i = cab.indexOf(alvo);
    if (i < 0) i = cab.findIndex(function (c) { return c.indexOf(alvo) === 0; });
    if (i < 0 && obrigatoria) throw new Error('Não achei a coluna "' + rotulo + '" na aba "' + CONFIG.ABA_TURNOS + '".');
    return i;
  };
  const cS = col('SERVIÇO', true), cT = col('TURNO', true), cI = col('HORÁRIO INÍCIO', true), cF = col('HORÁRIO FIM', true), cD = col('DURAÇÃO', false);
  return montarHorarios_(v.slice(1).map(function (l) {
    return { servico: texto_(l[cS]), turno: texto_(l[cT]), inicio: texto_(l[cI]), fim: texto_(l[cF]), duracao: cD < 0 ? '' : texto_(l[cD]) };
  }));
}

/**
 * Legenda de turnos (seção recolhível do painel "Mostrar Escala"): serviço, turno e horário,
 * lidos da aba TURNOS, com a cor que o serviço tem na matriz. Só lê.
 */
function painelLegenda() {
  const hor = lerHorarios_();
  return { grupos: montarLegenda_(hor.porChave, CONFIG.CORES), avisos: hor.avisos };
}

/**
 * Acrescenta às alocações o expediente implícito do Adm: todo dia útil dos meses que aparecem na lista,
 * para cada militar da jornada Adm, nos meses em que o Adm NÃO cumpre a carga mensal (parâmetro
 * ADM_CUMPRE_CARGA). Só para conferir choques: nunca é gravado.
 */
function alocsComExpediente_(alocs, hor, tz) {
  const adm = admTurno_(hor.porChave);
  if (!adm) return alocs;
  const mats = [], vistos = Object.create(null);
  lerMilitares_().forEach(function (m) {
    if (grupoDoMilitar_(m) === 'ADM' && !vistos[m.mat]) { vistos[m.mat] = true; mats.push(m.mat); }
  });
  if (!mats.length) return alocs;
  const linhas = paramLerLinhas_(tz) || [];
  const feriados = lerFeriados_(tz).mapa;
  const meses = Object.create(null);
  alocs.forEach(function (a) { meses[a.dia.slice(0, 7)] = true; });
  let extra = [];
  Object.keys(meses).sort().forEach(function (mes) {
    if (resolverParametros_(linhas, mes).valores.ADM_CUMPRE_CARGA === true) return;
    extra = extra.concat(expedienteImplicito_({ mats: mats, dias: diasUteisDoMes_(mes, feriados), servico: adm.servico, turno: adm.turno }));
  });
  return alocs.concat(extra);
}

/**
 * Contexto das regras da escala manual (regras_escala.js): quem é do Adm (jornada Adm em MILITARES).
 * Só lê a aba MILITARES.
 */
function contextoDeRegras_() {
  const adm = Object.create(null);
  lerMilitares_().forEach(function (m) { if (grupoDoMilitar_(m) === 'ADM') adm[m.mat] = true; });
  return { adm: adm };
}

/**
 * RN-03: rede de segurança de toda gravação na tabela (pré-escala, Adm, operações, salvar a escala).
 * Nenhuma automação lança Saldo para quem não é do Adm: se algum caminho tentar, a gravação é cancelada.
 */
function garantirSaldoSoDoAdm_(novas) {
  if (!novas.some(function (a) { return ehSaldo_(a.servico); })) return;
  const v = violacoesSaldo_(novas, contextoDeRegras_());
  if (v.length === 0) return;
  const mats = Array.from(new Set(v.map(function (x) { return x.mat; })));
  throw new Error('Gravação cancelada (RN-03): Saldo só pode ser lançado para militar do Adm. Matrícula(s): ' + mats.join(', ') + '.');
}

/** Mês inicial da tela: o da escala carregada ou, sem matriz, o último mês que tem alocações. */
function painelDadosIntegridade() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const aba = abaDaEscala_(ss, false);
  const m = aba ? lerMatrizAtual_(aba, tz) : null;
  if (m && m.dias[0]) return { mes: m.dias[0].slice(0, 7) };
  let ultimo = '';
  lerAlocacoes_(tz).alocs.forEach(function (a) { const x = a.dia.slice(0, 7); if (x > ultimo) ultimo = x; });
  return { mes: ultimo };
}

const LIMITE_CHOQUES_ = 60;

/** mes = 'aaaa-mm', ou '' para todos os meses. Só lê e relata; não grava nada. */
function painelIntegridade(mes) {
  mes = String(mes == null ? '' : mes).trim();
  if (mes && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: use o formato aaaa-mm ou marque "todos os meses".');
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();

  const lidas = lerAlocacoes_(tz);
  const hor = lerHorarios_();
  const det = detectarChoques_(alocsComExpediente_(lidas.alocs, hor, tz), hor.porChave, { mes: mes });
  const nomes = nomesPorMatricula_();
  const rot = montarRotulos_(hor.porChave, lerCatalogo_().pares);
  const rotulo = function (a) { return a.dia.slice(8) + '/' + a.dia.slice(5, 7) + ' ' + (a.implicito ? 'expediente (Adm)' : rotuloDe_(rot, a.servico, a.turno)); };
  const itens = det.choques.map(function (c) {
    return { nome: nomes[c.mat] || ('matrícula ' + c.mat), tipo: c.tipo, a: rotulo(c.a), b: rotulo(c.b), horas: horasTexto_(c.minutos), ordem: c.a.dia };
  }).sort(function (x, y) { return x.nome < y.nome ? -1 : x.nome > y.nome ? 1 : (x.ordem < y.ordem ? -1 : 1); });

  // regras da escala (RN-03 e as seguintes) sobre a tabela inteira
  const regras = violacoesDeRegras_(lidas.alocs, contextoDeRegras_())
    .filter(function (v) { return !mes || v.dia.slice(0, 7) === mes; })
    .map(function (v) { return { nome: nomes[v.mat] || ('matrícula ' + v.mat), a: rotulo(v), texto: v.texto, ordem: v.dia }; })
    .sort(function (x, y) { return x.nome < y.nome ? -1 : x.nome > y.nome ? 1 : (x.ordem < y.ordem ? -1 : 1); });

  let matriz = { existe: false, total: 0, linhas: [] };
  const aba = abaDaEscala_(ss, false);
  const dif = aba ? diferencasDaMatrizAtual_(aba, lidas.alocs, tz, rot) : null;
  if (aba && layoutAntigo_(aba)) {
    matriz = { existe: true, total: 1, linhas: ['A escala carregada é de uma versão anterior do sistema. Carregue a escala de novo.'] };
  } else if (dif) {
    const total = dif.cmp.total + dif.orfas;
    matriz = { existe: true, total: total, linhas: total > 0 ? textoDiferencas_(dif, rot).split('\n') : [] };
  }

  const ignoradas = [];
  if (lidas.semData) ignoradas.push(lidas.semData + ' linha(s) da tabela sem data reconhecível não entram em nenhuma conferência.');
  if (lidas.incompletas) ignoradas.push(lidas.incompletas + ' linha(s) da tabela sem serviço ou turno não entram em nenhuma conferência.');

  return {
    mes: mes,
    totalAlocacoes: lidas.alocs.length,
    totalChoques: itens.length,
    choques: itens.slice(0, LIMITE_CHOQUES_),
    totalRegras: regras.length,
    regras: regras.slice(0, LIMITE_CHOQUES_),
    semHorario: det.semHorario,
    avisosTurnos: hor.avisos,
    matriz: matriz,
    ignoradas: ignoradas
  };
}