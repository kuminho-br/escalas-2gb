/**
 * ESCALA DO ORDINÁRIO (formato oficial) — lógica pura (sem SpreadsheetApp).
 * Depende de nucleo.gs (normalizar_, diasDoMes_, diaDaSemana_) e de guarnicao.gs (horaCompleta_).
 *
 * B40 (RN-05, RN-13, RN-49): monta a visualização da escala no formato do documento oficial
 * (ESCALAOP), de fora para dentro:
 *
 *   DIA (01/10/2026)
 *     UNIDADE TÁTICA - Nº TURNO (08:00 - 20:00)
 *       FUNÇÃO - ORIGEM .......... POSTO MATRÍCULA NOME | POSTO MATRÍCULA NOME
 *
 * É só visualização: tudo sai das alocações que JÁ existem. Não há gabarito de guarnição — a
 * composição de cada unidade muda de dia para dia e aqui ela é montada pelo que está alocado,
 * nunca por uma lista fixa. Função sem militar alocado não gera linha.
 *
 * ORIGEM (RN-13) é o serviço que levou o militar àquele posto (PRONTO, SALDO, PJES), no mesmo
 * formato que guarnicao.gs já usa no nome da função ("MOTORISTA - PJES"). Duas vagas da mesma
 * função E da mesma origem no mesmo turno ficam na MESMA linha, separadas por " | "; origens
 * diferentes viram linhas diferentes.
 *
 * Funções compostas ("MOTORISTA / CHEFE") e "MOTORISTA 12H" são exibidas como estão gravadas
 * (P-25 e P-26 em aberto): esta visualização não interpreta nome de função.
 */

/** 'JES' -> 'PJES'; o resto vira o próprio nome em maiúsculas. origens = { JES: 'PJES' }. */
function origemDoServico_(servico, origens) {
  const k = normalizar_(servico);
  const mapa = origens || {};
  const achou = Object.keys(mapa).filter(function (x) { return normalizar_(x) === k; })[0];
  return normalizar_(achou ? mapa[achou] : servico) === '' ? '' : String(achou ? mapa[achou] : servico).toUpperCase();
}

/** Ordem dos turnos pelo horário de início no catálogo: { A: 1, B: 2, C: 3 }. */
function ordemDosTurnos_(horarios) {
  const ini = Object.create(null);
  Object.keys(horarios || {}).forEach(function (k) {
    const turno = k.split('|')[1], h = horarios[k];
    if (!turno || !h) return;
    if (!(turno in ini) || h.ini < ini[turno]) ini[turno] = h.ini;
  });
  const ordem = Object.create(null);
  Object.keys(ini).sort(function (a, b) { return ini[a] === ini[b] ? (a < b ? -1 : 1) : ini[a] - ini[b]; })
    .forEach(function (t, i) { ordem[t] = i + 1; });
  return ordem;
}

function ordinalPt_(n) { return n + 'º'; }

/**
 * alocs: [{ mat, dia, servico, turno, funcao, unidade }] (só as do mês interessam)
 * opcoes: {
 *   mes, militares: { matrícula: { posto, nome, antig, ordem } }, horarios: porChave,
 *   origens: { JES: 'PJES' }, ordemUnidades: { UNIDADE: n }, ordemFuncoes: { UNIDADE: { FUNÇÃO: n } },
 *   semUnidadeRotulo
 * }
 * Retorna { mes, periodo, dias, totais, avisos }.
 */
