/**
 * SINCRONIA escala -> tabela — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 *
 * CHAVE DA ALOCAÇÃO: matrícula + dia + serviço + turno. A linha da grade da escala NÃO
 * faz parte da chave: ela é só um espaço para mostrar o 1º, o 2º... serviço do dia.
 * Por isso "Bioma A" e "Pronto A" no mesmo dia são alocações diferentes, e mover um
 * serviço de uma linha para outra não muda nada na tabela.
 *
 * Comparação em TRÊS vias, sempre pela chave:
 *   base   = a escala como foi desenhada (cópia de referência guardada na aba oculta);
 *   escala = a escala como está agora (com as suas edições);
 *   tabela = ALOCAÇÕES TABULADAS como está agora.
 *
 * "O que você mudou" = escala × base. Cada mudança só é aplicada se a tabela ainda
 * estiver como estava na base para aquela chave.
 *
 *   inclusão  : serviço que apareceu na escala         -> nova linha na tabela
 *   exclusão  : serviço que saiu da escala             -> remove a linha
 *   troca     : um serviço sai e outro entra no mesmo militar e dia (a célula mudou de serviço)
 *               -> remove a linha antiga e cria a nova; a FUNÇÃO e a UNIDADE da antiga se perdem.
 *               Se a tabela já não tem a linha antiga (outra pessoa mexeu), vira CONFLITO e não é gravada.
 *
 * Serviço e turno que não existem na aba TURNOS são INVÁLIDOS: essa célula é pulada e avisada,
 * e o resto é gravado normalmente. Texto de célula que não se entende também.
 */

function chaveAloc_(a) { return a.mat + '|' + a.dia + '|' + a.servico + '|' + a.turno; }

/** chave -> { mat, dia, servico, turno }. O serviço é tudo entre o dia e o último "|". */
function partesDaChave_(k) {
  const p = k.split('|');
  return { mat: p[0], dia: p[1], servico: p.slice(2, -1).join('|'), turno: p[p.length - 1] };
}

/** chave -> serviço (se a lista repetir a chave, vale a primeira). */
function mapaServicos_(lista) {
  const m = Object.create(null);
  lista.forEach(function (a) { const k = chaveAloc_(a); if (!(k in m)) m[k] = a.servico; });
  return m;
}

/**
 * base, escala: [{ mat, dia, servico, turno }]
 * tabela: [{ mat, dia, servico, turno, linha }]   (só as linhas dos dias da escala)
 * catalogoPares: { 'Serviço|Turno': true }   (vazio/ausente = não valida)
 * opcoes: { horarios, todas, ilegiveis, regras }   horarios/todas ativam o bloqueio por choque;
 *         regras (o contexto de regras_escala.js) + todas ativam o bloqueio por regra da escala (RN-03...);
 *         ilegiveis: [{ mat, dia, texto }] células da escala cujo texto não foi entendido
 */
