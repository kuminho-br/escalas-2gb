/**
 * GUARNIÇÕES — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 * Depende de nucleo.gs (normalizar_, diasDoMes_, diaDaSemana_, nomeExibicao_),
 * sincronia.gs (chaveAloc_, bloquearPorChoque_) e choques.gs.
 *
 * IDEIA
 *   Cada ESCALA (Defensoria, PE Seguro, Bioma, CPRH, Pronto...) tem um molde:
 *   quais postos (função, e opcionalmente a unidade) existem em cada turno.
 *   A grade mostra, para cada dia e turno, uma linha por posto. Quem ocupa o
 *   posto fica gravado na própria alocação (colunas FUNÇÃO e UNIDADE da tabela
 *   ALOCAÇÕES TABULADAS): não existe uma segunda tabela de "quem faz o quê".
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
/** Como o serviço aparece no nome da função nas escalas com mais de um serviço (ex.: "MOTORISTA - PJES"). */
const GUARN_VINCULOS_ = { 'JES': 'PJES' };

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

function chaveSlot_(unidade, funcao) { return normalizar_(unidade) + '|' + normalizar_(funcao); }

/* ------------------------------------------------------------ modelos */

/**
 * linhasEscalas : [{ escala, servicos, titulo, militares, dias }]       (textos da aba ESCALAS)
 * linhasModelo  : [{ escala, turno, unidade, funcao, vagas }]           (textos da aba MODELOS DE GUARNIÇÃO)
 * turnosPorServico : { 'Pronto': ['A','B'], ... }                      (aba TURNOS, na ordem em que aparecem)
 *
 * Retorna { escalas: { nome: {nome, servicos[], titulo, militares, dias, turnos[], slots:{turno:[{unidade,funcao,vagas}]}, usaUnidade} },
 *           ordem: [nomes], avisos: [texto] }
 * Escala com problema grave (serviço inexistente, sem molde) é descartada COM aviso.
 */
function montarModelosGuarnicao_(linhasEscalas, linhasModelo, turnosPorServico) {
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
    if (!esc) { avisos.push('MODELOS DE GUARNIÇÃO: a escala "' + nomeEsc + '" não existe (ou foi ignorada) na aba ESCALAS; essa linha foi ignorada.'); return; }
    const funcao = t(l.funcao);
    if (!funcao) { avisos.push('MODELOS DE GUARNIÇÃO: linha sem FUNÇÃO na escala "' + esc.nome + '"; ignorada.'); return; }

    let alvo;
    const bruto = t(l.turno);
    if (bruto === '' || normalizar_(bruto) === 'TODOS') alvo = esc.turnos.slice();
    else alvo = bruto.split(/[,;\/\s]+/).map(t).filter(Boolean);

    let vagas = parseInt(String(l.vagas == null ? '' : l.vagas).trim(), 10);
    if (!(vagas >= 1)) {
      if (t(l.vagas) !== '') avisos.push('MODELOS DE GUARNIÇÃO: VAGAS inválido ("' + t(l.vagas) + '") em "' + esc.nome + ' / ' + funcao + '"; usando 1.');
      vagas = 1;
    }
    if (vagas > 20) vagas = 20;

    alvo.forEach(function (turno) {
      if (!esc.slots[turno]) { avisos.push('MODELOS DE GUARNIÇÃO: o turno "' + turno + '" não existe nos serviços da escala "' + esc.nome + '"; ignorado.'); return; }
      esc.slots[turno].push({ unidade: t(l.unidade), funcao: funcao, vagas: vagas });
      if (t(l.unidade)) esc.usaUnidade = true;
    });
  });

  Object.keys(escalas).forEach(function (nome) {
    const e = escalas[nome];
    const total = e.turnos.reduce(function (n, x) { return n + e.slots[x].length; }, 0);
    if (total === 0) {
      avisos.push('ESCALAS: "' + nome + '" ignorada: não há linhas para ela na aba MODELOS DE GUARNIÇÃO.');
      delete escalas[nome];
      ordem.splice(ordem.indexOf(nome), 1);
    }
  });
  return { escalas: escalas, ordem: ordem, avisos: avisos };
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
    const k = chaveAloc_(a);
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
      bloco.forEach(function (a) {
        let idx = -1;
        if (a.funcao) {
          const c = chaveSlot_(a.unidade || '', a.funcao);
          for (let i = 0; i < slots.length; i++) { if (slots[i].chave === c && !ocupados[i]) { idx = i; break; } }
        }
        if (idx >= 0) ocupados[idx] = a; else resto.push(a);
      });
      slots.forEach(function (s, i) {
        const o = ocupados[i];
        linhas.push({ dia: dia, turno: turno, unidade: s.unidade, funcao: s.funcao, k: s.k, mat: o ? o.mat : '', servico: o ? o.servico : '' });
      });
      vagas += slots.length;
      preenchidas += ocupados.filter(Boolean).length;
      resto.forEach(function (a) { fora[chaveAloc_(a)] = true; });
      if (resto.length) {
        semFuncao[dia + '|' + turno] = resto.map(function (a) { return { mat: a.mat, funcao: a.funcao || '' }; });
        escaladosSemFuncao += resto.length;
      }
    });
  });
  base.forEach(function (b) { if (fora[chaveAloc_(b)]) b.fora = true; });   // não coube em nenhum posto: a grade não a mostra
  return { linhas: linhas, semFuncao: semFuncao, base: base, avisos: avisos, vagas: vagas, preenchidas: preenchidas, escaladosSemFuncao: escaladosSemFuncao };
}

