/**
 * PRÉ-ESCALA DO ADM — camada do Google Sheets. É a etapa 3 do painel "Pré-escala"
 * (sidebar_pre_escala.html); não tem painel próprio.
 * Depende de nucleo.gs, matriz.gs, pre_escala.gs, pre_escala_painel.gs, choques.gs, choques_painel.gs,
 * parametros.gs, parametros_painel.gs e distribuicao_adm.gs.
 *
 * Duas situações, conforme o parâmetro "Adm cumpre a carga mensal":
 *   NÃO (padrão): o Adm só cumpre os saldos, que o escalante aloca à mão. Ele fica de expediente em todo
 *                 dia útil; isso não é gravado, só usado para checar choques (JES, diárias etc.).
 *   SIM         : o Adm também cumpre a carga mensal. Os turnos do serviço normal são repartidos pelos dias úteis
 *                 (sem fins de semana e feriados da aba FERIADOS) e gravados na tabela como pré-escala;
 *                 o escalante ajusta depois em Mostrar Escala. Quantos turnos cada militar recebe vem da carga
 *                 mensal, dos saldos e do turno do Adm, lidos das Configurações e da aba TURNOS.
 */

/** O turno do serviço Adm na aba TURNOS: { servico, turno, h } (o primeiro, se houver mais de um) ou null. */
function admTurno_(porChave) {
  const chaves = Object.keys(porChave).filter(function (k) { return normalizar_(k.split('|')[0]) === 'ADM'; }).sort();
  if (!chaves.length) return null;
  const p = chaves[0].split('|');
  return { servico: p[0], turno: p[1], h: porChave[chaves[0]] };
}

/** Lê tudo e calcula a distribuição. Não grava nada. */
function admCalcular_(mes, secao, tz) {
  const hor = lerHorarios_();
  const adm = admTurno_(hor.porChave);
  if (!adm) throw new Error('A aba TURNOS não tem o serviço Adm.');
  const todas = lerAlocacoes_(tz).alocs;
  const secaoN = normalizar_(secao);
  const vistos = Object.create(null), lista = [];
  lerMilitares_().forEach(function (m) {
    if (normalizar_(m.secao) !== secaoN || grupoDoMilitar_(m) !== 'ADM' || vistos[m.mat]) return;
    vistos[m.mat] = true;
    lista.push(m);
  });

  const fer = lerFeriados_(tz);
  const dias = diasUteisDoMes_(mes, fer.mapa);
  const par = resolverParametros_(paramLerLinhas_(tz) || [], mes).valores;
  const saldo = horasDoSaldo_(hor.porChave);
  if (par.ADM_CUMPRE_CARGA !== true) {
    return { cumpre: false, adm: adm, lista: lista, dias: dias, fer: fer, saldo: saldo, saldos: par.SALDOS_ADM_POR_MILITAR, novas: [], hor: hor, todas: todas };
  }
  const carga = calcularCargaAdm_({
    carga: par.CARGA_MENSAL_HORAS, saldos: par.SALDOS_ADM_POR_MILITAR, horasSaldo: saldo.horas,
    horasTurnoAdm: adm.h.dur / 60, diasUteis: dias.length
  });

  // horários já ocupados de cada militar (todos os meses: o dia 01 enxerga a noite do dia 31) e Adm que ele já tem no mês
  const ocup = Object.create(null), jaTem = Object.create(null);
  todas.forEach(function (a) {
    const h = hor.porChave[a.servico + '|' + a.turno];
    if (h) {
      const ini = numeroDoDia_(a.dia) * 1440 + h.ini;
      if (!ocup[a.mat]) ocup[a.mat] = [];
      ocup[a.mat].push([ini, ini + h.dur]);
    }
    if (normalizar_(a.servico) === 'ADM' && a.dia.slice(0, 7) === mes) {
      if (!jaTem[a.mat]) jaTem[a.mat] = [];
      if (jaTem[a.mat].indexOf(a.dia) < 0) jaTem[a.mat].push(a.dia);
    }
  });
  const militares = lista.map(function (m) {
    const ocupados = Object.create(null);
    dias.forEach(function (d) {
      const ini = numeroDoDia_(d) * 1440 + adm.h.ini, fim = ini + adm.h.dur;
      if ((ocup[m.mat] || []).some(function (x) { return x[0] < fim && ini < x[1]; })) ocupados[d] = true;
    });
    return { mat: m.mat, ocupados: ocupados, jaTem: jaTem[m.mat] || [] };
  });

  const res = distribuirAdm_({ dias: dias, turnos: carga.turnosAdm, militares: militares });
  const novas = res.novas.map(function (x) { return { mat: x.mat, dia: x.dia, servico: adm.servico, turno: adm.turno, funcao: '', unidade: '' }; });
  return { cumpre: true, adm: adm, lista: lista, dias: dias, fer: fer, carga: carga, saldo: saldo, res: res, novas: novas, saldos: par.SALDOS_ADM_POR_MILITAR };
}