function calcularSincronizacao_(base, escala, tabela, catalogoPares, opcoes) {
  opcoes = opcoes || {};
  const B = mapaServicos_(base), M = mapaServicos_(escala);

  const T = Object.create(null), doDia = Object.create(null);
  tabela.forEach(function (a) {
    const k = chaveAloc_(a);
    if (!T[k]) { T[k] = []; const d = a.mat + '|' + a.dia; (doDia[d] = doDia[d] || []).push(a); }
    T[k].push(a.linha);
  });

  const validar = !!catalogoPares && Object.keys(catalogoPares).length > 0;
  const res = { inserir: [], remover: [], atualizar: [], conflitos: [], invalidas: [], choques: [], regras: [], jaAplicadas: [], aplicadas: [] };

  const par = function (k) { const p = partesDaChave_(k); return { servico: p.servico, turno: p.turno }; };
  const item = function (k, tipo, de, para, extra) {
    const p = partesDaChave_(k);
    return Object.assign({ chave: k, mat: p.mat, dia: p.dia, servico: p.servico, turno: p.turno, tipo: tipo, de: de || null, para: para || null }, extra || {});
  };
  const parValido = function (k) { const p = partesDaChave_(k); return !validar || !!catalogoPares[p.servico + '|' + p.turno]; };

  // o que mudou na escala: chaves que entraram e chaves que saíram
  const entrou = [], saiu = [];
  Object.keys(Object.assign(Object.create(null), B, M)).sort().forEach(function (k) {
    const b = k in B, m = k in M;
    if (b === m) return;
    (m ? entrou : saiu).push(k);
  });

  // troca: no mesmo militar e dia sai exatamente um serviço e entra exatamente um
  const porDia = function (lista) {
    const o = Object.create(null);
    lista.forEach(function (k) { const p = partesDaChave_(k); const d = p.mat + '|' + p.dia; (o[d] = o[d] || []).push(k); });
    return o;
  };
  const entrouDia = porDia(entrou), saiuDia = porDia(saiu);
  const troca = Object.create(null);                     // chave que entra <-> chave que sai
  Object.keys(entrouDia).forEach(function (d) {
    if (entrouDia[d].length === 1 && saiuDia[d] && saiuDia[d].length === 1) { troca[entrouDia[d][0]] = saiuDia[d][0]; troca[saiuDia[d][0]] = entrouDia[d][0]; }
  });

  const aplicar = function (k) { res.aplicadas.push(k); };
  const inserir = function (k, comTroca) {
    const p = partesDaChave_(k);
    res.inserir.push({ mat: p.mat, dia: p.dia, servico: p.servico, turno: p.turno, funcao: '', chave: k, troca: comTroca || '' });
  };
  const remover = function (k, comTroca) { res.remover.push({ chave: k, linhas: T[k].slice(), troca: comTroca || '' }); };

  saiu.forEach(function (k) {
    if (troca[k]) return;                                // tratada junto com a que entra
    if (!T[k]) { res.jaAplicadas.push(item(k, 'exclusao', par(k), null)); aplicar(k); return; }
    remover(k);
    aplicar(k);
  });
  entrou.forEach(function (k) {
    if (troca[k]) return;
    if (T[k]) { res.jaAplicadas.push(item(k, 'inclusao', null, par(k))); aplicar(k); return; }
    if (!parValido(k)) { res.invalidas.push(item(k, 'inclusao', null, par(k))); return; }
    inserir(k);
    aplicar(k);
  });
  entrou.forEach(function (ki) {
    const ke = troca[ki];
    if (!ke) return;
    const de = par(ke), para = par(ki);
    if (T[ki]) {                                         // a tabela já tem o serviço novo
      res.jaAplicadas.push(item(ki, 'alteracao', de, para)); aplicar(ki);
      if (T[ke]) remover(ke, ''); else res.jaAplicadas.push(item(ke, 'exclusao', de, null));
      aplicar(ke);
      return;
    }
    if (!T[ke]) {                                        // a tabela não tem o serviço antigo: outra pessoa mexeu
      const p = partesDaChave_(ki);
      const atual = (doDia[p.mat + '|' + p.dia] || []).map(function (a) { return { servico: a.servico, turno: a.turno }; });
      res.conflitos.push(item(ki, 'alteracao', de, para, { tabelaPares: atual }));
      return;
    }
    if (!parValido(ki)) { res.invalidas.push(item(ki, 'alteracao', de, para)); return; }
    remover(ke, ki);
    inserir(ki, ke);
    aplicar(ke); aplicar(ki);
  });

  (opcoes.ilegiveis || []).forEach(function (x) {
    res.invalidas.push({ chave: '', mat: x.mat, dia: x.dia, servico: '', turno: '', tipo: 'ilegivel', de: null, para: null, texto: x.texto });
  });

  // choque de horário: só com horários e a tabela completa (todos os meses) em mãos
  if (opcoes.horarios && opcoes.todas) bloquearPorChoque_(res, B, opcoes.todas, opcoes.horarios);

  // regras da escala manual (RN-03 e as seguintes): só com o contexto e a tabela completa em mãos
  if (opcoes.regras && opcoes.todas) bloquearPorRegras_(res, opcoes.todas, opcoes.regras);

  res.resumo = {
    inclusoes: res.inserir.filter(function (i) { return !i.troca; }).length,
    exclusoes: res.remover.filter(function (r) { return !r.troca; }).length,
    alteracoes: res.inserir.filter(function (i) { return !!i.troca; }).length,
    conflitos: res.conflitos.length,
    invalidas: res.invalidas.length,
    choques: res.choques.length,
    regras: res.regras.length,
    jaAplicadas: res.jaAplicadas.length
  };
  return res;
}

