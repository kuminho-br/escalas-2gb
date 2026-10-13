/**
 * NÚCLEO DA MATRIZ — lógica pura, sem SpreadsheetApp.
 *
 * Converte as alocações (modelo relacional: uma linha por serviço) na matriz
 * (uma linha por militar + turno, uma coluna por dia, o SERVIÇO na célula) e
 * faz o caminho inverso. Fica separado de matriz.gs para poder ser testado
 * fora do Google Sheets.
 *
 * Registros de entrada (a camada que lê a planilha já os entrega limpos):
 *   alocação : { mat, dia: 'aaaa-mm-dd', turno, servico, funcao }
 *   militar  : { mat, nome, posto, secao, jornada, equipe, antig, ordem }
 *
 * CONVENÇÃO DA CÉLULA (a única decisão de representação do projeto):
 *   - linha  = militar + letra do turno (A, B, ...)
 *   - coluna = dia
 *   - célula = nome do SERVIÇO (Pronto, Adm, JES, ...). Vazia = sem alocação.
 *   Chave única: matrícula + data + turno (a mesma da tabela de alocações).
 *   A FUNÇÃO não aparece na matriz (ver aviso gerado em montarModeloMatriz_).
 */

const ORDEM_GRUPOS_ = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ADM', 'SEM EQUIPE', 'OUTRAS SEÇÕES', 'NÃO CADASTRADOS'];

