/**
 * VIATURAS — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 * Depende de nucleo.gs (normalizar_).
 *
 * Cadastro das viaturas (RN-07 a RN-12), com vigência mensal (RN-93). Fica numa aba da planilha
 * (VIATURAS), editada pelo escalante; o painel de Configurações só dá o atalho para ela.
 *
 * Uma linha por VIATURA + FUNÇÃO:
 *   VIGÊNCIA | VIATURA | TIPO | ATIVAR | PRIORIDADE | TIPOS DE SERVIÇO | CNH | FUNÇÃO | MÍNIMO | MÁXIMO
 *
 *   VIGÊNCIA         mês a partir do qual a linha vale ('aaaa-mm'; vazio = desde sempre)
 *   VIATURA          identificação (AR, ABTS, ACO...); "efetivo do quartel" também entra como viatura
 *   TIPO             tipo da viatura, livre: nada aqui é fixo no código
 *   ATIVAR           SIM/NÃO — se a viatura deve ser ativada no mês (RN-07)
 *   PRIORIDADE       ordem de ativação; 1 é a primeira, vazio vai por último (RN-08)
 *   TIPOS DE SERVIÇO quais serviços podem incluir militares nela; vazio = todos (RN-09)
 *   CNH              categoria(s) exigida(s) para conduzi-la; vazio = não exige (RN-12)
 *   FUNÇÃO           função da guarnição (vazio: linha só com os dados da viatura)
 *   MÍNIMO           abaixo dele a viatura não é ativada (RN-10)
 *   MÁXIMO           acima dele não se aloca mais ninguém naquela função; vazio = sem limite (RN-11)
 *
 * VIGÊNCIA (RN-93): alteração NÃO retroage. Para cada informação vale a linha mais recente que não
 * passa do mês pedido — a mesma regra dos parâmetros da aba CONFIGURAÇÕES. Então:
 *   - mudar só o mínimo de uma função = acrescentar UMA linha com a vigência do mês novo;
 *   - um mês já fechado continua lendo as linhas antigas, porque as novas são de vigência posterior;
 *   - tirar uma função de uma viatura = linha nova com MÁXIMO 0.
 */

const VIAT_MES_RE_ = /^\d{4}-(0[1-9]|1[0-2])$/;

/** '' (desde sempre) ou 'aaaa-mm'. Aceita também mm/aaaa. Retorna { ok, valor }. */
function viatVigencia_(bruto) {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return { ok: true, valor: '' };
  if (VIAT_MES_RE_.test(s)) return { ok: true, valor: s };
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(s);
  return m ? { ok: true, valor: m[2] + '-' + m[1] } : { ok: false, valor: '' };
}

/** SIM/NÃO da célula. Vazio devolve o padrão. */
function viatSimNao_(bruto, padrao) {
  const n = normalizar_(bruto);
  if (n === '') return padrao;
  if (['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'].indexOf(n) >= 0) return true;
  if (['NAO', 'N', '0', 'FALSE', 'FALSO', '-'].indexOf(n) >= 0) return false;
  return padrao;
}

/** Lista separada por vírgula, ponto e vírgula ou barra -> ['B','D'] (sem acento/caixa, sem repetir). */
function viatLista_(bruto) {
  return String(bruto == null ? '' : bruto).split(/[,;/]+/)
    .map(function (x) { return normalizar_(x); })
    .filter(function (x, i, a) { return x !== '' && a.indexOf(x) === i; });
}

/** Inteiro >= 0 da célula; '' devolve null (não informado). */
function viatInteiro_(bruto) {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return NaN;
  return Number(s);
}

/**
 * RN-12: a CNH do militar atende a exigida pela viatura?
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
 * Valores em vigor num mês, por viatura.
 * linhas: [{ linha, vigencia, viatura, tipo, ativar, prioridade, servicos, cnh, funcao, minimo, maximo }]
 * Retorna { viaturas: [...], porId: { CHAVE: viatura }, avisos: [texto] },
 * cada viatura = { id, tipo, ativar, prioridade, servicos: [], cnh: [], funcoes: [{ funcao, minimo, maximo }] },
 * em ordem de prioridade de ativação (RN-08) e, empatando, pelo nome.
 */
