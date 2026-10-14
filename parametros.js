/**
 * CONFIGURAÇÕES — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 *
 * Um parâmetro é um valor do sistema que pode mudar com o tempo (carga mensal do Adm,
 * saldos por militar, comandante que assina...). Cada linha da aba CONFIGURAÇÕES tem
 * CHAVE, VALOR e VIGÊNCIA (mês a partir do qual o valor vale; vazio = vale desde sempre).
 * Para um mês, vale a linha de vigência mais recente que não passa do mês.
 *
 * Para criar um parâmetro novo, acrescente uma entrada em PARAM_CATALOGO_ (e só isso):
 * ele aparece no painel e passa a ser lido com valorParametro_('CHAVE', 'aaaa-mm').
 */

/**
 * tipo: 'inteiro' | 'decimal' | 'texto' | 'simnao'
 * grupo: título da seção no painel.   min/max: só para números.
 * padrao: usado enquanto ninguém preencher nada.
 */
const PARAM_CATALOGO_ = [
  {
    chave: 'CARGA_MENSAL_HORAS', grupo: 'Carga mensal', rotulo: 'Carga mensal (horas)', tipo: 'inteiro', padrao: 160, min: 1, max: 744,
    descricao: 'Horas que todo militar precisa cumprir no mês.'
  },
  {
    chave: 'SALDOS_ADM_POR_MILITAR', grupo: 'Adm', rotulo: 'Saldos por militar do Adm', tipo: 'inteiro', padrao: 6, min: 0, max: 31,
    descricao: 'Quantos saldos cada militar do Adm tira por mês. O escalante aloca os saldos à mão.'
  },
  {
    chave: 'ADM_CUMPRE_CARGA', grupo: 'Adm', rotulo: 'Adm cumpre a carga mensal', tipo: 'simnao', padrao: false,
    descricao: 'NÃO: o Adm só cumpre os saldos e fica de expediente em todo dia útil (usado para checar choques). SIM: o Adm também cumpre a carga mensal, e a pré-escala distribui os turnos dele.'
  },
  {
    chave: 'LINHAS_POR_MILITAR', grupo: 'Escala', rotulo: 'Linhas por militar na escala', tipo: 'inteiro', padrao: 2, min: 1, max: 6,
    descricao: 'Quantas linhas cada militar tem na escala do mês: o espaço para o 1º, o 2º... serviço do dia. Vale na próxima vez que a escala for carregada.'
  },
  {
    chave: 'SECAO_PADRAO', grupo: 'Geral', rotulo: 'Seção padrão', tipo: 'texto', padrao: '1ª SB',
    descricao: 'Seção sugerida ao abrir os painéis.'
  }
];

const PARAM_MES_RE_ = /^\d{4}-(0[1-9]|1[0-2])$/;

function paramDef_(chave) {
  const k = normalizar_(chave);
  for (let i = 0; i < PARAM_CATALOGO_.length; i++) if (normalizar_(PARAM_CATALOGO_[i].chave) === k) return PARAM_CATALOGO_[i];
  return null;
}

/** Converte o que veio da célula/tela para o tipo do parâmetro. Retorna { ok, valor, erro }. */
function paramConverter_(def, bruto) {
  const falha = function (erro) { return { ok: false, valor: null, erro: erro }; };
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return falha('Informe um valor.');

  if (def.tipo === 'texto') {
    if (s.length > 120) return falha('Texto longo demais (máximo de 120 caracteres).');
    return { ok: true, valor: s, erro: '' };
  }
  if (def.tipo === 'simnao') {
    const n = normalizar_(s);
    if (['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'].indexOf(n) >= 0) return { ok: true, valor: true, erro: '' };
    if (['NAO', 'N', '0', 'FALSE', 'FALSO'].indexOf(n) >= 0) return { ok: true, valor: false, erro: '' };
    return falha('Use SIM ou NÃO.');
  }

  const t = s.replace(',', '.');
  const inteiro = def.tipo === 'inteiro';
  if (!(inteiro ? /^-?\d+(\.0+)?$/ : /^-?\d+(\.\d+)?$/).test(t)) return falha(inteiro ? 'Use um número inteiro.' : 'Use um número.');
  const v = Number(t);
  if (def.min != null && v < def.min) return falha('O mínimo é ' + def.min + '.');
  if (def.max != null && v > def.max) return falha('O máximo é ' + def.max + '.');
  return { ok: true, valor: v, erro: '' };
}

/** '' (vale desde sempre) ou 'aaaa-mm'. Retorna { ok, valor, erro }. */
function paramVigencia_(bruto) {
  const s = String(bruto == null ? '' : bruto).trim();
  if (s === '') return { ok: true, valor: '', erro: '' };
  if (PARAM_MES_RE_.test(s)) return { ok: true, valor: s, erro: '' };
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(s);
  if (m) return { ok: true, valor: m[2] + '-' + m[1], erro: '' };
  return { ok: false, valor: '', erro: 'Mês inválido: use o formato aaaa-mm.' };
}

