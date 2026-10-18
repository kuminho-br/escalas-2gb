/**
 * DISTRIBUIÇÃO DAS COTAS DAS OPERAÇÕES — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 * Regras do catálogo: RN-23 (choque), RN-24 (JES não emenda com Pronto), RN-25 (expediente do Adm),
 * RN-33/34/35 (cotas e origem), RN-36 (uma diária por dia), RN-37 (dobradinha), RN-40/41 (voluntária e
 * compulsória), RN-42 (equilíbrio), RN-51 (contagens por cota), RN-81 (vagas), RN-82 (custo da vaga).
 * Depende de nucleo.js (normalizar_), pre_escala.js (numeroDoDia_), sincronia.js (chaveAloc_) e choques.js.
 *
 * Funções (RN-81) ficam de fora por enquanto: cada turno de operação tem só um NÚMERO de vagas, a soma
 * das vagas das funções. A alocação é gravada sem função e sem unidade.
 *
 * O resultado é determinístico: os mesmos dados dão sempre a mesma distribuição.
 */

// peso de cada critério na escolha entre candidatos (menor pontuação ganha)
const COTAS_PESO_ = { equilibrio: 1, boa: 0.5 };
// serviço de tipo "Diária" (aba TURNOS, coluna TIPO DE SERVIÇO): no máximo uma por dia (RN-36)
const TIPO_DIARIA_ = 'DIARIA';
// textos dos motivos de uma vaga que ficou vazia
const COTAS_MOTIVOS_ = {
  semVoluntario: 'sem voluntário para esse dia e turno',
  semFormulario: 'ninguém preencheu o formulário do mês',
  choque: 'choque de horário',
  emenda: 'JES não pode emendar com Pronto',
  expediente: 'choca com o expediente do Adm',
  diaria: 'o militar já tem diária nesse dia',
  semHorario: 'turno sem horário legível na aba TURNOS'
};

/**
 * RN-82: quanto de cota uma vaga preenchida consome. Está "A esclarecer": hoje é 1 por militar por turno.
 * Para mudar a regra, mude só esta função.
 */
function custoDaVaga_(operacao, vaga) { return 1; }

/**
 * entrada: {
 *   mes:         'aaaa-mm'
 *   operacoes:   [{ nome, servico, prioridade, dias: ['aaaa-mm-dd'], turnos: [{ turno, vagas }] }]
 *                (turnos na ordem da aba TURNOS; vagas = tamanho da guarnição do turno)
 *   cotas:       [{ id, operacao, quantidade, origem: 'interna'|'externa' }]   (na ordem em que consomem)
 *   militares:   [{ mat }]        a seção; a ordem desempata
 *   voluntariado:[{ mat, dia, turno, servico }]   servico '' ou 'todos' = qualquer serviço
 *   alocacoes:   [{ mat, dia, servico, turno }]   TODAS as da tabela, de todos os meses
 *   expediente:  [{ mat, dia, servico, turno }]   expediente implícito do Adm (só para checar choques)
 *   horarios:    o porChave de montarHorarios_
 *   tipos:       { 'Serviço': 'Tipo' }   da aba TURNOS
 * }
 * Retorna {
 *   novas:    [{ mat, dia, servico, turno, operacao, fase: 'voluntaria'|'compulsoria' }]
 *   porCota:  [{ id, operacao, servico, origem, recebidas, distribuidas, restantes }]
 *   porOperacao: { nome: { servico, recebidas, distribuidas, restantes, novas, porMilitar: { mat: qtd } } }
 *   vazias:   [{ operacao, servico, dia, turno, faltam, motivo }]   (só onde ainda havia cota)
 *   semCota:  { operacao: vagas que nem foram tentadas porque a cota acabou }
 *   avisos:   [texto]
 * }
 */
