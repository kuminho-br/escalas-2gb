/**
 * SINCRONIA matriz -> tabela — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 *
 * Comparação em TRÊS vias, sempre pela chave matrícula|dia|turno:
 *   base   = a matriz como foi desenhada (cópia de referência guardada na aba oculta);
 *   matriz = a matriz como está agora (com as suas edições);
 *   tabela = ALOCAÇÕES TABULADAS como está agora.
 *
 * "O que você mudou" = matriz × base. Cada mudança só é aplicada se a tabela
 * ainda estiver como estava na base para aquela chave. Se outra pessoa mexeu
 * na mesma chave nesse meio-tempo, vira CONFLITO e não é gravada.
 *
 *   inclusão  : célula preenchida que não existia     -> nova linha na tabela
 *   exclusão  : célula esvaziada                       -> remove a linha
 *   alteração : serviço trocado                        -> atualiza o serviço e LIMPA a função
 *
 * Serviço que não existe para aquele turno (aba TURNOS) é INVÁLIDO: essa
 * célula é pulada e avisada, e o resto é gravado normalmente.
 */

function chaveAloc_(a) { return a.mat + '|' + a.dia + '|' + a.turno; }

/** chave -> serviço (se a lista repetir a chave, vale a primeira). */
function mapaServicos_(lista) {
  const m = Object.create(null);
  lista.forEach(function (a) { const k = chaveAloc_(a); if (!(k in m)) m[k] = a.servico; });
  return m;
}

/**
 * base, matriz: [{ mat, dia, turno, servico }]
 * tabela: [{ mat, dia, turno, servico, linha }]   (só as linhas dos dias da matriz)
 * catalogoPares: { 'Serviço|Turno': true }   (vazio/ausente = não valida)
 */
function calcularSincronizacao_(base, matriz, tabela, catalogoPares, opcoes) {
  const B = mapaServicos_(base), M = mapaServicos_(matriz);

  const T = Object.create(null);
  tabela.forEach(function (a) {
    const k = chaveAloc_(a);
    if (!T[k]) T[k] = { servicos: [], linhas: [] };
    if (T[k].servicos.indexOf(a.servico) < 0) T[k].servicos.push(a.servico);
    T[k].linhas.push(a.linha);
  });

  const validar = !!catalogoPares && Object.keys(catalogoPares).length > 0;
  const chaves = Object.keys(Object.assign(Object.create(null), B, M)).sort();
  const res = { inserir: [], remover: [], atualizar: [], conflitos: [], invalidas: [], choques: [], jaAplicadas: [], aplicadas: [] };

  chaves.forEach(function (k) {
    const b = B[k], m = M[k];
    if (b === m) return;                                   // você não mexeu nesta célula
    const p = k.split('|');
    const tipo = b === undefined ? 'inclusao' : (m === undefined ? 'exclusao' : 'alteracao');
    const item = { chave: k, mat: p[0], dia: p[1], turno: p[2], tipo: tipo, de: b, para: m };

    const t = T[k];
    const noTabela = t ? (t.servicos.length === 1 ? t.servicos[0] : '(vários)') : undefined;

    if (noTabela === m) { res.jaAplicadas.push(item); res.aplicadas.push(k); return; }   // a tabela já está como você quer

    if (noTabela !== b) {                                  // a tabela mudou por outro lado
      item.tabela = t ? t.servicos.join(' / ') : '(vazio)';
      res.conflitos.push(item);
      return;
    }

    if (tipo !== 'exclusao' && validar && !catalogoPares[m + '|' + p[2]]) {
      res.invalidas.push(item);
      return;
    }

    if (tipo === 'inclusao') res.inserir.push({ mat: p[0], dia: p[1], servico: m, turno: p[2], funcao: '', chave: k });
    else if (tipo === 'exclusao') res.remover.push({ chave: k, linhas: t.linhas.slice() });
    else res.atualizar.push({ chave: k, linhas: t.linhas.slice(), servico: m, funcao: '' });
    res.aplicadas.push(k);
  });

  // choque de horário: só com horários e a tabela completa (todos os meses) em mãos
  if (opcoes && opcoes.horarios && opcoes.todas) bloquearPorChoque_(res, B, opcoes.todas, opcoes.horarios);

  res.resumo = {
    inclusoes: res.inserir.length,
    exclusoes: res.remover.length,
    alteracoes: res.atualizar.length,
    conflitos: res.conflitos.length,
    invalidas: res.invalidas.length,
    choques: res.choques.length,
    jaAplicadas: res.jaAplicadas.length
  };
  return res;
}

