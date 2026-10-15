/**
 * COTAS DAS OPERAÇÕES — camada do Google Sheets. É a etapa 4 do painel "Pré-escala"
 * (sidebar_pre_escala.html); não tem painel próprio. A lógica está em distribuicao_cotas.js.
 * Depende de nucleo.js, matriz.js, pre_escala.js, pre_escala_painel.js, choques.js, choques_painel.js,
 * parametros.js, parametros_painel.js, guarnicao.js, guarnicao_painel.js e distribuicao_adm_painel.js.
 *
 * Abas lidas (criadas vazias, com cabeçalho e uma linha de exemplo, por painelCotasAbas):
 *   COTAS         MÊS | SB | OPERAÇÃO | SERVIÇO | QUANTIDADE | ORIGEM | PRIORIDADE
 *                   OPERAÇÃO = nome da escala na aba ESCALAS. ORIGEM = interna (padrão) ou externa (RN-34/RN-35).
 *                   Linhas de JES da SB são aceitas e ignoradas nesta etapa.
 *                   PRIORIDADE: 1 é a primeira operação a ser preenchida; vazio vai por último.
 *   VOLUNTARIADO  MÊS | MATRÍCULA | DIA | TURNO | SERVIÇO ACEITO
 *                   Uma linha por dia e turno em que o militar se voluntariou (A, B ou C). SERVIÇO ACEITO: "todos" ou
 *                   o nome de um serviço. Quem tem ao menos uma linha no mês preencheu o formulário (RN-41).
 * Vagas por turno: aba MODELOS DE GUARNIÇÃO (soma das vagas de todas as funções do turno; as funções não entram agora).
 * Horários e tipo de serviço: aba TURNOS.
 */

const COTAS_ABA = { COTAS: 'COTAS', VOLUNTARIADO: 'VOLUNTARIADO' };
const LIMITE_VAZIAS_ = 40;

/** 'aaaa-mm' a partir de uma célula de mês (data, 'aaaa-mm', 'mm/aaaa' ou 'mm/aa'). '' se não entender. */
function mesDaCelula_(v, tz) {
  if (ehData_(v)) return Utilities.formatDate(v, tz, 'yyyy-MM');
  const s = texto_(v);
  let m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return m[1] + '-' + m[2];
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return m[2] + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{1,2})\/(\d{2})$/);
  if (m) return '20' + m[2] + '-' + ('0' + m[1]).slice(-2);
  return '';
}

/** Letra do turno a partir de "A", "1º TURNO" etc. */
function letraDoTurno_(v) {
  const s = normalizar_(v);
  if (/^[A-Z]$/.test(s)) return s;
  const m = s.match(/^([123])(O|TURNO)/);
  return m ? ['A', 'B', 'C'][Number(m[1]) - 1] : '';
}

/** Tipo de cada serviço, da aba TURNOS (coluna TIPO DE SERVIÇO): { 'Bioma': 'Diária', ... }. */
function lerTiposDeServico_() {
  const t = lerAba_(CONFIG.ABA_TURNOS);
  const cS = coluna_(t, 'SERVIÇO', true), cTipo = coluna_(t, 'TIPO DE SERVIÇO', false);
  const tipos = Object.create(null);
  if (cTipo < 0) return tipos;
  t.linhas.forEach(function (l) { const s = texto_(l[cS]); if (s && !(s in tipos)) tipos[s] = texto_(l[cTipo]); });
  return tipos;
}

