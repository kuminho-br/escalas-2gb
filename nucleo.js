/**
 * NÚCLEO DA ESCALA ("matriz" no código) — lógica pura, sem SpreadsheetApp.
 *
 * Converte as alocações (modelo relacional: uma linha por serviço) na grade da escala
 * (um bloco de linhas por militar, uma coluna por dia) e faz o caminho inverso. Fica
 * separado de matriz.js para poder ser testado fora do Google Sheets.
 *
 * Registros de entrada (a camada que lê a planilha já os entrega limpos):
 *   alocação : { mat, dia: 'aaaa-mm-dd', servico, turno, funcao }
 *   militar  : { mat, nome, posto, secao, jornada, equipe, antig, ordem }
 *
 * CONVENÇÃO DA CÉLULA (a única decisão de representação do projeto):
 *   - linha  = militar + posição (1ª, 2ª...). A posição não tem horário nem rótulo e não é gravada.
 *   - coluna = dia
 *   - célula = serviço + horário, como "Pronto 08–20" (ver montarRotulos_ em choques.js). Vazia = sem alocação.
 *   Chave única: matrícula + dia + serviço + turno (chaveAloc_, em sincronia.js).
 *   A FUNÇÃO não aparece na escala (ver aviso gerado em montarModeloMatriz_).
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
 * Alocações (tabela) -> modelo da escala.
 *
 * op = {
 *   mes:      'aaaa-mm'
 *   secao:    seção cujos militares viram linhas ('' = todos)
 *   linhas:   quantas linhas cada militar tem (parâmetro "Linhas por militar"; padrão 2)
 *   rotulos:  o de montarRotulos_ (texto da célula de cada serviço e turno)
 *   horarios: (opcional) o porChave de montarHorarios_, para ordenar os serviços do dia pelo início
 *   catalogo: (opcional) { 'Serviço|Turno': true } para avisar pares fora do catálogo
 * }
 *
 * A linha não tem horário nem rótulo: é só um espaço para mostrar o 1º, o 2º... serviço do dia.
 * Os serviços do dia entram nas linhas em ordem de início (o mais cedo na 1ª linha; empate: nome
 * do serviço). O que não couber nas linhas vai para "foraDaGrade": nada é descartado em silêncio.
 *
 * Nada some em silêncio: quem tem alocação no mês mas não é da seção entra no
 * grupo "OUTRAS SEÇÕES"; quem não está no cadastro entra em "NÃO CADASTRADOS".
 */
function montarModeloMatriz_(alocs, militares, op) {
  const avisos = [];
  const dias = diasDoMes_(op.mes);
  const secaoN = op.secao ? normalizar_(op.secao) : '';
  const doMes = alocs.filter(function (a) { return a.dia.slice(0, 7) === op.mes; });
  const nLinhas = Math.max(1, Math.floor(Number(op.linhas)) || 2);
  const rot = op.rotulos;
  const hor = op.horarios || {};

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
    avisos.push(Object.keys(extras).length + ' militar(es) com alocação no mês estão fora da seção "' + op.secao + '" e foram acrescentados no fim da escala.');
  }

  lista.sort(function (x, y) {
    const gx = ORDEM_GRUPOS_.indexOf(x.grupo), gy = ORDEM_GRUPOS_.indexOf(y.grupo);
    if (gx !== gy) return gx - gy;
    const ax = x.antig === null ? Infinity : x.antig, ay = y.antig === null ? Infinity : y.antig;
    if (ax !== ay) return ax < ay ? -1 : 1;
    return x.ordem - y.ordem;
  });

  const linhas = [];
  const primeira = Object.create(null);                       // matrícula -> índice da 1ª linha do militar
  lista.forEach(function (m) {
    primeira[m.mat] = linhas.length;
    for (let p = 0; p < nLinhas; p++) linhas.push({ mat: m.mat, nome: m.nome, grupo: m.grupo, posicao: p + 1, ultimaDoMilitar: p === nLinhas - 1 });
  });

  const idxDia = Object.create(null);
  dias.forEach(function (d, j) { idxDia[d] = j; });

  // serviços de cada militar em cada dia, sem repetir a mesma chave
  const doDia = Object.create(null);
  const chaves = Object.create(null);
  let repetidas = 0, comFuncao = 0;
  const foraDoCatalogo = Object.create(null);
  doMes.forEach(function (a) {
    if (a.funcao) comFuncao++;
    if (op.catalogo && !op.catalogo[a.servico + '|' + a.turno]) {
      const k = a.servico + ' no turno ' + a.turno;
      foraDoCatalogo[k] = (foraDoCatalogo[k] || 0) + 1;
    }
    const c = chaveAloc_(a);
    if (c in chaves) { repetidas++; return; }
    chaves[c] = true;
    const d = a.mat + '|' + a.dia;
    (doDia[d] = doDia[d] || []).push(a);
  });

  const inicio = function (a) { const h = hor[a.servico + '|' + a.turno]; return h ? h.ini : Infinity; };
  const celulas = linhas.map(function () { return dias.map(function () { return ''; }); });
  const foraDaGrade = [];
  let preenchidas = 0;
  Object.keys(doDia).sort().forEach(function (d) {
    const l = doDia[d].slice().sort(function (x, y) {
      const ix = inicio(x), iy = inicio(y);
      if (ix !== iy) return ix < iy ? -1 : 1;
      if (x.servico !== y.servico) return x.servico < y.servico ? -1 : 1;
      return x.turno < y.turno ? -1 : (x.turno > y.turno ? 1 : 0);
    });
    l.forEach(function (a, p) {
      if (p >= nLinhas) { foraDaGrade.push({ mat: a.mat, dia: a.dia, servico: a.servico, turno: a.turno }); return; }
      celulas[primeira[a.mat] + p][idxDia[a.dia]] = rotuloDe_(rot, a.servico, a.turno);
      preenchidas++;
    });
  });

  if (foraDaGrade.length) {
    const nomeDe = Object.create(null);
    lista.forEach(function (m) { nomeDe[m.mat] = m.nome; });
    const exemplos = foraDaGrade.slice(0, 5).map(function (f) {
      return nomeDe[f.mat] + ' ' + f.dia.slice(8) + '/' + f.dia.slice(5, 7) + ' ' + rotuloDe_(rot, f.servico, f.turno);
    });
    avisos.push(foraDaGrade.length + ' serviço(s) não couberam nas ' + nLinhas + ' linha(s) por militar e não aparecem na escala; continuam na tabela e não serão apagados: ' +
      exemplos.join('; ') + (foraDaGrade.length > 5 ? '…' : '') + '.');
  }
  if (repetidas) avisos.push(repetidas + ' alocação(ões) repetida(s) idêntica(s) na tabela (a escala mostra uma só).');
  Object.keys(foraDoCatalogo).forEach(function (k) { avisos.push('Fora do catálogo de turnos: ' + k + ' (' + foraDoCatalogo[k] + ').'); });
  if (comFuncao) avisos.push(comFuncao + ' alocação(ões) têm FUNÇÃO preenchida; a escala não a exibe (uma sincronização não a apaga se o serviço não mudar).');

  return {
    linhas: linhas,
    dias: dias,
    celulas: celulas,
    foraDaGrade: foraDaGrade,
    avisos: avisos,
    resumo: { alocacoesMes: doMes.length, celulasPreenchidas: preenchidas, militares: lista.length, linhasPorMilitar: nLinhas, foraDaGrade: foraDaGrade.length }
  };
}