function distribuirCotas_(e) {
  const avisos = [];
  const horarios = e.horarios || {}, tipos = e.tipos || {};
  const eDiaria = function (servico) { return normalizar_(tipos[servico] || '') === TIPO_DIARIA_; };

  // posição de cada militar da seção (desempate) e quem preencheu o formulário do mês (RN-41)
  const ordem = Object.create(null);
  e.militares.forEach(function (m, i) { if (!(m.mat in ordem)) ordem[m.mat] = i; });
  const noFormulario = Object.create(null), vol = Object.create(null);
  e.voluntariado.forEach(function (v) {
    if (!(v.mat in ordem)) return;
    noFormulario[v.mat] = true;
    const k = v.dia + '|' + v.turno;
    (vol[k] = vol[k] || []).push({ mat: v.mat, servico: normalizar_(v.servico || '') });
  });

  // alocações de cada militar (reais e expediente implícito)
  const A = Object.create(null);
  const guarda = function (a, implicito) {
    const h = horarios[a.servico + '|' + a.turno];
    const x = { mat: a.mat, dia: a.dia, servico: a.servico, turno: a.turno, implicito: !!implicito, ini: null, fim: null };
    if (h) { x.ini = numeroDoDia_(a.dia) * 1440 + h.ini; x.fim = x.ini + h.dur; }
    (A[a.mat] = A[a.mat] || []).push(x);
  };
  e.alocacoes.forEach(function (a) { guarda(a, false); });
  (e.expediente || []).forEach(function (a) { guarda(a, true); });

  // quantas alocações de operação cada militar tem no mês (base do equilíbrio)
  const servicosDeCota = Object.create(null);
  e.operacoes.forEach(function (o) { servicosDeCota[o.servico] = true; });
  const usados = Object.create(null);
  e.alocacoes.forEach(function (a) {
    if (a.dia.slice(0, 7) === e.mes && servicosDeCota[a.servico]) usados[a.mat] = (usados[a.mat] || 0) + 1;
  });

  // estado de cada operação
  const ops = e.operacoes.slice().sort(function (x, y) {
    const px = x.prioridade == null || x.prioridade === '' ? 1e9 : Number(x.prioridade);
    const py = y.prioridade == null || y.prioridade === '' ? 1e9 : Number(y.prioridade);
    return px - py || (x.nome < y.nome ? -1 : x.nome > y.nome ? 1 : 0);
  }).map(function (o) {
    const cotas = e.cotas.filter(function (c) { return c.operacao === o.nome; });
    const recebidas = cotas.reduce(function (s, c) { return s + (Number(c.quantidade) || 0); }, 0);
    const ocup = Object.create(null), porMilitar = Object.create(null);
    let existentes = 0;
    e.alocacoes.forEach(function (a) {
      if (a.servico !== o.servico || a.dia.slice(0, 7) !== e.mes) return;
      const k = a.dia + '|' + a.turno;
      ocup[k] = (ocup[k] || 0) + 1;
      existentes += custoDaVaga_(o, a);
      porMilitar[a.mat] = (porMilitar[a.mat] || 0) + 1;
    });
    if (existentes > recebidas) avisos.push('"' + o.nome + '": a tabela já tem ' + existentes + ' alocações do mês, mais que a cota recebida (' + recebidas + ').');
    if (!cotas.length) avisos.push('"' + o.nome + '": não há cota cadastrada para o mês; nada será distribuído.');
    return { def: o, cotas: cotas, recebidas: recebidas, existentes: existentes, novasN: 0, restante: Math.max(0, recebidas - existentes), ocup: ocup, porMilitar: porMilitar };
  });

  // vagas de cada operação, em ordem de dia e de turno
  const slots = [];
  ops.forEach(function (op) {
    op.slots = [];
    op.def.dias.slice().sort().forEach(function (dia) {
      op.def.turnos.forEach(function (t) {
        const ja = op.ocup[dia + '|' + t.turno] || 0, total = Math.max(0, Number(t.vagas) || 0);
        if (!horarios[op.def.servico + '|' + t.turno]) return;
        const s = { op: op, dia: dia, turno: t.turno, total: total, need: Math.max(0, total - ja), preenchidas: ja, rej: Object.create(null), tentou: false, semVol: false, fase: '' };
        op.slots.push(s);
      });
    });
    op.def.turnos.forEach(function (t) {
      if (!horarios[op.def.servico + '|' + t.turno]) avisos.push('"' + op.def.nome + '": ' + COTAS_MOTIVOS_.semHorario + ' (' + op.def.servico + ' ' + t.turno + '); turno ignorado.');
    });
  });

  const novas = [];

  /** null se o militar pode ficar na vaga; senão a chave do motivo da recusa. */
  function recusa(mat, slot) {
    const h = horarios[slot.op.def.servico + '|' + slot.turno];
    const cand = { mat: mat, dia: slot.dia, servico: slot.op.def.servico, turno: slot.turno };
    const lista = A[mat] || [];
    const ini = numeroDoDia_(slot.dia) * 1440 + h.ini;
    for (let i = 0; i < lista.length; i++) {
      const x = lista[i];
      if (!x.implicito && x.dia === cand.dia && x.servico === cand.servico && x.turno === cand.turno) return 'jaNaVaga';
      if (!x.implicito && x.dia === cand.dia && eDiaria(cand.servico) && eDiaria(x.servico)) return 'diaria';
    }
    const perto = lista.filter(function (x) { return x.ini !== null && Math.abs(x.ini - ini) < 3 * 1440; });
    const r = detectarChoques_(perto.concat([cand]), horarios, {});
    const minha = chaveAloc_(cand);
    const achou = r.choques.filter(function (c) { return c.a.chave === minha || c.b.chave === minha; });
    if (!achou.length) return null;
    const tipo = achou[0].tipo;
    return tipo === 'emenda' ? 'emenda' : tipo === 'expediente' ? 'expediente' : 'choque';
  }

  /** Quanto menor, melhor: quem tem menos cotas consumidas; combinação boa (RN-42) desempata. */
  function pontuacao(mat, slot) {
    const h = horarios[slot.op.def.servico + '|' + slot.turno];
    const ini = numeroDoDia_(slot.dia) * 1440 + h.ini, fim = ini + h.dur;
    let boa = 0;
    (A[mat] || []).forEach(function (x) {
      if (x.implicito || x.ini === null) return;
      const encosta = x.fim === ini || x.ini === fim;
      if (!encosta) return;
      if (eDiaria(slot.op.def.servico) && eDiaria(x.servico)) boa = 1;                                    // S-01 dobradinha
      else if (x.fim === ini && normalizar_(x.servico) === 'PRONTO' && eDiaria(slot.op.def.servico)) boa = 1; // S-02 saída do Pronto
    });
    return COTAS_PESO_.equilibrio * (usados[mat] || 0) - COTAS_PESO_.boa * boa;
  }

  function candidatos(slot, fase) {
    if (fase === 'voluntaria') {
      const l = vol[slot.dia + '|' + slot.turno] || [];
      const serv = normalizar_(slot.op.def.servico);
      const mats = [];
      l.forEach(function (v) {
        if ((v.servico === '' || v.servico === 'TODOS' || v.servico === serv) && mats.indexOf(v.mat) < 0) mats.push(v.mat);
      });
      return mats;
    }
    return Object.keys(noFormulario);
  }

  function preencher(slot, fase) {
    const op = slot.op;
    slot.tentou = true;
    while (slot.need > 0 && op.restante > 0) {
      const cands = candidatos(slot, fase);
      if (fase === 'voluntaria' && !cands.length) slot.semVol = true;
      let melhor = null, melhorPt = 0;
      cands.forEach(function (mat) {
        const r = recusa(mat, slot);
        if (r) { if (r !== 'jaNaVaga') slot.rej[r] = (slot.rej[r] || 0) + 1; return; }
        const pt = pontuacao(mat, slot);
        if (melhor === null || pt < melhorPt || (pt === melhorPt && ordem[mat] < ordem[melhor])) { melhor = mat; melhorPt = pt; }
      });
      if (melhor === null) break;
      guarda({ mat: melhor, dia: slot.dia, servico: op.def.servico, turno: slot.turno }, false);
      usados[melhor] = (usados[melhor] || 0) + 1;
      op.porMilitar[melhor] = (op.porMilitar[melhor] || 0) + 1;
      op.restante -= custoDaVaga_(op.def, slot);
      op.novasN++;
      slot.need--; slot.preenchidas++;
      novas.push({ mat: melhor, dia: slot.dia, servico: op.def.servico, turno: slot.turno, operacao: op.def.nome, fase: fase });
    }
  }

  // fase voluntária (RN-40): todas as operações, na ordem de prioridade
  ops.forEach(function (op) { op.slots.forEach(function (s) { preencher(s, 'voluntaria'); }); });
  // fase compulsória (RN-40, RN-41): só quem preencheu o formulário; completa primeiro as guarnições já começadas
  ops.forEach(function (op) {
    const comeco = op.slots.filter(function (s) { return s.need > 0 && s.preenchidas > 0; });
    const vazios = op.slots.filter(function (s) { return s.need > 0 && s.preenchidas === 0; });
    comeco.concat(vazios).forEach(function (s) { preencher(s, 'compulsoria'); });
  });

  // vagas que ficaram vazias, com o motivo
  const vazias = [], semCota = Object.create(null);
  ops.forEach(function (op) {
    op.slots.forEach(function (s) {
      if (s.need <= 0) return;
      if (op.restante <= 0 && !s.tentou) return;
      if (op.restante <= 0) { semCota[op.def.nome] = (semCota[op.def.nome] || 0) + s.need; return; }
      let motivo;
      const rej = Object.keys(s.rej).sort(function (a, b) { return s.rej[b] - s.rej[a]; });
      if (!Object.keys(noFormulario).length) motivo = COTAS_MOTIVOS_.semFormulario;
      else if (rej.length) motivo = COTAS_MOTIVOS_[rej[0]];
      else if (s.semVol) motivo = COTAS_MOTIVOS_.semVoluntario;
      else motivo = COTAS_MOTIVOS_.semVoluntario;
      vazias.push({ operacao: op.def.nome, servico: op.def.servico, dia: s.dia, turno: s.turno, faltam: s.need, motivo: motivo });
    });
    // vagas que nem foram olhadas porque a cota acabou antes
    op.slots.forEach(function (s) {
      if (s.need > 0 && !s.tentou) semCota[op.def.nome] = (semCota[op.def.nome] || 0) + s.need;
    });
  });
  // (uma vaga tentada e vazia com cota acabada já entrou em semCota acima; evita contar duas vezes)

  // contagens por cota (RN-51): o consumo preenche as cotas na ordem em que foram cadastradas
  const porCota = [], porOperacao = Object.create(null);
  ops.forEach(function (op) {
    let resta = op.existentes + op.novasN;
    op.cotas.forEach(function (c) {
      const q = Number(c.quantidade) || 0, d = Math.min(q, resta);
      resta -= d;
      porCota.push({ id: c.id, operacao: op.def.nome, servico: op.def.servico, origem: c.origem || 'interna', recebidas: q, distribuidas: d, restantes: q - d });
    });
    if (resta > 0 && op.cotas.length) porCota[porCota.length - 1].distribuidas += resta;
    porOperacao[op.def.nome] = {
      servico: op.def.servico, recebidas: op.recebidas, distribuidas: op.existentes + op.novasN,
      restantes: Math.max(0, op.recebidas - op.existentes - op.novasN), novas: op.novasN, porMilitar: op.porMilitar
    };
  });

  return { novas: novas, porCota: porCota, porOperacao: porOperacao, vazias: vazias, semCota: semCota, avisos: avisos };
}

