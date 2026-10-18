/**
 * REGRAS DA ESCALA MANUAL — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 *
 * Valem quando o escalante salva a escala (sincronia) e na conferência de integridade.
 * Cada regra olha a lista de alocações e devolve as que a violam:
 *   RN-03  Saldo só para militar do Adm.
 *   RN-36  no máximo uma diária por militar por dia, contada pelo dia em que o turno COMEÇA;
 *   RN-37  a dobradinha é permitida (16h–00h do dia D + 00h–08h do dia D+1 começam em dias diferentes);
 *   RN-46  JES só para militar com o atributo "voluntário JES" = sim (aba MILITARES); RN-39: só quem tem o
 *          atributo pode preencher o formulário do mês (as linhas dos demais, no VOLUNTARIADO, são ignoradas).
 *
 * contexto (ctx), montado pela camada do Sheets (contextoDeRegras_):
 *   adm   : { matrícula: true }        militares da jornada Adm (aba MILITARES)
 *   tipos : { 'Serviço': 'Tipo' }      coluna TIPO DE SERVIÇO da aba TURNOS ("Diária" é o que importa)
 *   voluntariosJes : { matrícula: true } | null   quem é voluntário JES; null = a aba MILITARES não tem a coluna
 *                                      (a regra RN-46 fica desligada, com aviso na tela)
 * Depende de distribuicao_cotas.js (TIPO_DIARIA_) e nucleo.js (normalizar_).
 */

const SERVICO_SALDO_ = 'SALDO';

function ehSaldo_(servico) { return normalizar_(servico) === SERVICO_SALDO_; }

/** RN-03: o Saldo só pode ser lançado para militar do Adm. */
function violacoesSaldo_(alocs, ctx) {
  const adm = ctx.adm || {};
  const res = [];
  alocs.forEach(function (a) {
    if (!ehSaldo_(a.servico) || adm[a.mat]) return;
    res.push({ chave: chaveAloc_(a), mat: a.mat, dia: a.dia, servico: a.servico, turno: a.turno, rn: 'RN-03', texto: 'Saldo só para militar do Adm (RN-03)' });
  });
  return res;
}

/**
 * RN-36 / RN-37: duas diárias do mesmo militar com início no mesmo dia. Diária é o serviço cujo tipo,
 * na aba TURNOS, é "Diária". Todas as alocações do grupo são apontadas (a pessoa decide qual sai).
 */
function violacoesDiariaUnica_(alocs, ctx) {
  const tipos = ctx.tipos || {};
  const grupos = Object.create(null);
  alocs.forEach(function (a) {
    if (normalizar_(tipos[a.servico] || '') !== TIPO_DIARIA_) return;
    const g = a.mat + '|' + a.dia;
    const k = chaveAloc_(a);
    if (!grupos[g]) grupos[g] = Object.create(null);
    if (!(k in grupos[g])) grupos[g][k] = a;
  });
  const res = [];
  Object.keys(grupos).forEach(function (g) {
    const chaves = Object.keys(grupos[g]);
    if (chaves.length < 2) return;
    chaves.forEach(function (k) {
      const a = grupos[g][k];
      res.push({ chave: k, mat: a.mat, dia: a.dia, servico: a.servico, turno: a.turno, rn: 'RN-36', texto: 'Duas diárias começando no mesmo dia (RN-36)' });
    });
  });
  return res;
}

// serviços que só militar voluntário pode cumprir (RN-46). Defensoria e CPRH, mesmo sendo PJES, ficam de fora até o SECRETARIADO decidir.
const SERVICOS_SO_VOLUNTARIOS_ = ['JES'];

function exigeVoluntarioJes_(servico) { return SERVICOS_SO_VOLUNTARIOS_.indexOf(normalizar_(servico)) >= 0; }

/** RN-46: JES lançado para militar que não é voluntário. Sem a coluna (voluntariosJes null) a regra não age. */
function violacoesJesVoluntario_(alocs, ctx) {
  const vol = ctx.voluntariosJes;
  if (!vol) return [];
  const res = [];
  alocs.forEach(function (a) {
    if (!exigeVoluntarioJes_(a.servico) || vol[a.mat]) return;
    res.push({ chave: chaveAloc_(a), mat: a.mat, dia: a.dia, servico: a.servico, turno: a.turno, rn: 'RN-46', texto: 'JES só para militar voluntário (VOLUNTÁRIO JES = sim) (RN-46)' });
  });
  return res;
}