function montarEscalaOperacional_(alocs, opcoes) {
  opcoes = opcoes || {};
  const mes = opcoes.mes;
  const mil = opcoes.militares || {};
  const horarios = opcoes.horarios || {};
  const ordTurno = ordemDosTurnos_(horarios);
  const ordUni = opcoes.ordemUnidades || {};
  const ordFunc = opcoes.ordemFuncoes || {};
  const SEM_UNIDADE = opcoes.semUnidadeRotulo || '(SEM UNIDADE NA ALOCAÇÃO)';
  const avisos = [];

  const doMes = alocs.filter(function (a) { return a.dia && a.dia.slice(0, 7) === mes; });
  let semUnidade = 0, semFuncao = 0;

  // dia -> unidade -> turno -> (função|origem) -> militares
  const porDia = Object.create(null);
  doMes.forEach(function (a) {
    const uni = String(a.unidade == null ? '' : a.unidade).trim();
    if (!uni) semUnidade++;
    const funcao = String(a.funcao == null ? '' : a.funcao).trim();
    if (!funcao) semFuncao++;
    const unidade = uni || SEM_UNIDADE;
    const d = porDia[a.dia] = porDia[a.dia] || Object.create(null);
    const u = d[unidade] = d[unidade] || Object.create(null);
    const t = u[a.turno] = u[a.turno] || { servicos: Object.create(null), linhas: Object.create(null) };
    t.servicos[a.servico] = (t.servicos[a.servico] || 0) + 1;
    const origem = origemDoServico_(a.servico, opcoes.origens);
    const rotulo = (funcao || '(SEM FUNÇÃO)') + (origem ? ' - ' + origem : '');
    const l = t.linhas[rotulo] = t.linhas[rotulo] || { rotulo: rotulo, funcao: funcao, origem: origem, mats: [] };
    if (l.mats.indexOf(a.mat) < 0) l.mats.push(a.mat);
  });
  if (semUnidade) avisos.push(semUnidade + ' alocação(ões) do mês estão sem UNIDADE e aparecem em "' + SEM_UNIDADE + '". Preencha a UNIDADE na aba de alocações (ou na grade de guarnição) para elas entrarem na unidade tática certa.');
  if (semFuncao) avisos.push(semFuncao + ' alocação(ões) do mês estão sem FUNÇÃO e aparecem como "(SEM FUNÇÃO)". Use "Alocar em Função" na escala para preencher.');

  const textoMilitar = function (mat) {
    const m = mil[mat];
    if (!m) return mat;
    return [m.posto, mat, m.nome].map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean).join(' ');
  };
  const antigDe = function (mat) {
    const m = mil[mat] || {};
    const a = Number(m.antig);
    return isFinite(a) && m.antig !== '' && m.antig != null ? a : Infinity;
  };
  const ordemDe = function (mat) { const m = mil[mat] || {}; return m.ordem == null ? Infinity : m.ordem; };

  const dias = Object.keys(porDia).sort().map(function (dia) {
    const unidades = Object.keys(porDia[dia]).sort(function (a, b) {
      const pa = ordUni[normalizar_(a)], pb = ordUni[normalizar_(b)];
      const na = pa == null ? Infinity : pa, nb = pb == null ? Infinity : pb;
      if (na !== nb) return na - nb;
      return a < b ? -1 : (a > b ? 1 : 0);
    });
    const blocos = [];
    unidades.forEach(function (unidade) {
      const porTurno = porDia[dia][unidade];
      Object.keys(porTurno).sort(function (a, b) {
        const na = ordTurno[a] == null ? Infinity : ordTurno[a], nb = ordTurno[b] == null ? Infinity : ordTurno[b];
        return na === nb ? (a < b ? -1 : 1) : na - nb;
      }).forEach(function (turno) {
        const t = porTurno[turno];
        // horário do turno: do serviço predominante do bloco (um bloco pode misturar origens com
        // horários diferentes; vale o de quem tem mais militares ali)
        let h = null;
        Object.keys(t.servicos)
          .sort(function (a, b) { return t.servicos[a] === t.servicos[b] ? (a < b ? -1 : 1) : t.servicos[b] - t.servicos[a]; })
          .some(function (s) { h = horarios[s + '|' + turno] || null; return !!h; });
        const nTurno = ordTurno[turno];
        const nome = (nTurno ? ordinalPt_(nTurno) + ' TURNO' : 'TURNO ' + turno) +
          (h ? ' (' + horaCompleta_(h.ini) + ' - ' + horaCompleta_(h.fim) + ')' : '');
        const daUnidade = ordFunc[normalizar_(unidade)] || {};
        const linhas = Object.keys(t.linhas).map(function (k) { return t.linhas[k]; }).sort(function (a, b) {
          const pa = daUnidade[normalizar_(a.funcao)], pb = daUnidade[normalizar_(b.funcao)];
          const na = pa == null ? Infinity : pa, nb = pb == null ? Infinity : pb;
          if (na !== nb) return na - nb;
          if (a.funcao !== b.funcao) return a.funcao < b.funcao ? -1 : 1;
          return a.origem < b.origem ? -1 : (a.origem > b.origem ? 1 : 0);
        }).map(function (l) {
          const mats = l.mats.slice().sort(function (x, y) {
            const ax = antigDe(x), ay = antigDe(y);
            if (ax !== ay) return ax - ay;
            const ox = ordemDe(x), oy = ordemDe(y);
            return ox === oy ? (x < y ? -1 : 1) : ox - oy;
          });
          return { rotulo: l.rotulo, funcao: l.funcao, origem: l.origem, mats: mats, militares: mats.map(textoMilitar), texto: mats.map(textoMilitar).join(' | ') };
        });
        blocos.push({ unidade: unidade, turno: turno, horario: h ? horaCompleta_(h.ini) + ' - ' + horaCompleta_(h.fim) : '', titulo: unidade.toUpperCase() + ' - ' + nome, linhas: linhas });
      });
    });
    return { dia: dia, blocos: blocos };
  });

  const todosOsDias = mes ? diasDoMes_(mes) : [];
  return {
    mes: mes,
    periodo: todosOsDias.length ? { de: todosOsDias[0], ate: todosOsDias[todosOsDias.length - 1] } : null,
    dias: dias,
    totais: {
      alocacoes: doMes.length,
      diasComEscala: dias.length,
      militares: Object.keys(doMes.reduce(function (o, a) { o[a.mat] = true; return o; }, Object.create(null))).length,
      semUnidade: semUnidade,
      semFuncao: semFuncao
    },
    avisos: avisos
  };
}