/**
 * B24 (RN-81, RN-40, RN-41): por que uma operação com cota restante não gera nenhuma alocação, e o que fazer.
 * Só fala das operações que têm cota restante e nenhuma alocação nova. Retorna [{ operacao, texto }].
 *
 * e: {
 *   mes, secao,
 *   operacoes: as da entrada de distribuirCotas_ ([{ nome, servico, dias, turnos: [{ turno, vagas }], problema? }])
 *              problema = texto pronto quando a operação nem tem cadastro utilizável (falta ESCALAS/MODELOS)
 *   res:       o retorno de distribuirCotas_
 *   horarios:  o porChave de montarHorarios_
 *   voluntariado: { linhasMes, linhasSecao, ignoradasJes }   quantas linhas do VOLUNTARIADO: no mês; no mês e da seção
 *              (já sem as ignoradas pelo VOLUNTÁRIO JES); e quantas foram ignoradas por esse atributo (RN-46)
 * }
 */
function diagnosticarOperacoes_(e) {
  const res = [];
  const vol = e.voluntariado || { linhasMes: 0, linhasSecao: 0, ignoradasJes: 0 };
  (e.operacoes || []).forEach(function (o) {
    const p = e.res.porOperacao[o.nome];
    if (!p || p.novas > 0 || p.restantes <= 0) return;
    const nome = '"' + o.nome + '"';
    if (o.problema) { res.push({ operacao: o.nome, texto: o.problema }); return; }
    if (!o.dias.length) {
      res.push({ operacao: o.nome, texto: nome + ' sem dias: a escala só usa os dias já escalados (ESCALAS, coluna DIAS) e a tabela não tem nenhum em ' + e.mes + '. Escale esses dias ou mude DIAS para TODOS.' });
      return;
    }
    const vagasPorDia = o.turnos.reduce(function (n, t) { return e.horarios[o.servico + '|' + t.turno] ? n + (Number(t.vagas) || 0) : n; }, 0);
    if (vagasPorDia <= 0) {
      res.push({ operacao: o.nome, texto: nome + ' sem vagas: cadastre os turnos e as funções em MODELOS DE GUARNIÇÃO (e confira se os turnos têm horário na aba TURNOS).' });
      return;
    }
    // há vagas: ninguém pôde ocupá-las. O motivo que mais se repete explica o resto.
    const mine = e.res.vazias.filter(function (v) { return v.operacao === o.nome; });
    const faltam = mine.reduce(function (n, v) { return n + v.faltam; }, 0);
    if (!mine.length) return;
    const cont = Object.create(null);
    mine.forEach(function (v) { cont[v.motivo] = (cont[v.motivo] || 0) + v.faltam; });
    const motivo = Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; })[0];
    let causa;
    if (motivo === COTAS_MOTIVOS_.semFormulario) {
      if (vol.linhasMes === 0) causa = 'A aba VOLUNTARIADO não tem nenhuma linha de ' + e.mes + '.';
      else causa = 'A aba VOLUNTARIADO tem ' + vol.linhasMes + ' linha(s) de ' + e.mes + ', mas nenhuma de militar da ' + e.secao + ' (confira a matrícula e a SEÇÃO em MILITARES).';
      if (vol.ignoradasJes > 0) causa += ' ' + vol.ignoradasJes + ' linha(s) foram ignoradas porque VOLUNTÁRIO JES não é "sim" em MILITARES (RN-46).';
      causa += ' Preencha o VOLUNTARIADO (uma linha por militar, dia e turno) e analise de novo.';
    } else if (motivo === COTAS_MOTIVOS_.semVoluntario) {
      causa = 'Ninguém se voluntariou para esses dias e turnos. Cadastre mais voluntários no VOLUNTARIADO.';
    } else {
      causa = 'Motivo mais comum: ' + motivo + '. Libere horários dos militares ou cadastre mais voluntários.';
    }
    res.push({ operacao: o.nome, texto: nome + ': ' + faltam + ' vaga(s) sem ninguém e nenhuma alocação a gerar. ' + causa });
  });
  return res;
}
