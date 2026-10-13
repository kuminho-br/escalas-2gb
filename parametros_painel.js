/**
 * PAINEL DE CONFIGURAÇÕES — camada do Google Sheets.
 * Depende de nucleo.gs, matriz.gs (texto_) e parametros.gs (lógica e catálogo).
 * Tela: sidebar_parametros.html (crie como "HTML" com esse nome exato).
 *
 * Os valores ficam na aba CONFIGURAÇÕES (CHAVE, VALOR, VIGÊNCIA, DESCRIÇÃO), uma linha por
 * valor. Pode editar a aba à mão; linhas inválidas são ignoradas e aparecem como aviso no painel.
 *
 * Para ler um parâmetro em qualquer parte do código:
 *   valorParametro_('CARGA_MENSAL_ADM_HORAS', '2026-11')   // mês opcional; sem ele, vale o mês atual
 */

const PARAM_ABA = 'CONFIGURAÇÕES';
const PARAM_CABECALHO_ = ['CHAVE', 'VALOR', 'VIGÊNCIA (A PARTIR DE)', 'DESCRIÇÃO'];

function abrirPainelParametros() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_parametros').setTitle('Configurações');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ------------------------------------------------------------ leitura */

function paramMesAtual_(tz) { return Utilities.formatDate(new Date(), tz, 'yyyy-MM'); }

/** null se a aba não existe. Cada linha: { linha, chave, valor, vigencia }. */
function paramLerLinhas_(tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(PARAM_ABA);
  if (!aba) return null;
  const v = aba.getDataRange().getValues();
  if (v.length < 1 || normalizar_(v[0][0]) !== 'CHAVE') return null;
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const chave = texto_(v[i][0]);
    if (chave === '') continue;
    let vig = v[i][2];
    if (vig instanceof Date) vig = Utilities.formatDate(vig, tz, 'yyyy-MM');   // digitou 10/2026 e a planilha virou data
    out.push({ linha: i + 1, chave: chave, valor: v[i][1], vigencia: texto_(vig) });
  }
  return out;
}

/** Valor em vigor de um parâmetro. Sem a aba (ou sem a linha), devolve o padrão do catálogo. */
function valorParametro_(chave, mes) {
  const def = paramDef_(chave);
  if (!def) throw new Error('Parâmetro desconhecido: "' + chave + '".');
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const m = mes || paramMesAtual_(tz);
  return resolverParametros_(paramLerLinhas_(tz) || [], m).valores[def.chave];
}

/* ------------------------------------------------------------ aba */

/** Cria a aba com um valor-base (o padrão) para cada parâmetro. Não mexe numa aba que já existe. */
function paramGarantirAba_() {
  const ss = SpreadsheetApp.getActive();
  const existente = ss.getSheetByName(PARAM_ABA);
  if (existente) return existente;
  const aba = ss.insertSheet(PARAM_ABA);
  const linhas = [PARAM_CABECALHO_].concat(PARAM_CATALOGO_.map(function (d) { return [d.chave, d.padrao, '', d.descricao]; }));
  aba.getRange(1, 3, linhas.length + 200, 1).setNumberFormat('@');
  aba.getRange(1, 1, linhas.length, 4).setValues(linhas);
  aba.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
  aba.setFrozenRows(1);
  aba.setColumnWidth(1, 220); aba.setColumnWidth(2, 160); aba.setColumnWidth(3, 170); aba.setColumnWidth(4, 520);
  return aba;
}

function paramFormatarValor_(def, valor) {
  if (def.tipo === 'simnao') return valor ? 'SIM' : 'NÃO';
  return String(valor);
}

/* ------------------------------------------------------------ chamadas da tela */

/** Tudo o que a tela precisa para um mês: valor em vigor, de onde ele vem e o histórico de cada parâmetro. */
function painelParametrosDados(mes) {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  mes = String(mes || '').trim() || paramMesAtual_(tz);
  if (!PARAM_MES_RE_.test(mes)) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const linhas = paramLerLinhas_(tz);
  const r = resolverParametros_(linhas || [], mes);
  return {
    mes: mes,
    semAba: linhas === null,
    avisos: r.avisos,
    carga: paramCargaAdm_(r.valores, mes, tz),
    feriados: feriadosDoMes_(tz, mes),
    params: PARAM_CATALOGO_.map(function (d) {
      return {
        chave: d.chave, grupo: d.grupo || 'Geral', rotulo: d.rotulo, tipo: d.tipo, descricao: d.descricao, min: d.min == null ? null : d.min, max: d.max == null ? null : d.max,
        valor: paramFormatarValor_(d, r.valores[d.chave]),
        desde: r.origem[d.chave].padrao ? 'padrão do sistema' : (r.origem[d.chave].vigencia || 'sempre'),
        historico: historicoParametro_(linhas || [], d.chave).map(function (h) {
          return { vigencia: h.vigencia, valor: paramFormatarValor_(d, h.valor) };
        })
      };
    })
  };
}