/**
 * Simula a tabela como ficaria depois de aplicar tudo e BLOQUEIA as inclusões (e trocas) que
 * criariam um choque de horário. Choques que já existiam na tabela (entre alocações que você
 * não mexeu) não são culpa desta gravação e não bloqueiam nada: aparecem na conferência de integridade.
 *
 * Se duas mudanças suas colidem entre si, as duas são bloqueadas. Numa troca bloqueada, a linha
 * antiga também fica como está (a troca é tudo ou nada).
 *
 * todas: TODAS as linhas da tabela, de todos os meses [{ mat, dia, turno, servico, linha }]
 */
function bloquearPorChoque_(res, B, todas, horarios) {
  const mudadas = Object.create(null);
  res.inserir.forEach(function (i) { mudadas[i.chave] = true; });
  const mats = Object.create(null);
  Object.keys(mudadas).forEach(function (k) { mats[partesDaChave_(k).mat] = true; });
  if (Object.keys(mudadas).length === 0) return;

  const removidas = Object.create(null);
  res.remover.forEach(function (r) { r.linhas.forEach(function (l) { removidas[l] = true; }); });

  const estado = [];
  todas.forEach(function (a) {
    if (!mats[a.mat] || removidas[a.linha]) return;
    estado.push({ mat: a.mat, dia: a.dia, turno: a.turno, servico: a.servico, implicito: !!a.implicito });
  });
  res.inserir.forEach(function (i) { estado.push({ mat: i.mat, dia: i.dia, turno: i.turno, servico: i.servico }); });

  const bloqueadas = Object.create(null);     // chave -> [com quem choca]
  detectarChoques_(estado, horarios, {}).choques.forEach(function (c) {
    [[c.a, c.b], [c.b, c.a]].forEach(function (par) {
      if (!mudadas[par[0].chave]) return;
      if (!bloqueadas[par[0].chave]) bloqueadas[par[0].chave] = [];
      bloqueadas[par[0].chave].push({ dia: par[1].dia, turno: par[1].turno, servico: par[1].servico, minutos: c.minutos, tipo: c.tipo, implicito: !!par[1].implicito });
    });
  });
  if (Object.keys(bloqueadas).length === 0) return;

  const antigas = Object.create(null);        // chave da linha antiga de uma troca bloqueada
  res.inserir = res.inserir.filter(function (i) {
    if (!bloqueadas[i.chave]) return true;
    const p = partesDaChave_(i.chave);
    const de = i.troca ? { servico: partesDaChave_(i.troca).servico, turno: partesDaChave_(i.troca).turno } : null;
    if (i.troca) antigas[i.troca] = true;
    res.choques.push({ chave: i.chave, mat: p.mat, dia: p.dia, servico: p.servico, turno: p.turno, tipo: i.troca ? 'alteracao' : 'inclusao', de: de, para: { servico: p.servico, turno: p.turno }, com: bloqueadas[i.chave] });
    return false;
  });
  res.remover = res.remover.filter(function (r) { return !antigas[r.chave]; });
  res.aplicadas = res.aplicadas.filter(function (k) { return !bloqueadas[k] && !antigas[k]; });
  res.choques.sort(function (x, y) { return x.chave < y.chave ? -1 : 1; });
}

/**
 * Nova referência depois de salvar: a base passa a refletir a escala só nas
 * chaves que foram aplicadas. Conflitos e inválidas continuam como "pendentes".
 * fora: os serviços que não couberam na grade quando ela foi carregada; continuam
 * guardados (com fora: true), a não ser que a pessoa já os tenha colocado na escala.
 */
function novaBase_(base, escala, res, fora) {
  const B = mapaServicos_(base), M = mapaServicos_(escala);
  res.aplicadas.forEach(function (k) { if (M[k] === undefined) delete B[k]; else B[k] = M[k]; });
  const lista = Object.keys(B).sort().map(function (k) {
    const p = partesDaChave_(k);
    return { mat: p.mat, dia: p.dia, servico: p.servico, turno: p.turno };
  });
  (fora || []).forEach(function (f) {
    if (chaveAloc_(f) in M) return;
    lista.push({ mat: f.mat, dia: f.dia, servico: f.servico, turno: f.turno, fora: true });
  });
  return lista;
}

/** Agrupa números de linha em faixas contíguas, da última para a primeira (para apagar de baixo para cima). */
function faixasParaApagar_(linhas) {
  const s = Array.from(new Set(linhas)).sort(function (a, b) { return b - a; });
  const faixas = [];
  s.forEach(function (n) {
    const f = faixas[faixas.length - 1];
    if (f && f.inicio === n + 1) { f.inicio = n; f.qtd++; }
    else faixas.push({ inicio: n, qtd: 1 });
  });
  return faixas;
}