/**
 * Simula a tabela como ficaria depois de aplicar tudo e BLOQUEIA as inclusões e
 * alterações que criariam um choque de horário. Choques que já existiam na
 * tabela (entre alocações que você não mexeu) não são culpa desta gravação e
 * não bloqueiam nada: aparecem na conferência de integridade.
 *
 * Se duas mudanças suas colidem entre si, as duas são bloqueadas.
 *
 * todas: TODAS as linhas da tabela, de todos os meses [{ mat, dia, turno, servico, linha }]
 */
function bloquearPorChoque_(res, B, todas, horarios) {
  const mudadas = Object.create(null);
  res.inserir.forEach(function (i) { mudadas[i.chave] = true; });
  res.atualizar.forEach(function (u) { mudadas[u.chave] = true; });
  const mats = Object.create(null);
  Object.keys(mudadas).forEach(function (k) { mats[k.split('|')[0]] = true; });
  if (Object.keys(mudadas).length === 0) return;

  const removidas = Object.create(null);
  res.remover.forEach(function (r) { r.linhas.forEach(function (l) { removidas[l] = true; }); });
  const novoServico = Object.create(null);
  res.atualizar.forEach(function (u) { u.linhas.forEach(function (l) { novoServico[l] = u.servico; }); });

  const estado = [];
  todas.forEach(function (a) {
    if (!mats[a.mat] || removidas[a.linha]) return;
    estado.push({ mat: a.mat, dia: a.dia, turno: a.turno, servico: novoServico[a.linha] !== undefined ? novoServico[a.linha] : a.servico, implicito: !!a.implicito });
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
  const chaves = Object.keys(bloqueadas);
  if (chaves.length === 0) return;

  const item = function (k, tipo, servico) {
    const p = k.split('|');
    return { chave: k, mat: p[0], dia: p[1], turno: p[2], tipo: tipo, de: B[k], para: servico, com: bloqueadas[k] };
  };
  res.inserir = res.inserir.filter(function (i) {
    if (!bloqueadas[i.chave]) return true;
    res.choques.push(item(i.chave, 'inclusao', i.servico));
    return false;
  });
  res.atualizar = res.atualizar.filter(function (u) {
    if (!bloqueadas[u.chave]) return true;
    res.choques.push(item(u.chave, 'alteracao', u.servico));
    return false;
  });
  res.aplicadas = res.aplicadas.filter(function (k) { return !bloqueadas[k]; });
  res.choques.sort(function (x, y) { return x.chave < y.chave ? -1 : 1; });
}

/**
 * Nova referência depois de salvar: a base passa a refletir a matriz só nas
 * chaves que foram aplicadas. Conflitos e inválidas continuam como "pendentes".
 */
function novaBase_(base, matriz, res) {
  const B = mapaServicos_(base), M = mapaServicos_(matriz);
  res.aplicadas.forEach(function (k) { if (M[k] === undefined) delete B[k]; else B[k] = M[k]; });
  return Object.keys(B).sort().map(function (k) {
    const p = k.split('|');
    return { mat: p[0], dia: p[1], turno: p[2], servico: B[k] };
  });
}

/** Linhas repetidas na matriz (mesmo militar e turno duas vezes): ambíguo, é preciso corrigir antes. */
function linhasRepetidas_(linhas) {
  const visto = Object.create(null), rep = [];
  linhas.forEach(function (l) {
    if (!l.mat || !l.turno) return;
    const k = l.mat + '|' + l.turno;
    if (visto[k] && rep.indexOf(k) < 0) rep.push(k);
    visto[k] = true;
  });
  return rep;
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