/**
 * Confere todas as linhas da aba e separa as boas das ruins.
 * linhas: [{ linha, chave, valor, vigencia }]
 * Retorna { boas: [{ linha, chave, def, valor, vigencia }], avisos: [texto] }
 */
function paramValidarLinhas_(linhas) {
  const boas = [], avisos = [];
  linhas.forEach(function (l) {
    const nome = 'Linha ' + l.linha + ' de CONFIGURAÇÕES';
    const def = paramDef_(l.chave);
    if (!def) { avisos.push(nome + ': a chave "' + l.chave + '" não existe; ignorada.'); return; }
    const vig = paramVigencia_(l.vigencia);
    if (!vig.ok) { avisos.push(nome + ' (' + def.chave + '): vigência "' + l.vigencia + '" inválida; ignorada.'); return; }
    const c = paramConverter_(def, l.valor);
    if (!c.ok) { avisos.push(nome + ' (' + def.chave + '): ' + c.erro + ' Linha ignorada.'); return; }
    boas.push({ linha: l.linha, chave: def.chave, def: def, valor: c.valor, vigencia: vig.valor });
  });
  return { boas: boas, avisos: avisos };
}

/**
 * Valores em vigor num mês.
 * Retorna { valores: { CHAVE: valor }, origem: { CHAVE: { vigencia, linha, padrao } }, avisos }
 */
function resolverParametros_(linhas, mes) {
  if (!PARAM_MES_RE_.test(String(mes))) throw new Error('Mês inválido: use o formato aaaa-mm.');
  const v = paramValidarLinhas_(linhas);
  const valores = {}, origem = {};
  PARAM_CATALOGO_.forEach(function (def) {
    const cands = v.boas.filter(function (b) { return b.chave === def.chave && (b.vigencia === '' || b.vigencia <= mes); });
    cands.sort(function (a, b) { return a.vigencia === b.vigencia ? a.linha - b.linha : (a.vigencia < b.vigencia ? -1 : 1); });
    const w = cands.length ? cands[cands.length - 1] : null;
    valores[def.chave] = w ? w.valor : def.padrao;
    origem[def.chave] = w ? { vigencia: w.vigencia, linha: w.linha, padrao: false } : { vigencia: '', linha: 0, padrao: true };
  });
  return { valores: valores, origem: origem, avisos: v.avisos };
}

/** Histórico de uma chave, da vigência mais antiga para a mais nova. */
function historicoParametro_(linhas, chave) {
  const v = paramValidarLinhas_(linhas);
  return v.boas
    .filter(function (b) { return b.chave === chave; })
    .sort(function (a, b) { return a.vigencia === b.vigencia ? a.linha - b.linha : (a.vigencia < b.vigencia ? -1 : 1); })
    .map(function (b) { return { linha: b.linha, vigencia: b.vigencia, valor: b.valor }; });
}

/* ------------------------------------------------------------ carga do Adm */

/** Dias úteis do mês: segunda a sexta, menos os feriados. feriados = { 'aaaa-mm-dd': true }. */
function diasUteisDoMes_(mes, feriados) {
  feriados = feriados || {};
  return diasDoMes_(mes).filter(function (d) { const w = diaDaSemana_(d); return w >= 1 && w <= 5 && !feriados[d]; });
}

/**
 * Quanto do mês sobra para o serviço normal do Adm depois dos saldos.
 * p: { carga, saldos, horasSaldo, horasTurnoAdm, diasUteis }   (horas e contagens)
 * Os saldos são tapa-buraco e ficam fora da automação: aqui eles só abatem a carga.
 * Arredonda os turnos para cima, para nunca ficar abaixo da carga.
 */
function calcularCargaAdm_(p) {
  const horasSaldos = p.saldos * p.horasSaldo;
  const horasNormais = Math.max(0, p.carga - horasSaldos);
  const turnosAdm = p.horasTurnoAdm > 0 ? Math.ceil(horasNormais / p.horasTurnoAdm) : 0;
  return {
    carga: p.carga,
    horasSaldos: horasSaldos,
    horasNormais: horasNormais,
    turnosAdm: turnosAdm,
    diasUteis: p.diasUteis,
    cabe: turnosAdm <= p.diasUteis,
    saldosDemais: horasSaldos > p.carga
  };
}

/**
 * Duração de um saldo, lida do catálogo de turnos (serviço "Saldo").
 * porChave: o porChave de montarHorarios_.   Retorna { horas, achou }.
 */
function horasDoSaldo_(porChave) {
  const chaves = Object.keys(porChave).filter(function (k) { return normalizar_(k.split('|')[0]) === 'SALDO'; }).sort();
  if (!chaves.length) return { horas: 12, achou: false };
  return { horas: porChave[chaves[0]].dur / 60, achou: true };
}