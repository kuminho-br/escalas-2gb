/**
 * GUARNIÇÕES — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 * Depende de nucleo.gs (normalizar_, diasDoMes_, diaDaSemana_, nomeExibicao_),
 * sincronia.js (chaveAloc_, bloquearPorChoque_) e choques.js.
 *
 * IDEIA
 *   Cada ESCALA (Defensoria, PE Seguro, Bioma, CPRH, Pronto...) tem um molde:
 *   quais postos (guarnição e função) existem em cada turno.
 *
 *   B58 (RN-07 a RN-12, RN-93, RN-96): o molde sai de DUAS abas, cada uma com um papel só.
 *     GUARNIÇÕES           a composição de cada guarnição (função, mínimo, máximo, CNH)
 *     GUARNIÇÕES POR ESCALA o vínculo: VIGÊNCIA | ESCALA | TURNO | GUARNIÇÃO
 *   Cada guarnição vinculada a uma escala/turno vira um posto por vaga de cada função dela
 *   (vinculosParaModelo_). A composição não se repete por escala: muda num lugar só.
 *   A grade mostra, para cada dia e turno, uma linha por posto. Quem ocupa o
 *   posto fica gravado na própria alocação (colunas FUNÇÃO e UNIDADE da tabela
 *   ALOCAÇÕES): não existe uma segunda tabela de "quem faz o quê".
 *
 *   MILITARES = ESCALADOS : só entram nos postos militares que JÁ têm alocação nesse
 *                           serviço, dia e turno (ex.: Pronto). Preencher o posto
 *                           grava a função; esvaziar apaga só a função.
 *   MILITARES = TODOS     : qualquer militar pode ser posto no posto (ex.: Bioma).
 *                           Preencher o posto CRIA a alocação; esvaziar a APAGA.
 *                           Só vale para escalas de um único serviço.
 *
 * Como na sincronia da matriz, a gravação compara três vias (referência da grade,
 * grade atual, tabela atual) e só grava o que você mudou; se outra pessoa mexeu
 * na mesma alocação, vira conflito e não é gravada.
 */

const GUARN_DIAS_SEMANA_ = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const GUARN_MESES_ = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
// B49 item 2 (RN-13, RN-94): o "JES aparece como PJES" saiu daqui e virou a coluna ORIGEM da aba
// TURNOS (ver origemDoServico_ em nucleo.gs).

/* ------------------------------------------------------------ pequenos utilitários */

/** 'SD ESCOBAR (722050-2)' — o texto que aparece no dropdown. */
function rotuloMilitar_(m, mat) {
  return m ? nomeExibicao_(m) + ' (' + m.mat + ')' : '(' + mat + ')';
}

/** Matrícula entre parênteses no fim do texto; '' se não houver. */
function matriculaDoRotulo_(txt) {
  const m = String(txt == null ? '' : txt).trim().match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim() : '';
}

