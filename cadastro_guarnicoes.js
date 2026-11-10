/**
 * CADASTRO DE GUARNIÇÕES (aba GUARNIÇÕES) — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 * Depende de nucleo.gs (normalizar_).
 *
 * Não confundir com guarnicao.gs, que é a grade de edição da escala. Aqui é só o CADASTRO:
 * quais guarnições existem, se são para ativar, em que ordem, com que viatura (quando têm),
 * que categoria de CNH o condutor precisa e qual a guarnição mínima e máxima de cada função.
 *
 * B37 revisado (RN-07 a RN-12, RN-93, RN-96): o cadastro é de GUARNIÇÕES, não de viaturas.
 * Uma guarnição pode ou não estar numa viatura, e uma guarnição SEM viatura também pode ter
 * motorista que exige CNH (o motorista do ACO é o caso do usuário).
 *
 * Uma linha por GUARNIÇÃO + FUNÇÃO:
 *   VIGÊNCIA | GUARNIÇÃO | VIATURA | TIPO | ATIVAR | PRIORIDADE | CNH | FUNÇÃO | MÍNIMO | MÁXIMO
 *
 *   VIGÊNCIA         mês a partir do qual a linha vale ('aaaa-mm'; vazio = desde sempre)
 *   GUARNIÇÃO        identificação da guarnição; é o que liga o cadastro à coluna GUARNIÇÃO de
 *                    GUARNIÇÕES POR ESCALA (B58) e à coluna UNIDADE das alocações
 *   VIATURA          a viatura da guarnição, quando tem; vazio = guarnição sem viatura (RN-96)
 *   TIPO             texto livre (tipo da guarnição ou da viatura): nada aqui é fixo no código
 *   ATIVAR           SIM/NÃO — se a guarnição deve ser ativada no mês (RN-07)
 *   PRIORIDADE       ordem de ativação; 1 é a primeira, vazio vai por último (RN-08)
 *   CNH              categoria(s) exigida(s) de quem ocupa a FUNÇÃO da linha, COM OU SEM viatura;
 *                    vazio = a função não exige CNH (RN-12). B58 item 3: é POR FUNÇÃO — a função
 *                    que tem CNH é a de condutor, e só ela é checada (o MOTORISTA do ABT exige D,
 *                    o CHEFE não exige nada). Substitui a antiga coluna EXIGE CNH.
 *   FUNÇÃO           função da guarnição (vazio: linha só com os dados da guarnição)
 *   MÍNIMO           abaixo dele a guarnição não é ativada (RN-10)
 *   MÁXIMO           acima dele não se aloca mais ninguém naquela função; vazio = sem limite (RN-11)
 *
 * B58 item 1 (RN-09): a coluna TIPOS DE SERVIÇO saiu. Quais escalas e turnos uma guarnição atende
 * não é mais atributo da guarnição: é o vínculo explícito, linha a linha, de outra aba. Uma coluna
 * TIPOS DE SERVIÇO que ainda exista na planilha não é lida (e o botão de criar colunas a apaga,
 * se estiver vazia).
 *
 * A leitura é por nome de coluna, então acrescentar coluna depois não quebra nada — é assim que a
 * prioridade por função (B56) vai entrar, sem mudar a forma do cadastro.
 *
 * VIGÊNCIA (RN-93): alteração NÃO retroage. Para cada informação vale a linha mais recente que não
 * passa do mês pedido — a mesma regra dos parâmetros da aba CONFIGURAÇÕES. Então:
 *   - mudar só o mínimo de uma função = acrescentar UMA linha com a vigência do mês novo;
 *   - um mês já fechado continua lendo as linhas antigas, porque as novas são de vigência posterior;
 *   - tirar uma função de uma guarnição = linha nova com MÁXIMO 0.
 */

const CADG_MES_RE_ = /^\d{4}-(0[1-9]|1[0-2])$/;

/** '' (desde sempre) ou 'aaaa-mm'. Aceita também mm/aaaa. Retorna { ok, valor }. */
function cadgVigencia_(bruto) {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return { ok: true, valor: '' };
  if (CADG_MES_RE_.test(s)) return { ok: true, valor: s };
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(s);
  return m ? { ok: true, valor: m[2] + '-' + m[1] } : { ok: false, valor: '' };
}

/** SIM/NÃO da célula. Vazio devolve o padrão. */
function cadgSimNao_(bruto, padrao) {
  const n = normalizar_(bruto);
  if (n === '') return padrao;
  if (['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'].indexOf(n) >= 0) return true;
  if (['NAO', 'N', '0', 'FALSE', 'FALSO', '-'].indexOf(n) >= 0) return false;
  return padrao;
}