/** 'Seção 1ª SB' e '1ºSB' viram '1SB': comparação sem acento, caixa ou pontuação. */
function normalizar_(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 'aaaa-mm' -> ['aaaa-mm-01', ..., 'aaaa-mm-31'] (aritmética pura, sem fuso horário). */
function diasDoMes_(mes) {
  const p = mes.split('-').map(Number);
  const total = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
  const dias = [];
  for (let d = 1; d <= total; d++) dias.push(mes + '-' + String(d).padStart(2, '0'));
  return dias;
}

/** 0 = domingo ... 6 = sábado. */
function diaDaSemana_(dia) {
  const p = dia.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
}

/** 'aaaa-mm-dd' -> 'dd/mm/aaaa'. */
function formatarDia_(dia) {
  const p = dia.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function grupoDoMilitar_(m) {
  const jornada = normalizar_(m.jornada);
  const equipe = normalizar_(m.equipe);
  if (jornada === 'ADM') return 'ADM';
  if (jornada === 'PRONTO' && ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'].indexOf(equipe) >= 0) return equipe;
  return 'SEM EQUIPE';
}

function antigNum_(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) ? n : null;
}

function nomeExibicao_(m) {
  return [m.posto, m.nome].filter(Boolean).join(' ');
}

/**
 * Alocações (tabela) -> modelo da matriz.
 *
 * op = {
 *   mes:        'aaaa-mm'
 *   secao:      seção cujos militares viram linhas ('' = todos)
 *   turnosBase: letras que sempre aparecem (padrão ['A','B'])
 *   catalogo:   (opcional) { 'Serviço|Turno': true } para avisar pares fora do catálogo
 * }
 *
 * Nada some em silêncio: quem tem alocação no mês mas não é da seção entra no
 * grupo "OUTRAS SEÇÕES"; quem não está no cadastro entra em "NÃO CADASTRADOS".
 */
function montarModeloMatriz_(alocs, militares, op) {
  const avisos = [];
  const dias = diasDoMes_(op.mes);
  const secaoN = op.secao ? normalizar_(op.secao) : '';
  const doMes = alocs.filter(function (a) { return a.dia.slice(0, 7) === op.mes; });

  const cad = Object.create(null);
  militares.forEach(function (m) { if (!(m.mat in cad)) cad[m.mat] = m; });

  const vistos = Object.create(null);
  const lista = [];
  militares.forEach(function (m) {
    if (secaoN && normalizar_(m.secao) !== secaoN) return;
    if (vistos[m.mat]) return;
    vistos[m.mat] = true;
    lista.push({ mat: m.mat, nome: nomeExibicao_(m), grupo: grupoDoMilitar_(m), antig: antigNum_(m.antig), ordem: m.ordem });
  });

  const extras = Object.create(null);
  doMes.forEach(function (a) { if (!vistos[a.mat]) extras[a.mat] = true; });
  Object.keys(extras).sort().forEach(function (mat) {
    const m = cad[mat];
    lista.push({
      mat: mat,
      nome: m ? nomeExibicao_(m) : '(não cadastrado)',
      grupo: m ? 'OUTRAS SEÇÕES' : 'NÃO CADASTRADOS',
      antig: null,
      ordem: 1e9
    });
  });
  if (Object.keys(extras).length) {
    avisos.push(Object.keys(extras).length + ' militar(es) com alocação no mês estão fora da seção "' + op.secao + '" e foram acrescentados no fim da matriz.');
  }

  lista.sort(function (x, y) {
    const gx = ORDEM_GRUPOS_.indexOf(x.grupo), gy = ORDEM_GRUPOS_.indexOf(y.grupo);
    if (gx !== gy) return gx - gy;
    const ax = x.antig === null ? Infinity : x.antig, ay = y.antig === null ? Infinity : y.antig;
    if (ax !== ay) return ax < ay ? -1 : 1;
    return x.ordem - y.ordem;
  });

  const letras = Array.from(new Set((op.turnosBase || ['A', 'B']).concat(doMes.map(function (a) { return a.turno; })))).sort();

  const linhas = [];
  lista.forEach(function (m) {
    letras.forEach(function (t, i) {
      linhas.push({ mat: m.mat, nome: m.nome, grupo: m.grupo, turno: t, ultimaDoMilitar: i === letras.length - 1 });
    });
  });

  const idxLinha = Object.create(null);
  linhas.forEach(function (l, i) { idxLinha[l.mat + '|' + l.turno] = i; });
  const idxDia = Object.create(null);
  dias.forEach(function (d, j) { idxDia[d] = j; });

  const celulas = linhas.map(function () { return dias.map(function () { return ''; }); });
  const colisoes = [];
  let repetidas = 0, comFuncao = 0;
  const foraDoCatalogo = Object.create(null);

  doMes.forEach(function (a) {
    const i = idxLinha[a.mat + '|' + a.turno], j = idxDia[a.dia];
    if (a.funcao) comFuncao++;
    if (op.catalogo && !op.catalogo[a.servico + '|' + a.turno]) {
      const k = a.servico + ' no turno ' + a.turno;
      foraDoCatalogo[k] = (foraDoCatalogo[k] || 0) + 1;
    }
    const atual = celulas[i][j];
    if (atual === '') {
      celulas[i][j] = a.servico;
    } else if (atual === a.servico) {
      repetidas++;
    } else {
      let c = colisoes.filter(function (x) { return x.linha === i && x.coluna === j; })[0];
      if (!c) { c = { linha: i, coluna: j, mat: a.mat, dia: a.dia, turno: a.turno, valores: [atual] }; colisoes.push(c); }
      if (c.valores.indexOf(a.servico) < 0) c.valores.push(a.servico);
    }
  });

  if (colisoes.length) avisos.push(colisoes.length + ' célula(s) com mais de um serviço para o mesmo militar, dia e turno na tabela (aparece o primeiro; veja a nota e a borda vermelha).');
  if (repetidas) avisos.push(repetidas + ' alocação(ões) repetida(s) idêntica(s) na tabela (a matriz mostra uma só).');
  Object.keys(foraDoCatalogo).forEach(function (k) { avisos.push('Fora do catálogo de turnos: ' + k + ' (' + foraDoCatalogo[k] + ').'); });
  if (comFuncao) avisos.push(comFuncao + ' alocação(ões) têm FUNÇÃO preenchida; a matriz não a exibe (uma futura sincronização não pode apagá-la).');

  const preenchidas = celulas.reduce(function (s, l) { return s + l.filter(function (v) { return v !== ''; }).length; }, 0);
  return {
    linhas: linhas,
    dias: dias,
    letras: letras,
    celulas: celulas,
    colisoes: colisoes,
    avisos: avisos,
    resumo: { alocacoesMes: doMes.length, celulasPreenchidas: preenchidas, militares: lista.length }
  };
}

/**
 * Matriz -> alocações (caminho inverso). Célula preenchida sem matrícula, turno
 * ou data válidos na sua linha/coluna é contada em "orfas".
 */
function desmontarMatriz_(linhas, dias, celulas) {
  const alocs = [];
  let orfas = 0;
  celulas.forEach(function (linha, i) {
    linha.forEach(function (v, j) {
      const servico = String(v == null ? '' : v).trim();
      if (!servico) return;
      const l = linhas[i];
      if (!l || !l.mat || !l.turno || !dias[j]) { orfas++; return; }
      alocs.push({ mat: l.mat, dia: dias[j], turno: l.turno, servico: servico });
    });
  });
  return { alocs: alocs, orfas: orfas };
}

/**
 * Compara duas listas de alocações pela chave matrícula + dia + turno (a FUNÇÃO é ignorada).
 *
 * "conflitosNaTabela": a própria tabela tem dois serviços diferentes para a mesma
 * chave. A matriz só comporta um por célula, então isso conta como diferença:
 * sem isso a conferência diria "0 diferenças" com uma linha da tabela invisível.
 */
function compararAlocacoes_(tabela, matriz) {
  const chave = function (a) { return a.mat + '|' + a.dia + '|' + a.turno; };
  const mt = Object.create(null), mm = Object.create(null);
  const conflitosNaTabela = [];
  tabela.forEach(function (a) {
    const c = chave(a);
    if (!(c in mt)) { mt[c] = a.servico; return; }
    if (mt[c] === a.servico) return;
    let x = conflitosNaTabela.filter(function (k) { return k.chave === c; })[0];
    if (!x) { x = { chave: c, valores: [mt[c]] }; conflitosNaTabela.push(x); }
    if (x.valores.indexOf(a.servico) < 0) x.valores.push(a.servico);
  });
  matriz.forEach(function (a) { if (!(chave(a) in mm)) mm[chave(a)] = a.servico; });
  const soNaTabela = [], soNaMatriz = [], divergentes = [];
  Object.keys(mt).forEach(function (c) {
    if (!(c in mm)) soNaTabela.push({ chave: c, servico: mt[c] });
    else if (mm[c] !== mt[c]) divergentes.push({ chave: c, tabela: mt[c], matriz: mm[c] });
  });
  Object.keys(mm).forEach(function (c) { if (!(c in mt)) soNaMatriz.push({ chave: c, servico: mm[c] }); });
  return {
    soNaTabela: soNaTabela,
    soNaMatriz: soNaMatriz,
    divergentes: divergentes,
    conflitosNaTabela: conflitosNaTabela,
    total: soNaTabela.length + soNaMatriz.length + divergentes.length + conflitosNaTabela.length
  };
}
