/**
 * DISTRIBUIÇÃO DO ADM — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 *
 * Reparte os turnos do serviço normal do Adm pelos dias úteis do mês, como pré-escala
 * (o escalante ajusta depois). A repartição procura equalizar, nesta ordem de importância:
 *   1. a cobertura de cada dia: quantos militares do Adm trabalham em cada dia útil;
 *   2. a distribuição de cada militar pelas semanas do mês;
 *   3. a distribuição de cada militar pelos dias da semana (sem cair sempre na segunda);
 *   4. o espaçamento entre os turnos de cada militar.
 * Todos os militares recebem o mesmo número de turnos (a carga é igual para todos).
 * O resultado é determinístico: os mesmos dados dão sempre a mesma pré-escala.
 */

// quanto cada critério pesa na escolha (maior = mais importante)
const ADM_PESO_ = { cobertura: 10, semana: 3, diaSemana: 1, posicao: 0.5 };

/** Índice da semana (segunda a domingo) em que o dia cai, contando a partir da primeira semana do mês. */
function semanaDoMes_(dia) {
  const dom = Number(dia.slice(8));
  const primeira = (diaDaSemana_(dia.slice(0, 8) + '01') + 6) % 7;   // 0 = segunda
  return Math.floor((dom - 1 + primeira) / 7);
}

/**
 * entrada: {
 *   dias:      ['aaaa-mm-dd', ...]  dias úteis do mês (sem fins de semana e feriados), em ordem
 *   turnos:    número de turnos Adm que cada militar deve ter no mês (inclui os que já tem)
 *   militares: [{ mat, ocupados: { dia: true }, jaTem: ['aaaa-mm-dd', ...] }]
 *              ocupados = dias úteis em que o turno do Adm bateria com outro serviço dele
 *              jaTem    = dias em que ele já está no Adm neste mês
 * }
 * Retorna {
 *   novas:      [{ mat, dia }]
 *   porMilitar: { mat: { ja, novas, total, faltou } }   faltou = turnos que não couberam
 *   cobertura:  { dia: quantos militares no Adm }       (inclui os que já estavam)
 * }
 */
function distribuirAdm_(entrada) {
  const dias = entrada.dias, D = dias.length, M = entrada.militares.length;
  const idx = Object.create(null);
  dias.forEach(function (d, i) { idx[d] = i; });
  const semana = dias.map(semanaDoMes_);
  const dow = dias.map(diaDaSemana_);
  const nSem = D ? Math.max.apply(null, semana) + 1 : 0;
  const diasSem = new Array(nSem).fill(0), diasDow = new Array(7).fill(0);
  for (let i = 0; i < D; i++) { diasSem[semana[i]]++; diasDow[dow[i]]++; }

  const est = entrada.militares.map(function (m, q) {
    const fixos = [];
    let fora = 0;
    (m.jaTem || []).forEach(function (d) { if (d in idx) { if (fixos.indexOf(idx[d]) < 0) fixos.push(idx[d]); } else fora++; });
    const ja = fixos.length + fora;
    let precisa = Math.max(0, entrada.turnos - ja);
    const livres = [];
    for (let i = 0; i < D; i++) if (fixos.indexOf(i) < 0 && !(m.ocupados && m.ocupados[dias[i]])) livres.push(i);
    const faltou = Math.max(0, precisa - livres.length);
    precisa -= faltou;
    return { mat: m.mat, fixos: fixos, ja: ja, livres: livres, precisa: precisa, faltou: faltou, escolhidos: [], deslocamento: M ? Math.floor(q * D / M) : 0 };
  });

  // custo individual: quão longe o conjunto de dias do militar está do ideal
  const personal = function (set) {
    const K = set.length;
    if (!K) return 0;
    const sw = new Array(nSem).fill(0), sd = new Array(7).fill(0);
    set.forEach(function (i) { sw[semana[i]]++; sd[dow[i]]++; });
    let c = 0;
    for (let w = 0; w < nSem; w++) c += ADM_PESO_.semana * Math.pow(sw[w] - K * diasSem[w] / D, 2);
    for (let w = 1; w <= 5; w++) c += ADM_PESO_.diaSemana * Math.pow(sd[w] - K * diasDow[w] / D, 2);
    const ordem = set.slice().sort(function (a, b) { return a - b; });
    const g = D / K;
    ordem.forEach(function (p, j) { c += ADM_PESO_.posicao * Math.pow(p - ((j + 0.5) * g - 0.5), 2) / g; });
    return c;
  };
  const conjunto = function (e) { return e.fixos.concat(e.escolhidos); };

  const cob = new Array(D).fill(0);
  est.forEach(function (e) { e.fixos.forEach(function (i) { cob[i]++; }); });

  // 1. montagem inicial: em cada rodada, cada militar leva o dia que menos piora o conjunto
  const maior = est.reduce(function (m, e) { return Math.max(m, e.precisa); }, 0);
  for (let r = 0; r < maior; r++) {
    for (let q = 0; q < M; q++) {
      const e = est[(q + r) % M];
      if (e.escolhidos.length >= e.precisa) continue;
      const atual = personal(conjunto(e));
      let melhor = null;
      e.livres.forEach(function (d) {
        if (e.escolhidos.indexOf(d) >= 0) return;
        const custo = ADM_PESO_.cobertura * (2 * cob[d] + 1) + personal(conjunto(e).concat([d])) - atual;
        const desempate = (d - e.deslocamento + D) % D;
        if (!melhor || custo < melhor.custo - 1e-9 || (Math.abs(custo - melhor.custo) <= 1e-9 && desempate < melhor.desempate)) melhor = { d: d, custo: custo, desempate: desempate };
      });
      if (melhor) { e.escolhidos.push(melhor.d); cob[melhor.d]++; }
    }
  }

  // 2. refinamento: troca o dia de um turno por outro enquanto isso melhorar o conjunto
  for (let passada = 0, melhorou = true; melhorou && passada < 60; passada++) {
    melhorou = false;
    est.forEach(function (e) {
      e.escolhidos.slice().forEach(function (a) {
        const base = personal(conjunto(e));
        let melhor = null;
        e.livres.forEach(function (b) {
          if (e.escolhidos.indexOf(b) >= 0) return;
          const novo = e.fixos.concat(e.escolhidos.filter(function (x) { return x !== a; })).concat([b]);
          const delta = ADM_PESO_.cobertura * (2 * (cob[b] - cob[a]) + 2) + personal(novo) - base;
          if (delta < -1e-9 && (!melhor || delta < melhor.delta)) melhor = { b: b, delta: delta };
        });
        if (melhor) {
          e.escolhidos[e.escolhidos.indexOf(a)] = melhor.b;
          cob[a]--; cob[melhor.b]++;
          melhorou = true;
        }
      });
    });
  }

  const novas = [], porMilitar = Object.create(null), cobertura = Object.create(null);
  est.forEach(function (e) {
    e.escolhidos.slice().sort(function (a, b) { return a - b; }).forEach(function (i) { novas.push({ mat: e.mat, dia: dias[i] }); });
    porMilitar[e.mat] = { ja: e.ja, novas: e.escolhidos.length, total: e.ja + e.escolhidos.length, faltou: e.faltou };
  });
  dias.forEach(function (d, i) { cobertura[d] = cob[i]; });
  return { novas: novas, porMilitar: porMilitar, cobertura: cobertura };
}

/** Menor e maior valor de uma lista de números ({ min, max }; zeros se vazia). */
function extremos_(lista) {
  if (!lista.length) return { min: 0, max: 0 };
  return { min: Math.min.apply(null, lista), max: Math.max.apply(null, lista) };
}