function resolverViaturas_(linhas, mes) {
  if (!VIAT_MES_RE_.test(String(mes))) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const avisos = [];
  const porId = Object.create(null);
  const ordemEntrada = [];

  // só o que já está em vigor no mês (RN-93: o que vier depois não retroage)
  const validas = [];
  linhas.forEach(function (l) {
    const onde = 'VIATURAS, linha ' + l.linha;
    const id = String(l.viatura == null ? '' : l.viatura).trim();
    if (!id) return;
    const vig = viatVigencia_(l.vigencia);
    if (!vig.ok) { avisos.push(onde + ': vigência "' + l.vigencia + '" inválida (use aaaa-mm); linha ignorada.'); return; }
    const min = viatInteiro_(l.minimo), max = viatInteiro_(l.maximo), prio = viatInteiro_(l.prioridade);
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
    let v = porId[r.chave];
    if (!v) {
      v = porId[r.chave] = { id: r.id, tipo: '', ativar: null, prioridade: null, servicos: null, cnh: null, funcoes: [], _f: Object.create(null) };
      ordemEntrada.push(r.chave);
    }
    // dados da viatura: vale o último informado até o mês (campo por campo)
    if (v.tipo === '' && String(r.l.tipo == null ? '' : r.l.tipo).trim() !== '') v.tipo = String(r.l.tipo).trim();
    if (v.ativar === null && normalizar_(r.l.ativar) !== '') v.ativar = viatSimNao_(r.l.ativar, true);          // RN-07
    if (v.prioridade === null && r.prio !== null) v.prioridade = r.prio;                                        // RN-08
    if (v.servicos === null && viatLista_(r.l.servicos).length) v.servicos = viatLista_(r.l.servicos);           // RN-09
    if (v.cnh === null && viatLista_(r.l.cnh).length) v.cnh = viatLista_(r.l.cnh);                               // RN-12
    // guarnição mínima e máxima: por função (RN-10, RN-11)
    const f = String(r.l.funcao == null ? '' : r.l.funcao).trim();
    if (f) {
      const kf = normalizar_(f);
      if (!(kf in v._f)) v._f[kf] = { funcao: f, minimo: r.min === null ? 0 : r.min, maximo: r.max };
    }
  });

  const viaturas = ordemEntrada.map(function (k) {
    const v = porId[k];
    v.ativar = v.ativar === null ? true : v.ativar;      // RN-07: sem dizer nada, a viatura é para ativar
    v.servicos = v.servicos || [];                       // vazio = serve a qualquer serviço
    v.cnh = v.cnh || [];                                 // vazio = não exige categoria
    v.funcoes = Object.keys(v._f).map(function (kf) { return v._f[kf]; })
      .filter(function (f) { return f.maximo !== 0; })   // MÁXIMO 0 = função retirada dessa viatura
      .sort(function (a, b) { return a.funcao < b.funcao ? -1 : (a.funcao > b.funcao ? 1 : 0); });
    delete v._f;
    return v;
  });
  // RN-08: prioridade 1 primeiro; sem prioridade vai por último
  viaturas.sort(function (a, b) {
    const pa = a.prioridade === null ? Infinity : a.prioridade, pb = b.prioridade === null ? Infinity : b.prioridade;
    if (pa !== pb) return pa - pb;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });
  return { viaturas: viaturas, porId: porId, avisos: avisos };
}

/** A viatura aceita militares deste serviço? (RN-09; sem lista cadastrada, aceita todos.) */
function viaturaAceitaServico_(viatura, servico) {
  if (!viatura || !viatura.servicos.length) return true;
  return viatura.servicos.indexOf(normalizar_(servico)) >= 0;
}

/** Viatura pelo nome (o mesmo texto da coluna UNIDADE de MODELOS DE GUARNIÇÃO / das alocações). */
function viaturaPorNome_(res, nome) {
  const k = normalizar_(nome);
  return k && res && res.porId[k] ? res.porId[k] : null;
}

/**
 * RN-10 / RN-11: confere a guarnição montada contra o mínimo e o máximo da viatura.
 * contagem: { FUNÇÃO (normalizada ou não): quantos militares já estão nela }
 * Retorna { ativa, faltando: [{ funcao, minimo, tem, falta }], excedendo: [{ funcao, maximo, tem }], vagas: { FUNÇÃO: quantas ainda cabem } }
 */
function avaliarGuarnicao_(viatura, contagem) {
  const tem = Object.create(null);
  Object.keys(contagem || {}).forEach(function (k) { tem[normalizar_(k)] = contagem[k]; });
  const faltando = [], excedendo = [], vagas = Object.create(null);
  (viatura ? viatura.funcoes : []).forEach(function (f) {
    const n = tem[normalizar_(f.funcao)] || 0;
    if (n < f.minimo) faltando.push({ funcao: f.funcao, minimo: f.minimo, tem: n, falta: f.minimo - n });
    if (f.maximo !== null && n > f.maximo) excedendo.push({ funcao: f.funcao, maximo: f.maximo, tem: n });
    vagas[f.funcao] = f.maximo === null ? null : Math.max(0, f.maximo - n);
  });
  return { ativa: faltando.length === 0, faltando: faltando, excedendo: excedendo, vagas: vagas };
}