/* ------------------------------------------------------------ diferenças */

/**
 * base      : [{ mat, dia, turno, servico, funcao, unidade }]   a grade como foi desenhada
 * grade     : [{ linha, dia, turno, unidade, funcao, texto, mat }]  a grade como está agora (mat '' = vaga vazia;
 *             texto preenchido sem mat = célula ilegível)
 * tabelaMes : [{ mat, dia, turno, servico, funcao, unidade, linha }]   a tabela agora (só o mês)
 * opcoes    : { horarios, todas, motoristas }   (todos opcionais)
 *             horarios/todas: ativam o bloqueio por choque nas inclusões
 *             motoristas: { matrícula: true } — se vier, avisa motorista fora da lista
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
  base.forEach(function (a) { const k = chaveAloc_(a); if (!(k in B)) B[k] = { servico: a.servico, e: est(a.funcao, a.unidade), fora: !!a.fora }; });

  const T = Object.create(null);
  tabelaMes.forEach(function (a) {
    const k = chaveAloc_(a);
    if (!T[k]) T[k] = { servico: a.servico, f: a.funcao, u: a.unidade, linhas: [] };
    T[k].linhas.push(a.linha);
  });
  const estadoTabela = function (k) {
    const t = T[k];
    if (!t) return null;
    if (esc.servicos.indexOf(t.servico) < 0) return { outro: true, servico: t.servico, f: '', u: '' };
    return est(t.f, t.u);
  };

  // estado da grade por chave; duplicatas e células ilegíveis ficam de fora e viram "inválidas"
  const res = { inserir: [], atualizar: [], remover: [], conflitos: [], invalidas: [], choques: [], jaAplicadas: [], aplicadas: [], avisosMotorista: [] };
  const G = Object.create(null), ocup = Object.create(null);
  grade.forEach(function (r) {
    if (!r.mat) {
      if (r.texto) res.invalidas.push({ motivo: 'ilegivel', chave: '', mat: '', dia: r.dia, turno: r.turno, funcao: r.funcao, unidade: r.unidade, texto: r.texto });
      return;
    }
    const k = chaveAloc_({ mat: r.mat, dia: r.dia, turno: r.turno });
    if (!ocup[k]) ocup[k] = [];
    ocup[k].push(r);
  });
  Object.keys(ocup).forEach(function (k) {
    if (ocup[k].length === 1) G[k] = est(ocup[k][0].funcao, ocup[k][0].unidade);
    if (opcoes.motoristas) {
      ocup[k].forEach(function (r) {
        if (/MOTORISTA/.test(normalizar_(r.funcao)) && !opcoes.motoristas[r.mat]) res.avisosMotorista.push({ mat: r.mat, dia: r.dia, turno: r.turno, funcao: r.funcao });
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
    const posto = Object.create(null);
    res.inserir.forEach(function (i) { posto[i.chave] = { funcao: i.funcao, unidade: i.unidade }; });
    const r2 ={ inserir: res.inserir, atualizar: [], remover: res.remover, choques: [], aplicadas: res.aplicadas.map(function (a) { return a.chave; }) };
    bloquearPorChoque_(r2, Object.create(null), opcoes.todas, opcoes.horarios);
    res.inserir = r2.inserir;
    res.choques = r2.choques;
    res.choques.forEach(function (c) { const p = posto[c.chave]; if (p) { c.funcao = p.funcao; c.unidade = p.unidade; } });
    const ok = Object.create(null);
    r2.aplicadas.forEach(function (k) { ok[k] = true; });
    res.aplicadas = res.aplicadas.filter(function (a) { return ok[a.chave]; });
  }

  res.resumo = {
    inclusoes: res.inserir.length,
    funcoes: res.atualizar.length,
    exclusoes: res.remover.length,
    conflitos: res.conflitos.length,
    invalidas: res.invalidas.length,
    choques: res.choques.length,
    jaAplicadas: res.jaAplicadas.length,
    motoristas: res.avisosMotorista.length
  };
  return res;
}

/** Nova referência depois de salvar: só as chaves aplicadas avançam; conflitos e inválidas continuam pendentes. */
function novaBaseGuarnicao_(base, res) {
  const B = Object.create(null);
  base.forEach(function (a) { const k = chaveAloc_(a); if (!(k in B)) B[k] = a; });
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
 * mil: { matrícula: militar }   horarios: porChave de montarHorarios_
 * Retorna [{ dia, semana, turno, bloco, unidade, funcao, grad, nome, mat }]
 * Escala com DIAS = ESCALADOS (ex.: CPRH) omite os dias sem ninguém.
 */
function linhasParaImpressao_(grade, esc, mil, horarios) {
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
    if (esc.servicos.length > 1 && l.servico) funcao += ' - ' + (GUARN_VINCULOS_[l.servico] || l.servico).toUpperCase();
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