/** minutos desde 00:00 -> 'HH:MM'. */
function horaCompleta_(min) {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function mesPorExtenso_(mes) {
  const p = mes.split('-');
  return GUARN_MESES_[Number(p[1]) - 1] + ' / ' + p[0];
}

/**
 * Chave de um militar num bloco da grade (dia + letra do turno). A grade de guarnição agrupa por
 * dia e letra de turno, não por serviço; por isso ela tem a própria chave e não usa chaveAloc_.
 * Só na hora de checar choque é que se usa a chave completa (serviço incluído).
 */
function chaveBloco_(a) { return a.mat + '|' + a.dia + '|' + a.turno; }

function chaveSlot_(unidade, funcao) { return normalizar_(unidade) + '|' + normalizar_(funcao); }

/* ------------------------------------------------------------ modelos */

const GUARN_VINCULO_ABA_ = 'GUARNIÇÕES POR ESCALA';

/**
 * B58 itens 2 e 3 (RN-09, RN-93, RN-10 a RN-12): do vínculo ESCALA/TURNO → GUARNIÇÃO para as
 * linhas de posto que montarModelosGuarnicao_ entende.
 *
 * vinculos: [{ linha, vigencia, escala, turno, guarnicao }]   (aba GUARNIÇÕES POR ESCALA)
 * cadastro: resultado de resolverGuarnicoes_ no MÊS pedido     (aba GUARNIÇÕES)
 * mes     : 'aaaa-mm'
 *
 * VIGÊNCIA (RN-93), por ESCALA: vale o conjunto de linhas da vigência mais recente que não passa
 * do mês. Mudar o vínculo de uma escala a partir de um mês = escrever de novo, com a vigência
 * nova, as linhas dela (todas as que continuam valendo). Um mês já fechado continua lendo as
 * antigas. Vazio = desde sempre.
 *
 * Cada função da guarnição vira uma linha de posto com:
 *   vagas    = MÁXIMO (sem máximo: o MÍNIMO, e pelo menos 1) — é quantos postos a grade mostra
 *   exigeCnh = a função tem CNH no cadastro (B58 item 3: é ela a de condutor)
 *   cnh      = as categorias exigidas dessa função
 * Guarnição que não está no cadastro, desativada no mês (RN-07) ou sem função: não gera posto, e
 * avisa. Retorna { linhas: [{ escala, turno, unidade, funcao, vagas, exigeCnh, cnh, guarnicao }], avisos }.
 */
function vinculosParaModelo_(vinculos, cadastro, mes) {
  const avisos = [], linhas = [];
  const t = function (v) { return String(v == null ? '' : v).trim(); };
  const onde = function (l) { return GUARN_VINCULO_ABA_ + ', linha ' + l.linha; };
  const validas = [];
  (vinculos || []).forEach(function (l) {
    if (!t(l.escala) && !t(l.guarnicao)) return;                                  // linha vazia
    if (!t(l.escala)) { avisos.push(onde(l) + ': GUARNIÇÃO "' + t(l.guarnicao) + '" sem ESCALA; linha ignorada.'); return; }
    if (!t(l.guarnicao)) { avisos.push(onde(l) + ': a escala "' + t(l.escala) + '" está sem GUARNIÇÃO; linha ignorada.'); return; }
    const vig = cadgVigencia_(l.vigencia);
    if (!vig.ok) { avisos.push(onde(l) + ': vigência "' + t(l.vigencia) + '" inválida (use aaaa-mm); linha ignorada.'); return; }
    if (vig.valor !== '' && vig.valor > mes) return;                              // ainda não vale (RN-93)
    validas.push({ l: l, vig: vig.valor, esc: normalizar_(l.escala) });
  });
  // a vigência mais recente de cada escala
  const vigDaEscala = Object.create(null);
  validas.forEach(function (v) { if (!(v.esc in vigDaEscala) || v.vig > vigDaEscala[v.esc]) vigDaEscala[v.esc] = v.vig; });

  const vistos = Object.create(null);
  validas.filter(function (v) { return v.vig === vigDaEscala[v.esc]; }).forEach(function (v) {
    const l = v.l;
    const turno = t(l.turno) || 'TODOS';
    const k = v.esc + '|' + normalizar_(turno) + '|' + normalizar_(l.guarnicao);
    if (vistos[k]) { avisos.push(onde(l) + ': "' + t(l.guarnicao) + '" já está vinculada à escala "' + t(l.escala) + '" no turno ' + turno + '; a repetição foi ignorada.'); return; }
    vistos[k] = true;
    const g = cadastro && cadastro.porId ? cadastro.porId[normalizar_(l.guarnicao)] : null;
    if (!g) {
      avisos.push(onde(l) + ': a guarnição "' + t(l.guarnicao) + '" não está na aba GUARNIÇÕES em ' + mes + ' (confira se o nome é igual ao da coluna GUARNIÇÃO de lá). Ela não gera posto na escala "' + t(l.escala) + '".');
      return;
    }
    if (!g.ativar) { avisos.push(onde(l) + ': a guarnição "' + g.id + '" está com ATIVAR = NÃO em ' + mes + ' (RN-07); ela não gera posto na escala "' + t(l.escala) + '".'); return; }
    if (!g.funcoes.length) { avisos.push(onde(l) + ': a guarnição "' + g.id + '" não tem nenhuma função cadastrada em GUARNIÇÕES; ela não gera posto.'); return; }
    g.funcoes.forEach(function (f) {
      const vagas = f.maximo !== null ? f.maximo : Math.max(f.minimo, 1);
      linhas.push({ escala: t(l.escala), turno: turno, unidade: g.id, funcao: f.funcao, vagas: vagas, exigeCnh: f.cnh.length > 0, cnh: f.cnh.slice(), guarnicao: g.id });
    });
  });
  return { linhas: linhas, avisos: avisos };
}

/**
 * B58 item 2: as linhas do formato antigo (ex-MODELOS DE GUARNIÇÃO) viram vínculos.
 * linhas: [{ escala, turno, unidade }] — uma por função, como era. Cada ESCALA + TURNO + UNIDADE
 * preenchida vira UM vínculo, com a UNIDADE como GUARNIÇÃO (o mesmo valor, coluna renomeada).
 * Linha sem UNIDADE não tem guarnição para vincular e não vira nada.
 * Retorna { linhas: [{ escala, turno, guarnicao }], semUnidade, escalasSemVinculo: [nomes] }.
 */
function converterVinculosAntigos_(linhas) {
  const t = function (v) { return String(v == null ? '' : v).trim(); };
  const out = [], vistos = Object.create(null), comVinculo = Object.create(null), escalas = [];
  let semUnidade = 0;
  (linhas || []).forEach(function (l) {
    const esc = t(l.escala);
    if (!esc) return;
    if (escalas.indexOf(esc) < 0) escalas.push(esc);
    const uni = t(l.unidade);
    if (!uni) { semUnidade++; return; }
    const turno = t(l.turno) || 'TODOS';
    const k = normalizar_(esc) + '|' + normalizar_(turno) + '|' + normalizar_(uni);
    comVinculo[esc] = true;
    if (vistos[k]) return;
    vistos[k] = true;
    out.push({ escala: esc, turno: turno, guarnicao: uni });
  });
  return { linhas: out, semUnidade: semUnidade, escalasSemVinculo: escalas.filter(function (e) { return !comVinculo[e]; }) };
}

/**
 * linhasEscalas : [{ escala, servicos, titulo, militares, dias }]       (textos da aba ESCALAS)
 * linhasModelo  : [{ escala, turno, unidade, funcao, vagas, exigeCnh, cnh }]
 *                 B58: vêm de vinculosParaModelo_ (exigeCnh booleano, cnh = categorias da função).
 *                 No formato antigo de GUARNIÇÕES POR ESCALA (ex-MODELOS DE GUARNIÇÃO: UNIDADE,
 *                 FUNÇÃO, VAGAS, EXIGE CNH) vêm direto da aba, com exigeCnh em texto.
 * turnosPorServico : { 'Pronto': ['A','B'], ... }                      (aba TURNOS, na ordem em que aparecem)
 * opcoes        : { aba } — o nome da aba de postos, para os avisos
 *
 * Retorna { escalas: { nome: {nome, servicos[], titulo, militares, dias, turnos[], slots:{turno:[{unidade,funcao,vagas,exigeCnh,cnh}]}, usaUnidade} },
 *           ordem: [nomes], avisos: [texto] }
 * Escala com problema grave (serviço inexistente, sem molde) é descartada COM aviso.
 */
function montarModelosGuarnicao_(linhasEscalas, linhasModelo, turnosPorServico, opcoes) {
  const ABA = (opcoes && opcoes.aba) || GUARN_VINCULO_ABA_;
  const avisos = [], escalas = Object.create(null), ordem = [];
  const servicoPorNome = Object.create(null);
  Object.keys(turnosPorServico).forEach(function (s) { servicoPorNome[normalizar_(s)] = s; });
  const t = function (v) { return String(v == null ? '' : v).trim(); };

  linhasEscalas.forEach(function (l) {
    const nome = t(l.escala);
    if (!nome) return;
    if (escalas[nome]) { avisos.push('ESCALAS: "' + nome + '" aparece mais de uma vez; vale a primeira.'); return; }

    let pedidos = t(l.servicos).split(/[,;]/).map(t).filter(Boolean);
    if (pedidos.length === 0) pedidos = [nome];
    const servicos = [], faltando = [];
    pedidos.forEach(function (p) {
      const c = servicoPorNome[normalizar_(p)];
      if (!c) faltando.push(p); else if (servicos.indexOf(c) < 0) servicos.push(c);
    });
    if (faltando.length) {
      avisos.push('ESCALAS: "' + nome + '" ignorada: o serviço ' + faltando.map(function (x) { return '"' + x + '"'; }).join(', ') + ' não existe na aba TURNOS.');
      return;
    }

    let militares = normalizar_(l.militares) === 'TODOS' ? 'TODOS' : 'ESCALADOS';
    if (t(l.militares) !== '' && ['TODOS', 'ESCALADOS'].indexOf(normalizar_(l.militares)) < 0) {
      avisos.push('ESCALAS: "' + nome + '": MILITARES deve ser TODOS ou ESCALADOS (achei "' + t(l.militares) + '"); usando ESCALADOS.');
    }
    if (militares === 'TODOS' && servicos.length > 1) {
      avisos.push('ESCALAS: "' + nome + '": MILITARES = TODOS só vale com um único serviço; usando ESCALADOS.');
      militares = 'ESCALADOS';
    }
    const dias = normalizar_(l.dias).indexOf('SO') === 0 ? 'ESCALADOS' : 'TODOS';

    const turnos = [];
    servicos.forEach(function (s) { turnosPorServico[s].forEach(function (x) { if (turnos.indexOf(x) < 0) turnos.push(x); }); });
    const slots = Object.create(null);
    turnos.forEach(function (x) { slots[x] = []; });

    escalas[nome] = { nome: nome, servicos: servicos, titulo: t(l.titulo) || ('ESCALA ' + nome.toUpperCase()), militares: militares, dias: dias, turnos: turnos, slots: slots, usaUnidade: false };
    ordem.push(nome);
  });

  const achar = function (nome) {
    if (escalas[nome]) return escalas[nome];
    const n = normalizar_(nome);
    const k = Object.keys(escalas).filter(function (e) { return normalizar_(e) === n; })[0];
    return k ? escalas[k] : null;
  };

  linhasModelo.forEach(function (l, i) {
    const nomeEsc = t(l.escala);
    if (!nomeEsc && !t(l.funcao)) return;                          // linha vazia
    const esc = achar(nomeEsc);
    if (!esc) { avisos.push(ABA + ': a escala "' + nomeEsc + '" não existe (ou foi ignorada) na aba ESCALAS; essa linha foi ignorada.'); return; }
    const funcao = t(l.funcao);
    if (!funcao) { avisos.push(ABA + ': linha sem FUNÇÃO na escala "' + esc.nome + '"; ignorada.'); return; }

    let alvo;
    const bruto = t(l.turno);
    if (bruto === '' || normalizar_(bruto) === 'TODOS') alvo = esc.turnos.slice();
    else alvo = bruto.split(/[,;\/\s]+/).map(t).filter(Boolean);

    let vagas = parseInt(String(l.vagas == null ? '' : l.vagas).trim(), 10);
    if (!(vagas >= 1)) {
      if (t(l.vagas) !== '') avisos.push(ABA + ': VAGAS inválido ("' + t(l.vagas) + '") em "' + esc.nome + ' / ' + funcao + '"; usando 1.');
      vagas = 1;
    }
    if (vagas > 20) vagas = 20;

    // B36 (RN-94): se a função exige habilitação é cadastro, não nome escrito no código.
    // B58 item 3: vem da CNH da função em GUARNIÇÕES (booleano); no formato antigo, da coluna EXIGE CNH.
    const exigeCnh = typeof l.exigeCnh === 'boolean' ? l.exigeCnh : ['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'].indexOf(normalizar_(l.exigeCnh)) >= 0;
    const cnh = Array.isArray(l.cnh) ? l.cnh.slice() : null;      // null = formato antigo (a categoria vem da guarnição)

    alvo.forEach(function (turno) {
      if (!esc.slots[turno]) { avisos.push(ABA + ': o turno "' + turno + '" não existe nos serviços da escala "' + esc.nome + '"; ignorado.'); return; }
      esc.slots[turno].push({ unidade: t(l.unidade), funcao: funcao, vagas: vagas, exigeCnh: exigeCnh, cnh: cnh });
      if (t(l.unidade)) esc.usaUnidade = true;
    });
  });

  Object.keys(escalas).forEach(function (nome) {
    const e = escalas[nome];
    const total = e.turnos.reduce(function (n, x) { return n + e.slots[x].length; }, 0);
    if (total === 0) {
      avisos.push('ESCALAS: "' + nome + '" ignorada: não há linhas para ela na aba ' + ABA + '.');
      delete escalas[nome];
      ordem.splice(ordem.indexOf(nome), 1);
    }
  });
  return { escalas: escalas, ordem: ordem, avisos: avisos };
}

/**
 * B36 (RN-94): as funções de um serviço vêm do cadastro (abas ESCALAS + GUARNIÇÕES POR ESCALA + GUARNIÇÕES),
 * nunca de uma lista escrita no código — cada serviço tem a sua (RN-83) e ela muda com o tempo.
 * Com turno, só as funções daquele turno. Retorna [{ funcao, unidade, exigeCnh, escala }], sem repetir.
 */
function funcoesPorServico_(mod, servico, turno) {
  const out = [], vistos = Object.create(null);
  const alvo = normalizar_(servico);
  Object.keys((mod && mod.escalas) || {}).forEach(function (nome) {
    const e = mod.escalas[nome];
    if (!e.servicos.some(function (s) { return normalizar_(s) === alvo; })) return;
    let turnos;
    if (turno) {
      if (!e.slots[turno]) return;                       // esse turno não existe nesta escala
      turnos = [turno];
    } else {
      turnos = e.turnos;
    }
    turnos.forEach(function (x) {
      (e.slots[x] || []).forEach(function (s) {
        const k = chaveSlot_(s.unidade, s.funcao);
        if (vistos[k]) return;
        vistos[k] = true;
        out.push({ funcao: s.funcao, unidade: s.unidade, exigeCnh: !!s.exigeCnh, escala: e.nome });
      });
    });
  });
  return out;
}

/** B36/B38 (RN-94, RN-12): { FUNÇÃO normalizada: true } das funções que exigem CNH no cadastro. */
function funcoesQueExigemCnh_(mod) {
  const out = Object.create(null);
  Object.keys((mod && mod.escalas) || {}).forEach(function (nome) {
    const e = mod.escalas[nome];
    e.turnos.forEach(function (x) {
      (e.slots[x] || []).forEach(function (s) { if (s.exigeCnh) out[normalizar_(s.funcao)] = true; });
    });
  });
  return out;
}

/**
 * B54 (RN-12, RN-81): o texto da nota da célula do militar, dizendo por que a lista suspensa está
 * vazia ou curta. Lista vazia não pode ser silenciosa: a célula explica o motivo.
 *
 * p = { funcao, unidade, exigeCnh, escalaTodos, candidatos, motoristas, habilitados, exigida: [], temColunaCnh, cadastrada }
 *   candidatos  quantos militares podiam entrar no posto (numa escala ESCALADOS, só os que já estão
 *               escalados naquele serviço, dia e turno; numa escala TODOS, o efetivo todo)
 *   motoristas  quantos desses estão no quadro de motoristas (coluna MOTORISTA de MILITARES)
 *   habilitados quantos sobraram depois da checagem de CNH (RN-12)
 *   exigida     categorias exigidas pela guarnição do posto; vazio = a guarnição não exige
 * Retorna '' quando não há nada a explicar (posto comum com lista cheia).
 */
function motivoDaLista_(p) {
  p = p || {};
  const quem = p.escalaTodos ? 'nenhum militar na aba MILITARES' : 'nenhum militar está escalado neste serviço, dia e turno';
  const comoEscalar = p.escalaTodos ? '' : ' Escale alguém (pré-escala ou escala geral) e monte a grade de novo.';
  if (!p.exigeCnh) {
    if (p.candidatos > 0) return '';
    return 'Sem lista: ' + quem + '.' + comoEscalar;
  }
  // posto de condutor: a lista é sempre restrita, então a célula sempre explica a restrição
  let regra = 'Posto de condutor: a lista só traz quem está no quadro de motoristas (coluna MOTORISTA em MILITARES)' +
    (p.exigida && p.exigida.length ? ' e tem CNH ' + p.exigida.join('/') + ', exigida pela guarnição ' + p.unidade : '') + '.';
  // a guarnição do posto tem de estar no cadastro; se não estiver, não há CNH a exigir.
  // B58: com o vínculo novo isso não acontece (guarnição fora do cadastro nem gera posto); fica
  // para o formato antigo de GUARNIÇÕES POR ESCALA, em que a guarnição era a coluna UNIDADE.
  if (!p.exigida || !p.exigida.length) {
    if (p.unidade && p.cadastrada === false) {
      regra += ' A guarnição "' + p.unidade + '" do posto não está na aba GUARNIÇÕES: confira se o nome em GUARNIÇÕES POR ESCALA é igual à coluna GUARNIÇÃO do cadastro. Sem isso, nenhuma categoria de CNH é exigida aqui.';
    } else if (!p.unidade) {
      regra += ' O posto não tem guarnição (a aba GUARNIÇÕES POR ESCALA ainda está no formato antigo, com a UNIDADE vazia), então não há categoria a exigir. Converta a aba pelo painel Escalas de Serviço.';
    }
  }
  if (p.habilitados > 0) return regra + ' ' + p.habilitados + ' habilitado(s) neste turno.';
  let porque;
  if (!p.candidatos) porque = quem + '.' + comoEscalar;
  else if (!p.motoristas) porque = 'dos ' + p.candidatos + ' militares disponíveis neste turno, nenhum está marcado como motorista em MILITARES.';
  else if (p.exigida && p.exigida.length) {
    porque = 'dos ' + p.motoristas + ' motorista(s) disponíveis neste turno, nenhum tem CNH ' + p.exigida.join('/') +
      (p.temColunaCnh ? '' : ' (a aba MILITARES não tem a coluna CNH, então ninguém tem categoria cadastrada)') + '.';
  } else porque = 'nenhum motorista disponível neste turno.';
  return 'Sem lista: ' + porque + ' ' + regra;
}

/**
 * B58 item 3 (RN-12): a regra de condutor de cada posto, pelo vínculo. { 'UNIDADE|FUNÇÃO': { exigeCnh, cnh } }
 * só com os postos que vieram de GUARNIÇÕES POR ESCALA no formato novo (cnh !== null). No formato
 * antigo o mapa fica vazio e valem funcoesComCnh + a CNH da guarnição (cnhPorUnidade).
 */
function postosDoModelo_(mod) {
  const out = Object.create(null);
  Object.keys((mod && mod.escalas) || {}).forEach(function (nome) {
    const e = mod.escalas[nome];
    e.turnos.forEach(function (x) {
      (e.slots[x] || []).forEach(function (s) {
        if (s.cnh === null || s.cnh === undefined) return;
        out[chaveSlot_(s.unidade, s.funcao)] = { exigeCnh: !!s.exigeCnh, cnh: s.cnh };
      });
    });
  });
  return out;
}

/**
 * B58 item 3 (RN-12): o posto (guarnição + função) é de condutor, e que categoria exige?
 * ctx: { postos, funcoesComCnh, cnhPorUnidade } (de contextoDeCnh_). Retorna { exigeCnh, exigida: [] }.
 * Com o vínculo novo, vale o que a função tem na guarnição do posto — o MOTORISTA do ABT exige D e
 * o do PE Seguro pode não exigir nada, mesmo com o mesmo nome. Sem o posto no mapa, a regra antiga.
 */
function regraDoPosto_(ctx, unidade, funcao) {
  ctx = ctx || {};
  const p = ctx.postos ? ctx.postos[chaveSlot_(unidade, funcao)] : null;
  if (p) return { exigeCnh: p.exigeCnh, exigida: p.cnh || [] };
  return {
    exigeCnh: funcaoExigeCnh_(funcao, ctx.funcoesComCnh),
    exigida: (ctx.cnhPorUnidade || {})[normalizar_(unidade)] || []
  };
}

/**
 * B36/B38 (RN-94, RN-12): a função do posto exige habilitação?
 * Vale o cadastro (B58: a CNH da função em GUARNIÇÕES; no formato antigo, a coluna EXIGE CNH). Enquanto ninguém marcar nada
 * nessa coluna, cai na ponte com o cadastro antigo (o nome da função contém MOTORISTA) para não
 * perder o aviso que já existia; o painel avisa para marcar a coluna.
 */
function funcaoExigeCnh_(funcao, funcoesComCnh) {
  const n = normalizar_(funcao);
  if (funcoesComCnh && Object.keys(funcoesComCnh).length) return !!funcoesComCnh[n];
  return /MOTORISTA/.test(n);
}

/** Postos de um turno, um por vaga: [{ unidade, funcao, k, chave }] (k = 1, 2... entre postos iguais). */
function expandirSlots_(esc, turno) {
  const out = [], cont = Object.create(null);
  (esc.slots[turno] || []).forEach(function (s) {
    for (let i = 0; i < s.vagas; i++) {
      const c = chaveSlot_(s.unidade, s.funcao);
      cont[c] = (cont[c] || 0) + 1;
      out.push({ unidade: s.unidade, funcao: s.funcao, k: cont[c], chave: c });
    }
  });
  return out;
}

/* ------------------------------------------------------------ grade */

/**
 * Monta a grade de um mês a partir da tabela.
 * alocs: [{ mat, dia, turno, servico, funcao, unidade, linha }]   (qualquer mês; filtra aqui)
 *
 * Retorna {
 *   linhas:   [{ dia, turno, unidade, funcao, k, mat, servico }]   uma por vaga, em ordem de dia, turno, posto
 *   semFuncao:{ 'dia|turno': [{ mat, funcao }] }   escalados do bloco que não couberam em nenhum posto
 *   base:     [{ mat, dia, turno, servico, funcao, unidade }]     referência (todas as alocações da escala no mês)
 *   avisos, vagas, preenchidas, escaladosSemFuncao
 * }
 */
function montarGrade_(esc, mes, alocs) {
  const dias = diasDoMes_(mes);
  const porBloco = Object.create(null), vistos = Object.create(null), base = [], avisos = [];
  alocs.forEach(function (a) {
    if (esc.servicos.indexOf(a.servico) < 0 || a.dia.slice(0, 7) !== mes) return;
    const k = chaveBloco_(a);
    if (vistos[k]) { avisos.push('A tabela tem a mesma alocação repetida (' + a.mat + ' em ' + a.dia.slice(8) + '/' + a.dia.slice(5, 7) + ' turno ' + a.turno + '); só a primeira é usada.'); return; }
    vistos[k] = true;
    const b = a.dia + '|' + a.turno;
    if (!porBloco[b]) porBloco[b] = [];
    porBloco[b].push(a);
    base.push({ mat: a.mat, dia: a.dia, turno: a.turno, servico: a.servico, funcao: a.funcao || '', unidade: a.unidade || '' });
  });

  const linhas = [], semFuncao = Object.create(null), fora = Object.create(null);
  let vagas = 0, preenchidas = 0, escaladosSemFuncao = 0;
  dias.forEach(function (dia) {
    esc.turnos.forEach(function (turno) {
      const slots = expandirSlots_(esc, turno);
      if (slots.length === 0) return;
      const bloco = (porBloco[dia + '|' + turno] || []).slice().sort(function (x, y) { return (x.linha || 0) - (y.linha || 0); });
      const ocupados = slots.map(function () { return null; }), resto = [];
      const semUnidade = [];
      bloco.forEach(function (a) {
        let idx = -1;
        if (a.funcao) {
          const c = chaveSlot_(a.unidade || '', a.funcao);
          for (let i = 0; i < slots.length; i++) { if (slots[i].chave === c && !ocupados[i]) { idx = i; break; } }
        }
        if (idx >= 0) ocupados[idx] = a;
        else if (a.funcao && !a.unidade) semUnidade.push(a);
        else resto.push(a);
      });
      // B58: alocação com FUNÇÃO e sem UNIDADE (gravada antes do vínculo por guarnição) entra no
      // primeiro posto livre daquela função, de qualquer guarnição. A grade mostra a guarnição do
      // posto, e salvar grava a UNIDADE na alocação (aparece como alteração de função).
      semUnidade.forEach(function (a) {
        const f = normalizar_(a.funcao);
        let idx = -1;
        for (let i = 0; i < slots.length; i++) { if (!ocupados[i] && normalizar_(slots[i].funcao) === f) { idx = i; break; } }
        if (idx >= 0) ocupados[idx] = a; else resto.push(a);
      });
      slots.forEach(function (s, i) {
        const o = ocupados[i];
        linhas.push({ dia: dia, turno: turno, unidade: s.unidade, funcao: s.funcao, k: s.k, mat: o ? o.mat : '', servico: o ? o.servico : '' });
      });
      vagas += slots.length;
      preenchidas += ocupados.filter(Boolean).length;
      resto.forEach(function (a) { fora[chaveBloco_(a)] = true; });
      if (resto.length) {
        semFuncao[dia + '|' + turno] = resto.map(function (a) { return { mat: a.mat, funcao: a.funcao || '' }; });
        escaladosSemFuncao += resto.length;
      }
    });
  });
  base.forEach(function (b) { if (fora[chaveBloco_(b)]) b.fora = true; });   // não coube em nenhum posto: a grade não a mostra
  return { linhas: linhas, semFuncao: semFuncao, base: base, avisos: avisos, vagas: vagas, preenchidas: preenchidas, escaladosSemFuncao: escaladosSemFuncao };
}

/* ------------------------------------------------------------ diferenças */

/**
 * base      : [{ mat, dia, turno, servico, funcao, unidade }]   a grade como foi desenhada
 * grade     : [{ linha, dia, turno, unidade, funcao, texto, mat }]  a grade como está agora (mat '' = vaga vazia;
 *             texto preenchido sem mat = célula ilegível)
 * tabelaMes : [{ mat, dia, turno, servico, funcao, unidade, linha }]   a tabela agora (só o mês)
 * opcoes    : { horarios, todas, motoristas, funcoesComCnh, cnh, cnhPorUnidade, postos }   (todos opcionais)
 *             horarios/todas: ativam o bloqueio por choque nas inclusões
 *             motoristas: { matrícula: true } — se vier, avisa motorista fora da lista
 *             funcoesComCnh: { FUNÇÃO: true } do cadastro (B36/RN-94); sem ela vale a ponte pelo nome
 *             cnh: { matrícula: ['B','D'] } e cnhPorUnidade: { GUARNIÇÃO: ['D'] } — checagem do B38 (RN-12)
 *             postos: de postosDoModelo_ — B58 item 3: a regra de cada posto vem do vínculo (regraDoPosto_)
 *
 * Retorna { inserir, atualizar, remover, conflitos, invalidas, choques, jaAplicadas, aplicadas, avisosMotorista, resumo }
 */
function calcularGuarnicao_(base, grade, tabelaMes, esc, opcoes) {
  opcoes = opcoes || {};
  const cria = esc.militares === 'TODOS';
  const est = function (f, u) { return { f: f || '', u: u || '' }; };
  const igual = function (a, b) {
    if (a == null || b == null) return a == null && b == null;
    return !!a.outro === !!b.outro && normalizar_(a.f) === normalizar_(b.f) && normalizar_(a.u) === normalizar_(b.u);
  };

  const B = Object.create(null);
  base.forEach(function (a) { const k = chaveBloco_(a); if (!(k in B)) B[k] = { servico: a.servico, e: est(a.funcao, a.unidade), fora: !!a.fora }; });

  // Uma pessoa pode ter dois serviços na mesma letra de turno (ex.: Bioma A e Pronto A). Aqui vale o da
  // escala; sem ele, o primeiro da tabela. As linhas guardadas são só as desse serviço.
  const T = Object.create(null);
  const foraDaEscala = function (a) { return esc.servicos.indexOf(a.servico) >= 0 ? 0 : 1; };
  tabelaMes.slice().sort(function (x, y) { return foraDaEscala(x) - foraDaEscala(y); }).forEach(function (a) {
    const k = chaveBloco_(a);
    if (!T[k]) T[k] = { servico: a.servico, f: a.funcao, u: a.unidade, linhas: [] };
    if (T[k].servico === a.servico) T[k].linhas.push(a.linha);
  });
  const estadoTabela = function (k) {
    const t = T[k];
    if (!t) return null;
    if (esc.servicos.indexOf(t.servico) < 0) return { outro: true, servico: t.servico, f: '', u: '' };
    return est(t.f, t.u);
  };

  // estado da grade por chave; duplicatas e células ilegíveis ficam de fora e viram "inválidas"
  const res = { inserir: [], atualizar: [], remover: [], conflitos: [], invalidas: [], choques: [], jaAplicadas: [], aplicadas: [], avisosMotorista: [], avisosCnh: [] };
  const G = Object.create(null), ocup = Object.create(null);
  grade.forEach(function (r) {
    if (!r.mat) {
      if (r.texto) res.invalidas.push({ motivo: 'ilegivel', chave: '', mat: '', dia: r.dia, turno: r.turno, funcao: r.funcao, unidade: r.unidade, texto: r.texto });
      return;
    }
    const k = chaveBloco_({ mat: r.mat, dia: r.dia, turno: r.turno });
    if (!ocup[k]) ocup[k] = [];
    ocup[k].push(r);
  });
  Object.keys(ocup).forEach(function (k) {
    if (ocup[k].length === 1) G[k] = est(ocup[k][0].funcao, ocup[k][0].unidade);
    if (opcoes.motoristas) {
      ocup[k].forEach(function (r) {
        const regra = regraDoPosto_(opcoes, r.unidade, r.funcao);      // B58 item 3: pelo vínculo
        if (!regra.exigeCnh) return;
        // continua avisando quem está numa função de condutor sem estar no quadro de motoristas
        if (!opcoes.motoristas[r.mat]) { res.avisosMotorista.push({ mat: r.mat, dia: r.dia, turno: r.turno, funcao: r.funcao }); return; }
        // B38 (RN-12): e agora também quem está no quadro mas sem CNH compatível com a guarnição
        const exigida = regra.exigida;
        if (exigida.length && !cnhAtende_((opcoes.cnh || {})[r.mat] || [], exigida)) {
          res.avisosCnh.push({ mat: r.mat, dia: r.dia, turno: r.turno, funcao: r.funcao, unidade: r.unidade, exigida: exigida.join('/') });
        }
      });
    }
  });

  const item = function (k, extra) {
    const p = k.split('|');
    return Object.assign({ chave: k, mat: p[0], dia: p[1], turno: p[2] }, extra || {});
  };

  const chaves = Object.keys(Object.assign(Object.create(null), B, G, ocup)).sort();
  chaves.forEach(function (k) {
    const b = B[k] ? B[k].e : null;
    if (ocup[k] && ocup[k].length > 1) {
      const r = ocup[k][0];
      res.invalidas.push(item(k, { motivo: 'duplicado', funcao: ocup[k].map(function (x) { return x.funcao; }).join(' e '), unidade: r.unidade }));
      return;
    }
    let g;
    if (G[k]) g = G[k];
    else if (b) {
      if (B[k].fora) return;                       // fora da grade: só muda se a pessoa for colocada num posto
      g = (b.f === '' && b.u === '') ? b : (cria ? null : est('', ''));
    }
    else return;
    if (igual(g, b)) return;

    const t = estadoTabela(k);
    const extra = { de: b, para: g, funcao: g ? g.f : '', unidade: g ? g.u : '' };
    if (igual(t, g)) { res.jaAplicadas.push(item(k, extra)); res.aplicadas.push({ chave: k, estado: g, servico: T[k] ? T[k].servico : esc.servicos[0] }); return; }
    if (!igual(t, b)) {
      res.conflitos.push(item(k, Object.assign(extra, { tabela: !t ? '(sem alocação)' : (t.outro ? 'já escalado em ' + t.servico : (t.f || 'sem função') + (t.u ? ' / ' + t.u : '')) })));
      return;
    }

    if (g === null) {
      res.remover.push({ chave: k, linhas: T[k].linhas.slice() });
      res.aplicadas.push({ chave: k, estado: null, servico: T[k].servico });
    } else if (b === null) {
      if (!cria) { res.invalidas.push(item(k, Object.assign(extra, { motivo: 'nao-escalado' }))); return; }
      const p = k.split('|');
      res.inserir.push({ mat: p[0], dia: p[1], turno: p[2], servico: esc.servicos[0], funcao: g.f, unidade: g.u, chave: k });
      res.aplicadas.push({ chave: k, estado: g, servico: esc.servicos[0] });
    } else {
      res.atualizar.push({ chave: k, linhas: T[k].linhas.slice(), funcao: g.f, unidade: g.u });
      res.aplicadas.push({ chave: k, estado: g, servico: T[k].servico });
    }
  });

  // choque de horário: só as inclusões criam alocação nova (trocar a função não muda horário)
  if (opcoes.horarios && opcoes.todas && res.inserir.length) {
    // a checagem de choque trabalha com a chave completa (serviço incluído); aqui a chave é a do bloco
    const posto = Object.create(null), cheia = Object.create(null);
    res.inserir.forEach(function (i) { const c = chaveAloc_(i); cheia[i.chave] = c; posto[c] = { funcao: i.funcao, unidade: i.unidade }; });
    const r2 = {
      inserir: res.inserir.map(function (i) { return Object.assign({}, i, { chave: cheia[i.chave], troca: '' }); }),
      atualizar: [], remover: res.remover, choques: [],
      aplicadas: res.aplicadas.map(function (a) { return cheia[a.chave] || a.chave; })
    };
    bloquearPorChoque_(r2, Object.create(null), opcoes.todas, opcoes.horarios);
    const passou = Object.create(null);
    r2.inserir.forEach(function (i) { passou[i.chave] = true; });
    res.inserir = res.inserir.filter(function (i) { return passou[cheia[i.chave]]; });
    res.choques = r2.choques;
    res.choques.forEach(function (c) { const p = posto[c.chave]; if (p) { c.funcao = p.funcao; c.unidade = p.unidade; } });
    const ok = Object.create(null);
    r2.aplicadas.forEach(function (k) { ok[k] = true; });
    res.aplicadas = res.aplicadas.filter(function (a) { return ok[cheia[a.chave] || a.chave]; });
  }

  res.resumo = {
    inclusoes: res.inserir.length,
    funcoes: res.atualizar.length,
    exclusoes: res.remover.length,
    conflitos: res.conflitos.length,
    invalidas: res.invalidas.length,
    choques: res.choques.length,
    jaAplicadas: res.jaAplicadas.length,
    motoristas: res.avisosMotorista.length,
    cnh: res.avisosCnh.length                            // B38 (RN-12)
  };
  return res;
}

/** Nova referência depois de salvar: só as chaves aplicadas avançam; conflitos e inválidas continuam pendentes. */
function novaBaseGuarnicao_(base, res) {
  const B = Object.create(null);
  base.forEach(function (a) { const k = chaveBloco_(a); if (!(k in B)) B[k] = a; });
  res.aplicadas.forEach(function (a) {
    if (a.estado === null) { delete B[a.chave]; return; }
    const p = a.chave.split('|');
    B[a.chave] = { mat: p[0], dia: p[1], turno: p[2], servico: a.servico, funcao: a.estado.f, unidade: a.estado.u };
  });
  return Object.keys(B).sort().map(function (k) { return B[k]; });
}

/* ------------------------------------------------------------ impressão */

/**
 * Linhas do documento impresso (no formato das escalas oficiais), a partir de uma grade já montada.
 * mil: { matrícula: militar }   horarios: porChave de montarHorarios_   origens: de lerOrigens_ (B49 item 2)
 * Retorna [{ dia, semana, turno, bloco, unidade, funcao, grad, nome, mat }]
 * Escala com DIAS = ESCALADOS (ex.: CPRH) omite os dias sem ninguém.
 */
function linhasParaImpressao_(grade, esc, mil, horarios, origens) {
  horarios = horarios || {};
  const comGente = Object.create(null);
  grade.linhas.forEach(function (l) { if (l.mat) comGente[l.dia] = true; });

  const turnoTxt = Object.create(null);
  esc.turnos.forEach(function (t, i) {
    let h = null;
    esc.servicos.some(function (s) { h = horarios[s + '|' + t] || null; return !!h; });
    turnoTxt[t] = (i + 1) + 'º TURNO' + (h ? ' - ' + horaCompleta_(h.ini) + ' ÀS ' + horaCompleta_(h.fim) : ' (' + t + ')');
  });

  const out = [];
  grade.linhas.forEach(function (l) {
    if (esc.dias === 'ESCALADOS' && !comGente[l.dia]) return;
    const m = l.mat ? mil[l.mat] : null;
    let funcao = l.funcao;
    if (esc.servicos.length > 1 && l.servico) funcao += ' - ' + origemDoServico_(l.servico, origens, l.turno);   // B49 item 2: ORIGEM do cadastro
    out.push({
      dia: l.dia,
      semana: GUARN_DIAS_SEMANA_[diaDaSemana_(l.dia)],
      turno: turnoTxt[l.turno],
      bloco: l.dia + '|' + l.turno,
      unidade: l.unidade,
      funcao: funcao,
      grad: m ? m.posto : '',
      nome: m ? m.nome : (l.mat ? '(não cadastrado)' : ''),
      mat: l.mat
    });
  });
  return out;
}