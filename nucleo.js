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

/**
 * P17 item 1 (RN-02): a cor de cada serviço, [fundo, texto], pela chave normalizada do nome
 * (normalizar_: sem acento, caixa ou espaço). A mesma cor vale na grade geral, na legenda e na grade
 * de guarnição. Os serviços do Ordinário (Pronto, Saldo, JES) ficam em tons de verde parecidos
 * entre si; nenhum outro serviço usa verde.
 */
const CORES_DOS_SERVICOS_ = {
  PRONTO:     ['#B7E1CD', '#0B3D2E'],
  SALDO:      ['#D9EAD3', '#274E13'],
  JES:        ['#A8D5A2', '#1E4620'],
  ADM:        ['#F4C7C3', '#5B0F00'],
  DEFENSORIA: ['#F9CB9C', '#5B2C00'],
  BIOMA:      ['#FFE599', '#4A3B00'],
  PESEGURO:   ['#CFE2F3', '#0B2E59'],
  ELEICOES:   ['#D9D2E9', '#2E1A47'],
  CPRH:       ['#EAD1DC', '#4C1130']
};

/** Serviço fora da tabela acima: cor fixa, escolhida pelo nome (o mesmo nome dá sempre a mesma cor). Sem verdes. */
const CORES_RESERVA_ = [
  ['#FCE5CD', '#5B2C00'], ['#D0E0E3', '#0C343D'], ['#E6B8AF', '#5B0F00'],
  ['#C9DAF8', '#1C2E5C'], ['#FFF2CC', '#4A3B00'], ['#EAD1DC', '#4C1130'], ['#D9D9D9', '#000000']
];

/** P17 item 1: [fundo, texto] do serviço; nunca vazio para um nome não vazio. null para nome vazio. */
function corDoServico_(nome) {
  const k = normalizar_(nome);
  if (!k) return null;
  if (CORES_DOS_SERVICOS_[k]) return CORES_DOS_SERVICOS_[k];
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 1000003;
  return CORES_RESERVA_[h % CORES_RESERVA_.length];
}

/** P17 item 1: { 'Nome como escrito': [fundo, texto] } para cada serviço da lista (repetidos contam uma vez). */
function coresDosServicos_(nomes) {
  const res = {};
  (nomes || []).forEach(function (n) {
    const s = String(n == null ? '' : n).trim();
    if (s && !(s in res)) res[s] = corDoServico_(s);
  });
  return res;
}

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

/**
 * P17 item 5 (RN-02): posição do posto/graduação na hierarquia, do mais antigo (0) ao mais moderno.
 * Usada para ordenar os militares dentro da equipe. A coluna ANTIG. (2°GB) desempata dentro do mesmo
 * posto — na sandbox ela está vazia em todas as linhas, e por isso a grade ficava na ordem do cadastro.
 * Posto que não se reconhece vai para o fim (Infinity), sem quebrar nada.
 */
const POSTOS_POR_ANTIGUIDADE_ = ['CEL', 'TC', 'MAJ', 'CAP', '1TEN', '2TEN', 'ASP', 'ST', '1SGT', '2SGT', '3SGT', 'CB', 'SD'];
const POSTOS_SINONIMOS_ = { TENCEL: 'TC', MAJOR: 'MAJ', CAPITAO: 'CAP', ASPOF: 'ASP', SUBTEN: 'ST', SUBTENENTE: 'ST', CABO: 'CB', SOLDADO: 'SD' };