/**
 * Escala -> alocações (caminho inverso). O texto de cada célula ("Pronto 08–20") volta a ser
 * serviço + turno pela tabela de rótulos (rot, de montarRotulos_).
 *   - célula preenchida sem matrícula ou data válidas na sua linha/coluna: conta em "orfas";
 *   - texto que não se entende: vai para "ilegiveis" (nunca é gravado nem descartado em silêncio);
 *   - o mesmo serviço duas vezes para o mesmo militar e dia: vale o primeiro, conta em "repetidas".
 */
function desmontarMatriz_(linhas, dias, celulas, rot) {
  const alocs = [], ilegiveis = [], vistos = Object.create(null);
  let orfas = 0, repetidas = 0;
  celulas.forEach(function (linha, i) {
    linha.forEach(function (v, j) {
      const texto = String(v == null ? '' : v).trim();
      if (!texto) return;
      const l = linhas[i];
      if (!l || !l.mat || !dias[j]) { orfas++; return; }
      const p = parDoRotulo_(texto, rot);
      if (!p) { ilegiveis.push({ mat: l.mat, dia: dias[j], texto: texto }); return; }
      const a = { mat: l.mat, dia: dias[j], servico: p.servico, turno: p.turno };
      const k = chaveAloc_(a);
      if (vistos[k]) { repetidas++; return; }
      vistos[k] = true;
      alocs.push(a);
    });
  });
  return { alocs: alocs, orfas: orfas, ilegiveis: ilegiveis, repetidas: repetidas };
}

/**
 * Compara duas listas de alocações pela chave matrícula + dia + serviço + turno (a FUNÇÃO é ignorada).
 * Retorna { soNaTabela: [{chave, servico, turno}], soNaEscala: [...], total }.
 */
function compararAlocacoes_(tabela, escala) {
  const mt = Object.create(null), mm = Object.create(null);
  tabela.forEach(function (a) { const k = chaveAloc_(a); if (!(k in mt)) mt[k] = a; });
  escala.forEach(function (a) { const k = chaveAloc_(a); if (!(k in mm)) mm[k] = a; });
  const soNaTabela = [], soNaEscala = [];
  Object.keys(mt).forEach(function (c) { if (!(c in mm)) soNaTabela.push({ chave: c, servico: mt[c].servico, turno: mt[c].turno }); });
  Object.keys(mm).forEach(function (c) { if (!(c in mt)) soNaEscala.push({ chave: c, servico: mm[c].servico, turno: mm[c].turno }); });
  return { soNaTabela: soNaTabela, soNaEscala: soNaEscala, total: soNaTabela.length + soNaEscala.length };
}

/**
 * RN-02 (B20): quais linhas da grade podem ser ocultadas. São as linhas EXTRAS de cada militar
 * (2ª em diante) que não têm nenhum serviço no mês carregado. A 1ª linha de cada militar nunca entra.
 * linhas: [{ mat }] na ordem da grade;  celulas: a grade (uma linha por item de "linhas").
 * Retorna os índices (base 0) dentro da grade.
 */
function linhasExtrasVazias_(linhas, celulas) {
  const res = [];
  for (let i = 1; i < linhas.length; i++) {
    if (!linhas[i].mat || linhas[i].mat !== linhas[i - 1].mat) continue;     // 1ª linha do militar: nunca oculta
    const vazia = (celulas[i] || []).every(function (v) { return String(v == null ? '' : v).trim() === ''; });
    if (vazia) res.push(i);
  }
  return res;
}