/** Aba COTAS do mês e da seção. Retorna { existe, linhas: [{ id, operacao, servico, quantidade, origem, prioridade }], avisos }. */
function lerCotas_(mes, secao, tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(COTAS_ABA.COTAS);
  const out = { existe: !!aba, linhas: [], avisos: [] };
  if (!aba) return out;
  const t = lerAba_(COTAS_ABA.COTAS);
  const c = {
    mes: coluna_(t, 'MÊS', true), sb: coluna_(t, 'SB', false), op: coluna_(t, 'OPERAÇÃO', true), serv: coluna_(t, 'SERVIÇO', false),
    qtd: coluna_(t, 'QUANTIDADE', true), origem: coluna_(t, 'ORIGEM', false), prio: coluna_(t, 'PRIORIDADE', false)
  };
  const secaoN = normalizar_(secao);
  t.linhas.forEach(function (l, i) {
    const op = texto_(l[c.op]);
    if (!op || mesDaCelula_(l[c.mes], tz) !== mes) return;
    if (c.sb >= 0 && texto_(l[c.sb]) !== '' && normalizar_(l[c.sb]) !== secaoN) return;
    const serv = c.serv < 0 ? '' : texto_(l[c.serv]);
    if (normalizar_(serv) === 'JES' || normalizar_(op) === 'JES') return;           // JES da SB: fora desta etapa
    const q = parseInt(texto_(l[c.qtd]), 10);
    if (!(q >= 0)) { out.avisos.push('COTAS, linha ' + (i + 2) + ': QUANTIDADE inválida; ignorada.'); return; }
    const origem = c.origem < 0 ? 'interna' : (normalizar_(l[c.origem]).indexOf('EXT') === 0 ? 'externa' : 'interna');
    const prio = c.prio < 0 ? '' : parseInt(texto_(l[c.prio]), 10);
    out.linhas.push({ id: 'COTAS!' + (i + 2), operacao: op, servico: serv, quantidade: q, origem: origem, prioridade: isNaN(prio) ? '' : prio });
  });
  return out;
}

/** Aba VOLUNTARIADO do mês, só de militares da lista. Retorna { existe, linhas: [{ mat, dia, turno, servico }], avisos }. */
function lerVoluntariado_(mes, tz) {
  const aba = SpreadsheetApp.getActive().getSheetByName(COTAS_ABA.VOLUNTARIADO);
  const out = { existe: !!aba, linhas: [], avisos: [] };
  if (!aba) return out;
  const t = lerAba_(COTAS_ABA.VOLUNTARIADO);
  const c = { mat: coluna_(t, 'MATRÍCULA', true), dia: coluna_(t, 'DIA', true), turno: coluna_(t, 'TURNO', true), serv: coluna_(t, 'SERVIÇO ACEITO', false) };
  let semTurno = 0;
  t.linhas.forEach(function (l) {
    const mat = texto_(l[c.mat]);
    if (!mat) return;
    const dia = diaComoTexto_(l[c.dia], tz);
    if (!dia || dia.slice(0, 7) !== mes) return;
    const turno = letraDoTurno_(l[c.turno]);
    if (!turno) { semTurno++; return; }
    out.linhas.push({ mat: mat, dia: dia, turno: turno, servico: c.serv < 0 ? '' : texto_(l[c.serv]) });
  });
  if (semTurno) out.avisos.push('VOLUNTARIADO: ' + semTurno + ' linha(s) com TURNO ilegível foram ignoradas.');
  return out;
}