function ordemDoPosto_(posto) {
  let k = normalizar_(posto).replace(/BM$/, '');              // '2º SGT BM' -> '2SGT'
  if (POSTOS_SINONIMOS_[k]) k = POSTOS_SINONIMOS_[k];
  const i = POSTOS_POR_ANTIGUIDADE_.indexOf(k);
  return i < 0 ? Infinity : i;
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
    lista.push({ mat: m.mat, nome: nomeExibicao_(m), grupo: grupoDoMilitar_(m), posto: ordemDoPosto_(m.posto), antig: antigNum_(m.antig), ordem: m.ordem });
  });

  const extras = Object.create(null);
  doMes.forEach(function (a) { if (!vistos[a.mat]) extras[a.mat] = true; });
  Object.keys(extras).sort().forEach(function (mat) {
    const m = cad[mat];
    lista.push({
      mat: mat,
      nome: m ? nomeExibicao_(m) : '(não cadastrado)',
      grupo: m ? 'OUTRAS SEÇÕES' : 'NÃO CADASTRADOS',
      posto: m ? ordemDoPosto_(m.posto) : Infinity,
      antig: m ? antigNum_(m.antig) : null,
      ordem: m ? 1e6 + m.ordem : 1e9
    });
  });
  if (Object.keys(extras).length) {
    avisos.push(Object.keys(extras).length + ' militar(es) com alocação no mês estão fora da seção "' + op.secao + '" e foram acrescentados no fim da escala.');
  }

  lista.sort(function (x, y) {
    const gx = ORDEM_GRUPOS_.indexOf(x.grupo), gy = ORDEM_GRUPOS_.indexOf(y.grupo);
    if (gx !== gy) return gx - gy;
    // P17 item 5 (RN-02): dentro da equipe, por antiguidade: posto/graduação, depois a ANTIG., depois o cadastro
    if (x.posto !== y.posto) return x.posto < y.posto ? -1 : 1;
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
 * P17 itens 4 e 7 (RN-02): o desenho das colunas de identificação (MATRÍCULA, MILITAR, EQUIPE) e
 * das divisórias, a partir das linhas da grade ([{ mat, grupo }], na ordem da grade). Índices base 0.
 *   repeteMilitar: 2ª linha em diante do mesmo militar -> as três colunas em tom quase branco;
 *   repeteEquipe:  1ª linha de um militar cuja equipe é a mesma da linha de cima -> só a EQUIPE em tom
 *                  quase branco (a matrícula e o nome são de outra pessoa e ficam normais);
 *   inicioMilitar: 1ª linha de um militar que não abre grupo (divisória fina em cima, B34);
 *   inicioGrupo:   1ª linha de cada grupo, menos a primeira da grade (divisória grossa em cima).
 * Nada é mesclado: os valores continuam em todas as linhas (filtro e ordenação seguem funcionando).
 */
function desenhoDasLinhas_(linhas) {
  const res = { repeteMilitar: [], repeteEquipe: [], inicioMilitar: [], inicioGrupo: [] };
  (linhas || []).forEach(function (l, i) {
    const ant = linhas[i - 1];
    if (!ant) return;
    if (ant.mat === l.mat) { res.repeteMilitar.push(i); return; }
    if (ant.grupo === l.grupo) { res.repeteEquipe.push(i); res.inicioMilitar.push(i); }
    else res.inicioGrupo.push(i);
  });
  return res;
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

/* ------------------------------------------------------------ nomes das abas (B52) */

/**
 * B52: cinco abas mudaram de nome; B58 (RN-09), mais uma: MODELOS DE GUARNIÇÃO virou GUARNIÇÕES POR
 * ESCALA. Para cada nome novo, os nomes que a aba já teve, do mais recente para o mais antigo (uma
 * planilha que ainda tenha MATRIZ termina com GRADE GERAL).
 * A comparação é sempre pelo nome INTEIRO: "ESCALA" não é "ESCALAS" e "GUARNIÇÕES" não é
 * "GUARNIÇÕES POR ESCALA".
 */
const ABAS_NOMES_ANTIGOS_ = {
  'ALOCAÇÕES': ['ALOCAÇÕES TABULADAS'],
  'GRADE GERAL': ['ESCALA DO MÊS', 'MATRIZ'],
  'ESCALA': ['GUARNIÇÃO'],
  'ESCALA DO ORDINÁRIO': ['ESCALA OPERACIONAL'],
  'GUARNIÇÕES': ['VIATURAS'],
  'GUARNIÇÕES POR ESCALA': ['MODELOS DE GUARNIÇÃO']      // B58: só o nome muda aqui; o formato é convertido pelo painel
};

/**
 * O que fazer com as abas, dado o nome de todas as que existem na planilha.
 * Retorna { renomear: [{ de, para }], avisos: [texto] }.
 * - só o nome antigo existe: renomeia (o mais recente dos antigos; os demais ficam e são avisados);
 * - o novo e algum antigo existem: não toca em nenhum, usa o novo e avisa;
 * - nenhum existe: nada a fazer (quem precisar da aba a cria já com o nome novo).
 */
function planoDeMigracaoDeAbas_(existentes, so) {
  const tem = Object.create(null);
  (existentes || []).forEach(function (n) { tem[n] = true; });
  const renomear = [], avisos = [];
  Object.keys(ABAS_NOMES_ANTIGOS_).forEach(function (novo) {
    if (so && so !== novo) return;
    const antigas = ABAS_NOMES_ANTIGOS_[novo].filter(function (a) { return tem[a]; });
    if (!antigas.length) return;
    if (tem[novo]) {
      avisos.push('Existem ao mesmo tempo as abas "' + novo + '" e "' + antigas.join('", "') + '" (nome antigo). O sistema usa "' + novo + '" e não apaga nenhuma: confira qual tem os dados certos e apague ou renomeie a outra.');
      return;
    }
    renomear.push({ de: antigas[0], para: novo });
    if (antigas.length > 1) {
      avisos.push('A aba "' + antigas[0] + '" passou a se chamar "' + novo + '". Também existe "' + antigas.slice(1).join('", "') + '" (nome mais antigo ainda), que ficou como está: confira e apague se não for mais usada.');
    }
  });
  return { renomear: renomear, avisos: avisos };
}

/* ------------------------------------------------------------ função como nota (B48) */

/**
 * B48 (RN-94, RN-81): a função de cada alocação aparece como NOTA na célula da grade geral (não
 * como coluna). Monta a matriz de notas, do mesmo tamanho da grade: '' onde não há função.
 * linhas: [{ mat }], dias: ['aaaa-mm-dd'], celulas: textos da grade, rot: rótulos de montarRotulos_,
 * alocs: alocações com { mat, dia, servico, turno, funcao, unidade }.
 * A nota só mostra o resultado; quem atribui a função é o menu "Alocar em Função" (B36).
 */
function notasDeFuncao_(linhas, dias, celulas, rot, alocs) {
  const porChave = Object.create(null);
  (alocs || []).forEach(function (a) {
    const f = String(a.funcao == null ? '' : a.funcao).trim();
    if (!f) return;
    const k = a.mat + '|' + a.dia + '|' + a.servico + '|' + a.turno;
    if (!(k in porChave)) porChave[k] = 'Função: ' + f + (String(a.unidade || '').trim() ? ' (' + String(a.unidade).trim() + ')' : '');
  });
  return celulas.map(function (linha, i) {
    return linha.map(function (v, j) {
      const texto = String(v == null ? '' : v).trim();
      const l = linhas[i];
      if (!texto || !l || !l.mat || !dias[j]) return '';
      const p = parDoRotulo_(texto, rot);
      if (!p) return '';
      return porChave[l.mat + '|' + dias[j] + '|' + p.servico + '|' + p.turno] || '';
    });
  });
}

/* ------------------------------------------------------------ origem do serviço (B49 item 2) */

/**
 * B49 item 2 (RN-13, RN-94): a ORIGEM de uma alocação — o rótulo que vai depois da função
 * ("MOTORISTA - PJES") e no documento do ordinário — é cadastro: coluna ORIGEM da aba TURNOS.
 * origens = { 'SERVIÇO|TURNO': 'PJES', 'SERVIÇO': 'PJES' } (montado por lerOrigens_).
 * Vale, nessa ordem: a ORIGEM da linha do turno, a ORIGEM de qualquer turno do serviço e, sem
 * nada cadastrado, o próprio nome do serviço em maiúsculas — que é o comportamento que já havia
 * para Pronto e Saldo. Nada aqui está escrito no código: o JES -> PJES saiu de guarnicao.gs.
 */
function origemDoServico_(servico, origens, turno) {
  const mapa = origens || {};
  const nS = normalizar_(servico);
  const procura = function (chave) {
    const k = Object.keys(mapa).filter(function (x) { return normalizar_(x.split('|')[0]) === nS && (chave === null ? x.indexOf('|') < 0 : normalizar_(x.split('|')[1]) === normalizar_(chave)); })[0];
    return k ? String(mapa[k]).trim() : '';
  };
  const achou = (turno ? procura(turno) : '') || procura(null);
  const texto = achou || String(servico == null ? '' : servico).trim();
  return normalizar_(texto) === '' ? '' : texto.toUpperCase();
}