/** Grava um valor. vigencia '' = valor-base; 'aaaa-mm' = passa a valer a partir daquele mês. */
function painelParametrosSalvar(chave, valor, vigencia, mes) {
  const def = paramDef_(chave);
  if (!def) throw new Error('Parâmetro desconhecido.');
  const c = paramConverter_(def, valor);
  if (!c.ok) throw new Error(def.rotulo + ': ' + c.erro);
  const vig = paramVigencia_(vigencia);
  if (!vig.ok) throw new Error(vig.erro);

  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const aba = paramGarantirAba_();
    const linhas = paramLerLinhas_(tz) || [];
    const igual = linhas.filter(function (l) {
      const d = paramDef_(l.chave);
      const v = paramVigencia_(l.vigencia);
      return d && d.chave === def.chave && v.ok && v.valor === vig.valor;
    });
    if (igual.length) {
      aba.getRange(igual[igual.length - 1].linha, 2).setValue(c.valor);        // mesma chave e mesma vigência: troca o valor
    } else {
      const ultima = Math.max(aba.getLastRow(), 1) + 1;
      aba.getRange(ultima, 3).setNumberFormat('@');
      aba.getRange(ultima, 1, 1, 4).setValues([[def.chave, c.valor, vig.valor, def.descricao]]);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return painelParametrosDados(mes);
}

/** Remove uma linha do histórico (a que tem essa chave e essa vigência). */
function painelParametrosRemover(chave, vigencia, mes) {
  const def = paramDef_(chave);
  if (!def) throw new Error('Parâmetro desconhecido.');
  const vig = paramVigencia_(vigencia);
  if (!vig.ok) throw new Error(vig.erro);
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const aba = SpreadsheetApp.getActive().getSheetByName(PARAM_ABA);
    if (!aba) throw new Error('A aba ' + PARAM_ABA + ' não existe.');
    const alvo = (paramLerLinhas_(tz) || []).filter(function (l) {
      const d = paramDef_(l.chave);
      const v = paramVigencia_(l.vigencia);
      return d && d.chave === def.chave && v.ok && v.valor === vig.valor;
    });
    if (!alvo.length) throw new Error('Essa linha não existe mais.');
    for (let i = alvo.length - 1; i >= 0; i--) aba.deleteRows(alvo[i].linha, 1);   // de baixo para cima
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return painelParametrosDados(mes);
}

/** Resumo da carga do Adm no mês (só informa; não grava nada). */
function paramCargaAdm_(valores, mes, tz) {
  const avisos = [];
  let horasTurno = 8, saldo = { horas: 12, achou: false };
  try {
    const hor = lerHorarios_();
    const adm = admTurno_(hor.porChave);
    if (adm) horasTurno = adm.h.dur / 60; else avisos.push('Sem o serviço Adm na aba TURNOS: usando 8 h.');
    saldo = horasDoSaldo_(hor.porChave);
  } catch (e) { avisos.push('Não consegui ler a aba TURNOS: usando 8 h por turno do Adm.'); }
  if (!saldo.achou && valores.SALDOS_ADM_POR_MILITAR > 0) avisos.push('Sem o serviço Saldo na aba TURNOS: usando ' + saldo.horas + ' h por saldo.');
  const c = calcularCargaAdm_({
    carga: valores.CARGA_MENSAL_HORAS, saldos: valores.SALDOS_ADM_POR_MILITAR, horasSaldo: saldo.horas,
    horasTurnoAdm: horasTurno, diasUteis: diasUteisDoMes_(mes, lerFeriados_(tz).mapa).length
  });
  c.horasTurno = horasTurno;
  c.saldos = valores.SALDOS_ADM_POR_MILITAR;
  c.cumpreCarga = valores.ADM_CUMPRE_CARGA === true;
  if (c.cumpreCarga) {
    if (c.saldosDemais) avisos.push('Os saldos previstos passam da carga do mês.');
    else if (!c.cabe) avisos.push('Não cabem ' + c.turnosAdm + ' turnos em ' + c.diasUteis + ' dias úteis.');
  }
  c.avisos = avisos;
  return c;
}

/* ------------------------------------------------------------ feriados */

const FERIADOS_ABA = 'FERIADOS';

/** Aba FERIADOS (DATA, DESCRIÇÃO). Sem a aba: nenhum feriado. Retorna { existe, mapa: { dia: true }, lista: [{ dia, nome }] }. */
function lerFeriados_(tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(FERIADOS_ABA);
  const out = { existe: !!aba, mapa: Object.create(null), lista: [] };
  if (!aba) return out;
  aba.getDataRange().getValues().forEach(function (l) {
    const dia = diaComoTexto_(l[0], tz);
    if (!dia || out.mapa[dia]) return;
    out.mapa[dia] = true;
    out.lista.push({ dia: dia, nome: texto_(l[1]) });
  });
  out.lista.sort(function (a, b) { return a.dia < b.dia ? -1 : 1; });
  return out;
}

/** Abre a aba FERIADOS (criando, se não existir). */
function painelFeriadosAbrir() {
  const ss = SpreadsheetApp.getActive();
  let aba = ss.getSheetByName(FERIADOS_ABA);
  if (!aba) {
    aba = ss.insertSheet(FERIADOS_ABA);
    aba.getRange(1, 1, 1, 2).setValues([['DATA', 'DESCRIÇÃO']]).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
    aba.getRange(2, 1, 300, 1).setNumberFormat('dd/MM/yyyy');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 110); aba.setColumnWidth(2, 320);
  }
  ss.setActiveSheet(aba);
}

function feriadosDoMes_(tz, mes) {
  const f = lerFeriados_(tz);
  return {
    existe: f.existe,
    dias: f.lista.filter(function (x) { return x.dia.slice(0, 7) === mes; }).map(function (x) { return x.dia.slice(8) + '/' + x.dia.slice(5, 7); })
  };
}