/** Lê tudo e calcula a distribuição. Não grava nada. */
function cotasCalcular_(mes, secao, tz) {
  const hor = lerHorarios_();
  const tipos = lerTiposDeServico_();
  const mod = lerModelosGuarnicao_();
  const cotas = lerCotas_(mes, secao, tz);
  const vol = lerVoluntariado_(mes, tz);
  const todasComExp = alocsComExpediente_(lerAlocacoes_(tz).alocs, hor, tz);
  const reais = todasComExp.filter(function (a) { return !a.implicito; });
  const expediente = todasComExp.filter(function (a) { return a.implicito; });

  const secaoN = normalizar_(secao), vistos = Object.create(null), militares = [];
  const cadastro = lerMilitares_();
  cadastro.forEach(function (m) {
    if (normalizar_(m.secao) !== secaoN || vistos[m.mat]) return;
    vistos[m.mat] = true;
    militares.push({ mat: m.mat });
  });

  // RN-46 / RN-39: só quem tem VOLUNTÁRIO JES = sim pode preencher o formulário; as linhas dos demais são ignoradas
  const vjes = voluntariosJesDe_(cadastro);
  const sep = separarVoluntariado_(vol.linhas, vjes);
  const nomesCad = nomesPorMatricula_();
  const avisos = [].concat(mod.avisos || [], cotas.avisos, vol.avisos);
  if (!vjes) avisos.push('A aba MILITARES não tem a coluna VOLUNTÁRIO JES (RN-46): por ora todos os que preencheram o formulário contam como voluntários. Crie a coluna pelo botão "Criar abas e coluna que faltam" e preencha sim/não.');
  const ign = Object.keys(sep.ignoradas);
  if (ign.length) {
    const qtd = ign.reduce(function (n, m) { return n + sep.ignoradas[m]; }, 0);
    avisos.push('VOLUNTARIADO: ' + qtd + ' linha(s) de ' + ign.length + ' militar(es) ignorada(s) porque VOLUNTÁRIO JES não é "sim" em MILITARES (RN-46): ' +
      ign.slice(0, 5).map(function (m) { return nomesCad[m] || m; }).join(', ') + (ign.length > 5 ? '…' : '') + '.');
  }
  if (!cotas.existe) avisos.push('A aba COTAS não existe. Crie-a pelo botão "Criar abas e coluna que faltam".');
  else if (!cotas.linhas.length) avisos.push('A aba COTAS não tem cotas de ' + secao + ' em ' + mes + '.');
  if (!vol.existe) avisos.push('A aba VOLUNTARIADO não existe. Crie-a pelo botão "Criar abas e coluna que faltam".');
  if (mod.semAbas) avisos.push('As abas ESCALAS e MODELOS DE GUARNIÇÃO não existem; sem elas não há vagas por operação.');

  const diasMes = diasDoMes_(mes);
  const operacoes = [], cotasEntrada = [], ignoradas = Object.create(null);
  const nomes = [];
  cotas.linhas.forEach(function (c) { if (nomes.indexOf(c.operacao) < 0) nomes.push(c.operacao); });
  // B24 (RN-81): uma operação com cota mas sem cadastro utilizável continua na tabela (a cota aparece como restante)
  // e ganha um "problema" que diz exatamente o que falta cadastrar.
  const semCadastro = function (nome, problema) {
    const linhasCota = cotas.linhas.filter(function (c) { return normalizar_(c.operacao) === normalizar_(nome); });
    const prio = linhasCota.reduce(function (p, c) { return c.prioridade !== '' && (p === '' || c.prioridade < p) ? c.prioridade : p; }, '');
    operacoes.push({ nome: nome, servico: '', prioridade: prio, dias: [], turnos: [], problema: problema });
    linhasCota.forEach(function (c) { cotasEntrada.push({ id: c.id, operacao: nome, quantidade: c.quantidade, origem: c.origem }); });
  };
  nomes.forEach(function (nome) {
    const chave = Object.keys(mod.escalas).filter(function (k) { return normalizar_(k) === normalizar_(nome); })[0];
    if (!chave) {
      const ignorada = (mod.avisos || []).filter(function (a) {
        const m = /^ESCALAS: "(.+)" ignorada/.exec(a);
        return m && normalizar_(m[1]) === normalizar_(nome);
      })[0] || '';
      if (mod.semAbas) semCadastro(nome, '"' + nome + '" sem vagas: crie as abas ESCALAS e MODELOS DE GUARNIÇÃO e cadastre a escala, os turnos e as funções.');
      else if (ignorada.indexOf('MODELOS DE GUARNIÇÃO') >= 0) semCadastro(nome, '"' + nome + '" sem vagas: cadastre os turnos e as funções dela em MODELOS DE GUARNIÇÃO.');
      else if (ignorada) semCadastro(nome, '"' + nome + '": a escala foi ignorada porque o serviço dela não existe na aba TURNOS. Confira a coluna SERVIÇOS em ESCALAS.');
      else semCadastro(nome, '"' + nome + '" não está na aba ESCALAS: cadastre a escala (nome e serviço) em ESCALAS e os turnos e funções em MODELOS DE GUARNIÇÃO.');
      return;
    }
    const esc = mod.escalas[chave];
    if (esc.servicos.length !== 1) { semCadastro(nome, '"' + esc.nome + '" tem mais de um serviço em ESCALAS; use uma escala por serviço. Ignorada.'); return; }
    const servico = esc.servicos[0];
    let dias = diasMes;
    if (esc.dias === 'ESCALADOS') {            // só os dias em que a tabela já tem esse serviço
      const m = Object.create(null);
      reais.forEach(function (a) { if (a.servico === servico && a.dia.slice(0, 7) === mes) m[a.dia] = true; });
      dias = diasMes.filter(function (d) { return m[d]; });
      if (!dias.length) avisos.push('"' + esc.nome + '" só tem os dias já escalados e a tabela ainda não tem nenhum em ' + mes + '.');
    }
    const linhasCota = cotas.linhas.filter(function (c) { return normalizar_(c.operacao) === normalizar_(nome); });
    const prio = linhasCota.reduce(function (p, c) { return c.prioridade !== '' && (p === '' || c.prioridade < p) ? c.prioridade : p; }, '');
    operacoes.push({
      nome: esc.nome, servico: servico, prioridade: prio, dias: dias,
      turnos: esc.turnos.map(function (t) {
        return { turno: t, vagas: (esc.slots[t] || []).reduce(function (n, s) { return n + s.vagas; }, 0) };
      })
    });
    linhasCota.forEach(function (c) { cotasEntrada.push({ id: c.id, operacao: esc.nome, quantidade: c.quantidade, origem: c.origem }); });
  });

  const res = distribuirCotas_({
    mes: mes, operacoes: operacoes, cotas: cotasEntrada, militares: militares, voluntariado: sep.linhas,
    alocacoes: reais, expediente: expediente, horarios: hor.porChave, tipos: tipos
  });
  // B24: se uma operação com cota restante não gera nada, o painel diz o motivo e o que fazer
  const daSecao = sep.linhas.filter(function (v) { return vistos[v.mat]; }).length;
  const diagnostico = diagnosticarOperacoes_({
    mes: mes, secao: secao, operacoes: operacoes, res: res, horarios: hor.porChave,
    voluntariado: { linhasMes: vol.linhas.length, linhasSecao: daSecao, ignoradasJes: ign.reduce(function (n, m) { return n + sep.ignoradas[m]; }, 0) }
  });
  return { diagnostico: diagnostico, res: res, semAbas: !cotas.existe || !vol.existe || !vjes, avisos: avisos.concat(res.avisos), operacoes: operacoes, voluntarios: Object.keys(sep.linhas.reduce(function (o, v) { o[v.mat] = 1; return o; }, {})).length };
}