/** Lista separada por vírgula, ponto e vírgula ou barra -> ['B','D'] (sem acento/caixa, sem repetir). */
function cadgLista_(bruto) {
  return String(bruto == null ? '' : bruto).split(/[,;/]+/)
    .map(function (x) { return normalizar_(x); })
    .filter(function (x, i, a) { return x !== '' && a.indexOf(x) === i; });
}

/** Inteiro >= 0 da célula; '' devolve null (não informado). */
function cadgInteiro_(bruto) {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return NaN;
  return Number(s);
}

/**
 * RN-12: a CNH do militar atende a exigida pela guarnição?
 * exigidas vazio = não exige. Atende quem tem ao menos uma das categorias exigidas.
 * A hierarquia entre categorias NÃO está no código (nada de "D vale por B"): se na unidade
 * a D habilita a B, o escalante escreve as duas categorias na coluna CNH do militar.
 */
function cnhAtende_(doMilitar, exigidas) {
  const ex = (exigidas || []).slice();
  if (ex.length === 0) return true;
  const tem = (doMilitar || []).map(function (x) { return normalizar_(x); });
  return ex.some(function (c) { return tem.indexOf(normalizar_(c)) >= 0; });
}

/**
 * Valores em vigor num mês, por guarnição.
 * linhas: [{ linha, vigencia, guarnicao, viatura, tipo, ativar, prioridade, cnh, funcao, minimo, maximo }]
 * Retorna { guarnicoes: [...], porId: { CHAVE: guarnição }, avisos: [texto] }, cada guarnição =
 * { id, viatura, tipo, ativar, prioridade, cnh: [], funcoes: [{ funcao, minimo, maximo, cnh: [] }] },
 * em ordem de prioridade de ativação (RN-08) e, empatando, pelo nome.
 * As funções saem na ordem das linhas do cadastro (é a ordem dos postos na grade). A CNH da
 * guarnição (g.cnh) é a junção das CNHs das funções, só para resumo.
 */