function admResumo_(c, mes, secao, tz) {
  const nomes = nomesPorMatricula_();
  const avisos = [];
  const feriados = c.fer.lista.filter(function (f) { return f.dia.slice(0, 7) === mes; }).map(function (f) { return f.dia.slice(8) + '/' + f.dia.slice(5, 7); });
  if (!c.lista.length) avisos.push('Nenhum militar do Adm na seção "' + secao + '".');
  if (!c.saldo.achou && c.saldos > 0) avisos.push('O serviço Saldo não está em TURNOS; usando ' + c.saldo.horas + ' h por saldo.');
  const base = {
    mes: mes, cumpre: c.cumpre, militares: c.lista.length, diasUteis: c.dias.length,
    feriados: feriados, semAbaFeriados: !c.fer.existe,
    saldos: c.saldos, horasSaldos: c.saldos * c.saldo.horas, horasTurno: c.adm.h.dur / 60
  };

  if (!c.cumpre) {
    // expediente em todo dia útil: relata o que já bate com ele neste mês
    const mats = Object.create(null);
    c.lista.forEach(function (m) { mats[m.mat] = true; });
    const bate = detectarChoques_(alocsComExpediente_(c.todas, c.hor, tz), c.hor.porChave, { mes: mes })
      .choques.filter(function (x) { return x.tipo === 'expediente' && mats[x.mat]; });
    const quem = Object.create(null);
    bate.forEach(function (x) { quem[x.mat] = true; });
    base.choquesExpediente = bate.length;
    if (bate.length) {
      const n = Object.keys(quem);
      avisos.push(bate.length + ' serviço(s) batem com o expediente do Adm (' + n.slice(0, 3).map(function (m) { return nomes[m] || m; }).join(', ') +
        (n.length > 3 ? '…' : '') + '). Detalhes em Conferir Integridade dos Dados.');
    }
    base.novas = 0;
    base.avisos = avisos;
    return base;
  }

  if (c.carga.saldosDemais) avisos.push('Os saldos previstos passam da carga do mês.');
  else if (!c.carga.cabe) avisos.push('Não cabem ' + c.carga.turnosAdm + ' turnos em ' + c.dias.length + ' dias úteis.');
  const faltaram = Object.keys(c.res.porMilitar).filter(function (m) { return c.res.porMilitar[m].faltou > 0; });
  if (faltaram.length && c.carga.cabe) {          // se os turnos nem cabem nos dias úteis, o aviso acima já explica
    avisos.push(faltaram.length + ' militar(es) ficaram sem alguns turnos por choque de horário: ' + faltaram.slice(0, 4).map(function (m) {
      return (nomes[m] || m) + ' (−' + c.res.porMilitar[m].faltou + ')';
    }).join(', ') + (faltaram.length > 4 ? '…' : '') + '.');
  }
  const cob = extremos_(c.dias.map(function (d) { return c.res.cobertura[d]; }));
  const tot = extremos_(Object.keys(c.res.porMilitar).map(function (m) { return c.res.porMilitar[m].total; }));
  base.turnosPorMilitar = c.carga.turnosAdm;
  base.horasNormais = c.carga.horasNormais;
  base.novas = c.novas.length;
  base.cobMin = cob.min; base.cobMax = cob.max;
  base.totMin = tot.min; base.totMax = tot.max;
  base.avisos = avisos;
  return base;
}

/* ------------------------------------------------------------ chamadas da tela */

/** Só calcula e mostra o resumo. Não grava nada. */
function painelAdmPrevia(mes, secao) {
  const v = validarEntrada_(mes, secao, '');
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return admResumo_(admCalcular_(v.mes, v.secao, tz), v.mes, v.secao, tz);
}

/** Grava a pré-escala na tabela e confere. Quem já tem turnos de Adm no mês conta; rodar de novo não duplica. */
function painelAdmGravar(mes, secao) {
  const v = validarEntrada_(mes, secao, '');
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const c = admCalcular_(v.mes, v.secao, tz);
    if (!c.cumpre) throw new Error('Com o Adm de expediente (carga mensal desligada nas Configurações) não há turnos do Adm para gravar.');
    if (!c.novas.length) return { gravadas: 0, restantes: 0 };
    gravarAlocacoes_(c.novas, tz);
    SpreadsheetApp.flush();
    const depois = admCalcular_(v.mes, v.secao, tz);
    return { gravadas: c.novas.length, restantes: depois.novas.length };
  } finally {
    lock.releaseLock();
  }
}