function cotasResumo_(c) {
  const nomes = nomesPorMatricula_();
  const r = c.res;
  const porCota = r.porCota.map(function (x) {
    return { operacao: x.operacao, servico: x.servico, origem: x.origem, recebidas: x.recebidas, distribuidas: x.distribuidas, restantes: x.restantes };
  });
  const soma = function (lista) { return lista.reduce(function (t, x) { t.recebidas += x.recebidas; t.distribuidas += x.distribuidas; t.restantes += x.restantes; return t; }, { recebidas: 0, distribuidas: 0, restantes: 0 }); };
  const porMilitar = Object.keys(r.porOperacao).map(function (nome) {
    const o = r.porOperacao[nome];
    const lista = Object.keys(o.porMilitar).sort(function (a, b) { return o.porMilitar[b] - o.porMilitar[a] || (a < b ? -1 : 1); })
      .map(function (m) { return { nome: nomes[m] || m, qtd: o.porMilitar[m] }; });
    return { operacao: nome, militares: lista };
  });
  const vazias = r.vazias.slice(0, LIMITE_VAZIAS_).map(function (v) {
    return { operacao: v.operacao, dia: dm_(v.dia), turno: v.turno, faltam: v.faltam, motivo: v.motivo };
  });
  const semCota = Object.keys(r.semCota).reduce(function (n, k) { return n + r.semCota[k]; }, 0);
  return {
    novas: r.novas.length,
    voluntarias: r.novas.filter(function (x) { return x.fase === 'voluntaria'; }).length,
    compulsorias: r.novas.filter(function (x) { return x.fase === 'compulsoria'; }).length,
    porCota: porCota,
    totalSB: soma(porCota.filter(function (x) { return x.origem !== 'externa'; })),
    totalExterno: soma(porCota.filter(function (x) { return x.origem === 'externa'; })),
    porMilitar: porMilitar,
    vazias: vazias, maisVazias: Math.max(0, r.vazias.length - vazias.length), semCota: semCota,
    semAbas: c.semAbas,
    diagnostico: c.diagnostico.map(function (d) { return d.texto; }),
    avisos: c.avisos.slice(0, 10)
  };
}