function resolverGuarnicoes_(linhas, mes) {
  if (!CADG_MES_RE_.test(String(mes))) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const avisos = [];
  const porId = Object.create(null);
  const ordemEntrada = [];

  // só o que já está em vigor no mês (RN-93: o que vier depois não retroage)
  const validas = [];
  linhas.forEach(function (l) {
    const onde = 'GUARNIÇÕES, linha ' + l.linha;
    const id = String(l.guarnicao == null ? '' : l.guarnicao).trim();
    if (!id) return;
    const vig = cadgVigencia_(l.vigencia);
    if (!vig.ok) { avisos.push(onde + ': vigência "' + l.vigencia + '" inválida (use aaaa-mm); linha ignorada.'); return; }
    const min = cadgInteiro_(l.minimo), max = cadgInteiro_(l.maximo), prio = cadgInteiro_(l.prioridade);
    if (isNaN(min) || isNaN(max) || isNaN(prio)) {
      avisos.push(onde + ' (' + id + '): MÍNIMO, MÁXIMO e PRIORIDADE precisam ser números inteiros; linha ignorada.');
      return;
    }
    if (min !== null && max !== null && max < min) {
      avisos.push(onde + ' (' + id + (l.funcao ? ', ' + l.funcao : '') + '): o máximo (' + max + ') é menor que o mínimo (' + min + '); linha ignorada.');
      return;
    }
    if (vig.valor !== '' && vig.valor > mes) return;
    validas.push({ linha: l.linha, vig: vig.valor, id: id, chave: normalizar_(id), l: l, min: min, max: max, prio: prio });
  });

  // mais recente primeiro: a linha que vale é a primeira que informou cada dado
  validas.sort(function (a, b) { return a.vig === b.vig ? b.linha - a.linha : (a.vig < b.vig ? 1 : -1); });

  validas.forEach(function (r) {
    let g = porId[r.chave];
    if (!g) {
      g = porId[r.chave] = { id: r.id, viatura: null, tipo: '', ativar: null, prioridade: null, cnh: null, funcoes: [], _f: Object.create(null), _cnhSemFuncao: null };
      ordemEntrada.push(r.chave);
    }
    // dados da guarnição: vale o último informado até o mês (campo por campo)
    if (g.viatura === null && String(r.l.viatura == null ? '' : r.l.viatura).trim() !== '') g.viatura = String(r.l.viatura).trim();
    if (g.tipo === '' && String(r.l.tipo == null ? '' : r.l.tipo).trim() !== '') g.tipo = String(r.l.tipo).trim();
    if (g.ativar === null && normalizar_(r.l.ativar) !== '') g.ativar = cadgSimNao_(r.l.ativar, true);          // RN-07
    if (g.prioridade === null && r.prio !== null) g.prioridade = r.prio;                                       // RN-08
    // guarnição mínima e máxima: por função (RN-10, RN-11); a CNH também é por função (B58 item 3, RN-12)
    const f = String(r.l.funcao == null ? '' : r.l.funcao).trim();
    const cnh = cadgLista_(r.l.cnh);
    if (f) {
      const kf = normalizar_(f);
      if (!(kf in g._f)) g._f[kf] = { funcao: f, minimo: r.min === null ? 0 : r.min, maximo: r.max, cnh: null, ordem: r.linha };
      const fx = g._f[kf];
      if (fx.cnh === null && cnh.length) fx.cnh = cnh;     // como os dados da guarnição: vale a última CNH informada
      if (r.linha < fx.ordem) fx.ordem = r.linha;         // a posição da função é a da primeira linha dela
    } else if (cnh.length && g._cnhSemFuncao === null) {
      g._cnhSemFuncao = { linha: r.linha, cnh: cnh };
    }
  });

  const guarnicoes = ordemEntrada.map(function (k) {
    const g = porId[k];
    g.viatura = g.viatura || '';                         // vazio = guarnição sem viatura (RN-96)
    g.ativar = g.ativar === null ? true : g.ativar;      // RN-07: sem dizer nada, a guarnição é para ativar
    g.funcoes = Object.keys(g._f).map(function (kf) { return g._f[kf]; })
      .filter(function (f) { return f.maximo !== 0; })   // MÁXIMO 0 = função retirada dessa guarnição
      .sort(function (a, b) { return a.ordem - b.ordem; })
      .map(function (f) { return { funcao: f.funcao, minimo: f.minimo, maximo: f.maximo, cnh: f.cnh || [] }; });
    g.cnh = [];                                          // só para resumo: as categorias que alguma função exige
    g.funcoes.forEach(function (f) { f.cnh.forEach(function (c) { if (g.cnh.indexOf(c) < 0) g.cnh.push(c); }); });
    if (g._cnhSemFuncao) {
      avisos.push('GUARNIÇÕES, linha ' + g._cnhSemFuncao.linha + ' (' + g.id + '): CNH "' + g._cnhSemFuncao.cnh.join('/') +
        '" numa linha sem FUNÇÃO. A CNH é exigida de quem ocupa uma função (B58, RN-12): ponha a categoria na linha da função de condutor. Esta não vale para posto nenhum.');
    }
    delete g._f; delete g._cnhSemFuncao;
    return g;
  });
  // RN-08: prioridade 1 primeiro; sem prioridade vai por último
  guarnicoes.sort(function (a, b) {
    const pa = a.prioridade === null ? Infinity : a.prioridade, pb = b.prioridade === null ? Infinity : b.prioridade;
    if (pa !== pb) return pa - pb;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });
  return { guarnicoes: guarnicoes, porId: porId, avisos: avisos };
}

/** Guarnição pelo nome (o mesmo texto da coluna GUARNIÇÃO de GUARNIÇÕES POR ESCALA / da UNIDADE das alocações). */
function guarnicaoPorNome_(res, nome) {
  const k = normalizar_(nome);
  return k && res && res.porId[k] ? res.porId[k] : null;
}

/**
 * RN-10 / RN-11: confere a guarnição montada contra o mínimo e o máximo do cadastro.
 * contagem: { FUNÇÃO (normalizada ou não): quantos militares já estão nela }
 * Retorna { ativa, faltando: [{ funcao, minimo, tem, falta }], excedendo: [{ funcao, maximo, tem }], vagas: { FUNÇÃO: quantas ainda cabem } }
 */
function avaliarGuarnicao_(g, contagem) {
  const tem = Object.create(null);
  Object.keys(contagem || {}).forEach(function (k) { tem[normalizar_(k)] = contagem[k]; });
  const faltando = [], excedendo = [], vagas = Object.create(null);
  (g ? g.funcoes : []).forEach(function (f) {
    const n = tem[normalizar_(f.funcao)] || 0;
    if (n < f.minimo) faltando.push({ funcao: f.funcao, minimo: f.minimo, tem: n, falta: f.minimo - n });
    if (f.maximo !== null && n > f.maximo) excedendo.push({ funcao: f.funcao, maximo: f.maximo, tem: n });
    vagas[f.funcao] = f.maximo === null ? null : Math.max(0, f.maximo - n);
  });
  return { ativa: faltando.length === 0, faltando: faltando, excedendo: excedendo, vagas: vagas };
}
