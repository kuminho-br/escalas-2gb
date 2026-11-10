/**
 * ESCALA DO ORDINÁRIO (formato oficial) — camada do Google Sheets.
 * Depende de nucleo.gs, matriz.gs, choques.gs, guarnicao.gs, guarnicao_painel.gs (cabeçalho e
 * mesPorExtenso_), cadastro_guarnicoes_painel.gs (ordem das unidades) e escala_op.gs (a montagem).
 * Botão no painel "Escalas de Serviço" (sidebar_guarnicao.html).
 *
 * B40 (RN-05, RN-13, RN-49): escreve a visualização na aba ESCALA DO ORDINÁRIO, no formato do
 * documento oficial. Só lê alocações; não grava nada na tabela.
 */

const ESCALA_OP_ABA = 'ESCALA DO ORDINÁRIO';   // B52: chamava-se ESCALA OPERACIONAL; abaAtual_ renomeia a antiga

/**
 * Ordem das unidades táticas e das funções de cada uma, para a visualização sair na ordem do
 * cadastro e não em ordem alfabética: a prioridade de ativação da aba GUARNIÇÕES (RN-08) e a ordem
 * das linhas de MODELOS DE GUARNIÇÃO. O que não estiver cadastrado vai depois, em ordem alfabética.
 */
function ordemDoCadastro_(mes, tz) {
  const ordemUnidades = Object.create(null), ordemFuncoes = Object.create(null);
  let i = 0;
  guarnicoesDoMes_(mes, tz).guarnicoes.forEach(function (g) { ordemUnidades[normalizar_(g.id)] = ++i; });
  const mod = lerModelosGuarnicao_();
  Object.keys(mod.escalas || {}).forEach(function (nome) {
    const e = mod.escalas[nome];
    e.turnos.forEach(function (t) {
      (e.slots[t] || []).forEach(function (s) {
        const u = normalizar_(s.unidade);
        if (!(u in ordemFuncoes)) ordemFuncoes[u] = Object.create(null);
        const f = normalizar_(s.funcao);
        if (!(f in ordemFuncoes[u])) ordemFuncoes[u][f] = Object.keys(ordemFuncoes[u]).length + 1;
        if (s.unidade && !(u in ordemUnidades)) ordemUnidades[u] = ++i;
      });
    });
  });
  return { ordemUnidades: ordemUnidades, ordemFuncoes: ordemFuncoes };
}

/** A visualização de um mês, pronta para a tela ou para a aba. */
function escalaOperacionalDoMes_(mes, tz) {
  const hor = lerHorarios_();
  const mil = Object.create(null);
  lerMilitares_().forEach(function (m) { if (!(m.mat in mil)) mil[m.mat] = { posto: m.posto, nome: m.nome, antig: m.antig, ordem: m.ordem }; });
  const ord = ordemDoCadastro_(mes, tz);
  return montarEscalaOperacional_(lerAlocacoes_(tz).alocs, {
    mes: mes, militares: mil, horarios: hor.porChave,
    origens: GUARN_VINCULOS_,                      // RN-13: 'JES' aparece como 'PJES', como já era
    ordemUnidades: ord.ordemUnidades, ordemFuncoes: ord.ordemFuncoes
  });
}

/** Escreve a visualização na aba ESCALA DO ORDINÁRIO e devolve o resumo para a tela. */
function painelEscalaOperacional(mes) {
  mes = String(mes == null ? '' : mes).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const doc = escalaOperacionalDoMes_(mes, tz);

  const aba = abaAtual_(ss, ESCALA_OP_ABA) || ss.insertSheet(ESCALA_OP_ABA);
  aba.clear();
  aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).breakApart();

  const nCols = 2;
  const topo = GUARN_CABECALHO_.concat(['', 'ESCALA DE SERVIÇO - ' + mesPorExtenso_(mes) +
    (doc.periodo ? ' (' + formatarDia_(doc.periodo.de) + ' a ' + formatarDia_(doc.periodo.ate) + ')' : '')]);
  topo.forEach(function (t, i) {
    aba.getRange(i + 1, 1, 1, nCols).merge().setValue(t).setHorizontalAlignment('center')
      .setFontWeight(i === 1 || i === 2 || i === topo.length - 1 ? 'bold' : 'normal');
  });
  aba.getRange(topo.length, 1, 1, nCols).setFontSize(12);

  // uma linha por faixa de dia, faixa de unidade/turno e linha de função-origem
  const linhas = [];                                    // { tipo, a, b }
  doc.dias.forEach(function (d) {
    linhas.push({ tipo: 'dia', a: formatarDia_(d.dia) + ' - ' + GUARN_DIAS_SEMANA_[diaDaSemana_(d.dia)], b: '' });
    d.blocos.forEach(function (b) {
      linhas.push({ tipo: 'bloco', a: b.titulo, b: '' });
      b.linhas.forEach(function (l) { linhas.push({ tipo: 'linha', a: l.rotulo, b: l.texto }); });
    });
  });

  let r = topo.length + 1;
  if (!linhas.length) {
    aba.getRange(r, 1, 1, nCols).merge().setValue('Nenhuma alocação em ' + mesPorExtenso_(mes) + '.').setHorizontalAlignment('center');
  } else {
    aba.getRange(r, 1, linhas.length, nCols).setNumberFormat('@')
      .setValues(linhas.map(function (l) { return [l.a, l.b]; }));
    linhas.forEach(function (l, i) {
      const faixa = aba.getRange(r + i, 1, 1, nCols);
      if (l.tipo === 'dia') {
        faixa.merge().setBackground('#2F5D50').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
      } else if (l.tipo === 'bloco') {
        faixa.merge().setBackground('#D9D9D9').setFontWeight('bold');
      } else {
        aba.getRange(r + i, 1).setFontWeight('bold');
      }
      faixa.setVerticalAlignment('middle');
    });
  }
  aba.setColumnWidth(1, 320);
  aba.setColumnWidth(2, 520);
  aba.setFrozenRows(topo.length);
  ss.setActiveSheet(aba);

  return {
    aba: ESCALA_OP_ABA, mes: mes, totais: doc.totais, avisos: doc.avisos,
    linhas: linhas.length,
    exemplo: doc.dias.length ? { dia: formatarDia_(doc.dias[0].dia), blocos: doc.dias[0].blocos.map(function (b) { return b.titulo; }) } : null
  };
}