/**
 * RN-46 / RN-39: as linhas do VOLUNTARIADO de quem não é voluntário JES são ignoradas (e não contam como "preencheu
 * o formulário"). voluntariosJes null (sem a coluna em MILITARES): nada é ignorado.
 * linhas: [{ mat, ... }]. Retorna { linhas, ignoradas: { matrícula: quantidade } }.
 */
function separarVoluntariado_(linhas, voluntariosJes) {
  if (!voluntariosJes) return { linhas: linhas.slice(), ignoradas: {} };
  const ignoradas = Object.create(null), validas = [];
  linhas.forEach(function (l) {
    if (voluntariosJes[l.mat]) validas.push(l);
    else ignoradas[l.mat] = (ignoradas[l.mat] || 0) + 1;
  });
  return { linhas: validas, ignoradas: ignoradas };
}

/** Todas as verificações, na ordem em que aparecem para o usuário. */
const VERIFICACOES_ESCALA_ = [violacoesSaldo_, violacoesDiariaUnica_, violacoesJesVoluntario_];

/** alocs: [{ mat, dia, servico, turno }]. Retorna [{ chave, mat, dia, servico, turno, rn, texto }]. Ignora o expediente implícito. */
function violacoesDeRegras_(alocs, ctx) {
  const reais = alocs.filter(function (a) { return !a.implicito; });
  let res = [];
  VERIFICACOES_ESCALA_.forEach(function (v) { res = res.concat(v(reais, ctx || {})); });
  return res;
}

/**
 * Lista suspensa da célula: "comSaldo" para as linhas de militar do Adm; "semSaldo" para as demais (RN-03).
 * rot: o de montarRotulos_.
 */
function listasDeCelula_(rot) {
  const semSaldo = rot.lista.filter(function (t) {
    const p = rot.porRotulo[chaveDoRotulo_(t)];
    return !(p && ehSaldo_(p.servico));
  });
  return { comSaldo: rot.lista.slice(), semSaldo: semSaldo };
}

/**
 * Bloqueia, no resultado da sincronia, as inclusões (e trocas) que violariam uma regra. Simula a tabela
 * como ficaria depois de aplicar tudo; violações que já existiam entre alocações que você não mexeu não
 * bloqueiam nada (aparecem na conferência de integridade). Numa troca bloqueada, a linha antiga
 * também fica como está (a troca é tudo ou nada).
 * todas: TODAS as linhas da tabela, de todos os meses [{ mat, dia, turno, servico, linha, implicito }]
 */
function bloquearPorRegras_(res, todas, ctx) {
  res.regras = res.regras || [];
  if (res.inserir.length === 0) return;
  const mudadas = Object.create(null);
  res.inserir.forEach(function (i) { mudadas[i.chave] = true; });
  const removidas = Object.create(null);
  res.remover.forEach(function (r) { r.linhas.forEach(function (l) { removidas[l] = true; }); });

  const estado = [];
  todas.forEach(function (a) {
    if (a.implicito || removidas[a.linha]) return;
    estado.push({ mat: a.mat, dia: a.dia, turno: a.turno, servico: a.servico });
  });
  res.inserir.forEach(function (i) { estado.push({ mat: i.mat, dia: i.dia, turno: i.turno, servico: i.servico }); });

  const motivos = Object.create(null);                 // chave -> [{ rn, texto }]
  violacoesDeRegras_(estado, ctx).forEach(function (v) {
    if (!mudadas[v.chave]) return;
    (motivos[v.chave] = motivos[v.chave] || []).push({ rn: v.rn, texto: v.texto });
  });
  if (Object.keys(motivos).length === 0) return;

  const antigas = Object.create(null);
  res.inserir = res.inserir.filter(function (i) {
    if (!motivos[i.chave]) return true;
    const p = partesDaChave_(i.chave);
    const de = i.troca ? { servico: partesDaChave_(i.troca).servico, turno: partesDaChave_(i.troca).turno } : null;
    if (i.troca) antigas[i.troca] = true;
    res.regras.push({ chave: i.chave, mat: p.mat, dia: p.dia, servico: p.servico, turno: p.turno, tipo: i.troca ? 'alteracao' : 'inclusao', de: de, para: { servico: p.servico, turno: p.turno }, motivos: motivos[i.chave] });
    return false;
  });
  res.remover = res.remover.filter(function (r) { return !antigas[r.chave]; });
  res.aplicadas = res.aplicadas.filter(function (k) { return !motivos[k] && !antigas[k]; });
  res.regras.sort(function (x, y) { return x.chave < y.chave ? -1 : 1; });
}