/* ------------------------------------------------------------ chamadas da tela */

/** Só calcula e mostra o resumo. Não grava nada. */
function painelCotasPrevia(mes, secao) {
  const v = validarEntrada_(mes, secao, '');
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return cotasResumo_(cotasCalcular_(v.mes, v.secao, tz));
}

/** Grava as alocações calculadas (só acrescenta; nada existente é alterado). Rodar de novo não duplica. */
function painelCotasGravar(mes, secao) {
  const v = validarEntrada_(mes, secao, '');
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const c = cotasCalcular_(v.mes, v.secao, tz);
    if (!c.res.novas.length) return { gravadas: 0, restantes: 0 };
    gravarAlocacoes_(c.res.novas.map(function (x) {
      return { mat: x.mat, dia: x.dia, servico: x.servico, turno: x.turno, funcao: '', unidade: '' };
    }), tz);
    SpreadsheetApp.flush();
    const depois = cotasCalcular_(v.mes, v.secao, tz);
    return { gravadas: c.res.novas.length, restantes: depois.res.novas.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * RN-46: cria a coluna VOLUNTÁRIO JES em MILITARES (só o cabeçalho e a lista sim/não; os valores ficam vazios
 * para o usuário preencher). Não mexe se a coluna já existe. Retorna true se criou.
 */
function garantirColunaVoluntarioJes_() {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.ABA_MILITARES);
  if (!aba) return false;
  const nCols = aba.getLastColumn();
  const cab = aba.getRange(1, 1, 1, nCols).getValues()[0].map(normalizar_);
  if (cab.some(function (c) { return c.indexOf(normalizar_('VOLUNTÁRIO JES')) === 0; })) return false;
  aba.getRange(1, nCols + 1).setValue('VOLUNTÁRIO JES').setFontWeight('bold');
  const n = aba.getLastRow() - 1;
  if (n > 0) {
    aba.getRange(2, nCols + 1, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['sim', 'não'], true).setAllowInvalid(true).build());
  }
  return true;
}

/** Cria as abas COTAS e VOLUNTARIADO (cabeçalho e uma linha de exemplo) e a coluna VOLUNTÁRIO JES de MILITARES, sem tocar no que já existe. */
function painelCotasAbas() {
  const ss = SpreadsheetApp.getActive();
  const criadas = [];
  [[COTAS_ABA.COTAS, ['MÊS', 'SB', 'OPERAÇÃO', 'SERVIÇO', 'QUANTIDADE', 'ORIGEM', 'PRIORIDADE'], ['2026-11', '1ª SB', 'PE Seguro', 'PE Seguro', 0, 'interna', 1]],
   [COTAS_ABA.VOLUNTARIADO, ['MÊS', 'MATRÍCULA', 'DIA', 'TURNO', 'SERVIÇO ACEITO'], ['2026-11', '', '', 'A', 'todos']]].forEach(function (x) {
    if (ss.getSheetByName(x[0])) return;
    const aba = ss.insertSheet(x[0]);
    aba.getRange(1, 1, 1, x[1].length).setValues([x[1]]).setFontWeight('bold').setBackground('#2F5D50').setFontColor('#FFFFFF');
    aba.getRange(2, 1, 1, x[2].length).setValues([x[2]]).setFontColor('#888888');
    aba.setFrozenRows(1);
    criadas.push(x[0]);
  });
  if (garantirColunaVoluntarioJes_()) criadas.push('coluna VOLUNTÁRIO JES (em MILITARES, vazia: preencha sim/não)');
  return { criadas: criadas };
}
