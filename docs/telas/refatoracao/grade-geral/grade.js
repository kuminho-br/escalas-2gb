// Área "Grade geral" do Manual (versão 1): monta a Grade e o menu com dados de exemplo (nomes e matrículas inventados).
// window.Grade.montar(raiz, op) desenha uma tela: op = { cel: false, menu: 'largo'|'recolhido'|'oculto', sel: {p, d}, menuAberto: false, cheia: false }.
(function () {
  'use strict';
  var DIAS = 31, DOW1 = 2, HOJE = 3;             // 1/12/2026 é terça-feira; o "hoje" do exemplo é 3/12
  var SIG = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var FERIADO = { 25: 'Natal' };
  // as cores já ajustadas para o texto branco (o site mostra a ajustada nas células e, agora, na legenda também)
  var SERV = { pronto: { n: 'Pronto', c: '#2A7F52' }, jes: { n: 'JES', c: '#6E56A8' }, saldo: { n: 'Saldo', c: '#2B7BB9' } };
  var HORA = { A: '07h às 19h', B: '19h às 07h' };
  var dow = function (d) { return (DOW1 + d - 1) % 7; };
  var util = function (d) { var w = dow(d); return w > 0 && w < 6 && !FERIADO[d]; };
  var semAcento = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var ic = function (n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var mi = function (n) { return '<svg class="i" aria-hidden="true"><use href="#m-' + n + '"/></svg>'; };

  // afastamentos: i e f são dias de dezembro; i < 1 começou em novembro (30 + i) e f > 31 termina em janeiro (f - 31)
  function pessoa(id, pst, gue, mat, o) {
    var p = { id: id, pst: pst, gue: gue, mat: mat, eq: o.eq, af: o.af || [], ch: o.ch || [], pjes: o.pjes || 0, dia: o.dia || 0, cota: o.cota || null, serv: {} };
    for (var d = 1; d <= DIAS; d++) {
      if (afDe(p, d)) continue;
      var b = [];
      if (o.adm && util(d)) b.push(['exp', '']);
      if (o.pronto && d >= o.pronto[0] && (d - o.pronto[0]) % 4 === 0) b.push(['pronto', o.pronto[1]]);
      if ((o.jes || []).indexOf(d) >= 0) b.push(['jes', 'A']);
      if ((o.saldo || []).indexOf(d) >= 0) b.push(['saldo', 'B']);
      if (b.length) p.serv[d] = b;
    }
    return p;
  }
  function afDe(p, d) { for (var i = 0; i < p.af.length; i++) if (d >= p.af[i].i && d <= p.af[i].f) return p.af[i]; return null; }
  function mesTodo(p) { for (var d = 1; d <= DIAS; d++) if (!afDe(p, d)) return false; return true; }
  var dm = function (n) { return n < 1 ? (30 + n) + '/11' : n > 31 ? (n - 31) + '/01' : n + '/12'; };
  function periodo(a, ano) {
    var mesmo = a.i >= 1 && a.f <= 31;
    return mesmo ? a.i + ' a ' + a.f + '/12' + (ano ? '/2026' : '') : dm(a.i) + ' a ' + dm(a.f) + (ano ? '/2026' : '');
  }

  var EQUIPES = [
    { k: 'alfa', n: 'ALFA', p: [
      pessoa('a1', 'St', 'ARAÚJO', '000101-1', { eq: 'alfa', pronto: [1, 'A'], pjes: 2, dia: 1 }),
      pessoa('a2', '2º Sgt', 'BEZERRA', '000102-2', { eq: 'alfa', pronto: [1, 'A'], jes: [6], pjes: 1, dia: 2 }),
      pessoa('a3', '3º Sgt', 'CAVALCANTE', '000103-3', { eq: 'alfa', pronto: [1, 'A'], af: [{ t: 'Férias', i: 10, f: 19 }], pjes: 0, dia: 0 }),
      pessoa('a4', '3º Sgt', 'DUARTE', '000104-4', { eq: 'alfa', pronto: [1, 'A'], jes: [13], ch: [13], pjes: 3, dia: 1 }),
      pessoa('a5', 'Cb', 'FARIAS', '000105-5', { eq: 'alfa', af: [{ t: 'LTS', i: 1, f: 31 }], pjes: 0, dia: 0 })
    ] },
    { k: 'bravo', n: 'BRAVO', p: [
      pessoa('b1', '1º Sgt', 'GALVÃO', '000201-1', { eq: 'bravo', pronto: [2, 'B'], pjes: 2, dia: 2 }),
      pessoa('b2', '3º Sgt', 'HOLANDA', '000202-2', { eq: 'bravo', pronto: [2, 'B'], af: [{ t: 'Férias', i: 3, f: 12 }], pjes: 0, dia: 1 }),
      pessoa('b3', 'Cb', 'IGREJA', '000203-3', { eq: 'bravo', pronto: [2, 'B'], jes: [8], pjes: 1, dia: 0 }),
      pessoa('b4', 'Sd', 'JUCÁ', '000204-4', { eq: 'bravo', pronto: [2, 'B'], pjes: 1, dia: 1 }),
      pessoa('b5', 'Sd', 'LACERDA', '000205-5', { eq: 'bravo', pronto: [2, 'B'], pjes: 0, dia: 0 })
    ] },
    { k: 'adm', n: 'ADM', p: [
      pessoa('m1', 'St', 'MACEDO', '000301-1', { eq: 'adm', adm: true, saldo: [11, 18], cota: [2, 6], pjes: 0, dia: 0 }),
      pessoa('m2', '1º Sgt', 'NOGUEIRA', '000302-2', { eq: 'adm', adm: true, cota: [0, 6], pjes: 0, dia: 0 }),
      pessoa('m3', '2º Sgt', 'OLIVEIRA', '000303-3', { eq: 'adm', adm: true, af: [{ t: 'Férias', i: 14, f: 31 }], saldo: [4], cota: [7, 6], pjes: 0, dia: 0 }),
      pessoa('m4', '3º Sgt', 'PESSOA', '000304-4', { eq: 'adm', adm: true, saldo: [9], cota: [1, 6], pjes: 1, dia: 0 }),
      pessoa('m5', 'Cb', 'QUEIROZ', '000305-5', { eq: 'adm', adm: true, af: [{ t: 'Licença', i: -2, f: 6 }], cota: [0, 6], pjes: 0, dia: 0 }),
      pessoa('m6', '3º Sgt', 'RAMOS', '000306-6', { eq: 'adm', adm: true, cota: [3, 6], pjes: 0, dia: 2 })
    ] }
  ];
  var TODOS = []; EQUIPES.forEach(function (e) { e.p.forEach(function (p) { TODOS.push(p); }); });
  var achar = function (id) { return TODOS.filter(function (p) { return p.id === id; })[0]; };
  var MAX = { pjes: 3, dia: 2 };

  function legenda() {
    function q(c, l) { return '<span class="gg-q" style="background:' + c + '">' + l + '</span>'; }
    return '<ul class="gg-leg" aria-label="Legenda">' +
      '<li>' + q(SERV.pronto.c, 'A') + 'Pronto</li><li>' + q(SERV.jes.c, 'A') + 'JES</li><li>' + q(SERV.saldo.c, 'B') + 'Saldo</li>' +
      '<li><span class="gg-q exp"></span>Expediente do ADM</li>' +
      '<li><span class="gg-tr"><span class="gg-af comeca termina"></span></span>Afastado</li>' +
      '<li><span class="gg-ch"></span>Choque de horário</li>' +
      '<li>A letra é o turno.</li>' +
      '<li class="gg-dica-rolar">' + ic('mouse') + 'Para rolar para os lados, segure <kbd>Shift</kbd> e gire a roda do mouse.</li></ul>';
  }

  function menu(op, st) {
    var item = function (n, ico, atual) { return '<li' + (atual ? ' class="atual"' : '') + '><a href="#" data-m="' + n + '"' + (atual ? ' aria-current="page"' : '') + '>' + mi(ico) + '<span>' + n + '</span></a></li>'; };
    return '<nav class="gg-menu" aria-label="Navegação principal">' +
      '<a class="gg-casa" href="#" aria-label="Ir para o início, 1ª Seção de Bombeiros"><img src="../img/brasao-2gb.png" alt=""><span><b>1ª SB</b><small>1ª Seção de Bombeiros</small></span></a>' +
      (op.cel ? '' : '<div class="gg-ctl"><button type="button" class="gg-recolher" data-recolher>' + ic('esq') + '<span>' + (st.menu === 'recolhido' ? 'Abrir' : 'Recolher') + '</span></button>' +
        '<button type="button" class="gg-recolher" data-ocultar-menu>' + ic('esconder') + '<span>Esconder</span></button></div>') +
      '<ul>' + item('Grade geral', 'grade', true) + item('Escala do mês', 'escala') + item('Efetivo por dia', 'efetivo') + item('Oficiais', 'oficiais') + '</ul>' +
      '<ul>' + item('Voluntariado', 'voluntariado') + item('Cotas', 'cotas') + '</ul>' +
      '<ul>' + item('Militares', 'militares') + item('Turnos', 'turnos') + item('Escalas', 'escalas') + item('Feriados', 'feriados') + '</ul>' +
      '<ul class="pe">' + item('Configurações da escala', 'config') + '</ul>' +
      '</nav>';
  }

  function topo(op) {
    if (op.cel) {
      return '<header class="gg-topo"><button type="button" class="botao discreto so-icone" data-abrir-menu aria-label="Abrir o menu" aria-expanded="false">' + ic('menu') + '</button>' +
        '<button type="button" class="gg-uni" aria-label="Unidade: 1ª SB. Trocar">1ª SB' + ic('baixo') + '</button>' +
        '<button type="button" class="gg-quem" aria-label="CB ALMEIDA, Escalante"><span class="ini" aria-hidden="true">A</span></button></header>';
    }
    var deg = ['CBMPE', 'DGO', 'DInter/1', '2º GB', 'DivOp', '1ª SB'];
    return '<header class="gg-topo"><nav aria-label="Unidade de trabalho"><ol class="gg-degraus">' + deg.map(function (s, i) {
      return '<li' + (i === deg.length - 1 ? ' class="atual"' : '') + '>' + (i ? '<span class="sep" aria-hidden="true">›</span>' : '') + '<button type="button"><span>' + s + '</span>' + ic('baixo') + '</button></li>';
    }).join('') + '</ol></nav>' +
      '<button type="button" class="gg-quem"><span class="ini" aria-hidden="true">A</span><span><b>CB ALMEIDA</b><small>Escalante</small></span>' + ic('baixo') + '</button></header>';
  }

  function barra(st, op) {
    var cham = function (c, n) { return '<button type="button" aria-pressed="' + (c === null ? st.eqs.length === 0 : st.eqs.indexOf(c) >= 0) + '"' + (c === null ? ' data-todas' : ' data-chave="' + c + '"') + '>' + ic('ok') + n + '</button>'; };
    return '<div class="gg-barra">' +
      '<div class="campo"><span class="rot">Mês</span><span class="gg-mes"><button type="button" aria-label="Mês anterior">' + ic('esq') + '</button><span>dezembro de 2026' + ic('calendario') + '</span><button type="button" aria-label="Próximo mês">' + ic('dir') + '</button></span></div>' +
      '<div class="campo"><label for="gg-b-' + op.n + '">Buscar militar</label><input type="search" id="gg-b-' + op.n + '" placeholder="Nome ou matrícula" autocomplete="off" value="' + st.busca.replace(/"/g, '') + '" data-busca></div>' +
      '<div class="campo"><span class="rot">Equipe</span><div class="grupo-filtro" role="group" aria-label="Equipe" data-eqs>' + cham(null, 'Todas') + EQUIPES.map(function (e) { return cham(e.k, e.n); }).join('') + '</div></div>' +
      '<label class="marcar direita"><input type="checkbox" data-esconder' + (st.esconder ? ' checked' : '') + '><span>Esconder quem está afastado o mês todo</span></label>' +
      '</div>';
  }

  // na tela cheia do celular: o mês, as equipes que valem e o botão de recolher, numa linha só
  function cheiaBarra(st, op) {
    var eqs = st.eqs.length ? EQUIPES.filter(function (e) { return st.eqs.indexOf(e.k) >= 0; }).map(function (e) { return e.n; }).join(', ') : (op.cel ? 'Todas' : 'Todas as equipes');
    return '<div class="gg-cheia-barra"><span class="gg-mes mini"><button type="button" aria-label="Mês anterior">' + ic('esq') + '</button><span>dez. 2026</span><button type="button" aria-label="Próximo mês">' + ic('dir') + '</button></span>' +
      '<span class="eqs">' + eqs + (st.busca.trim() ? ', "' + st.busca.trim() + '"' : '') + '</span><button type="button" class="botao secundario" data-cheia aria-pressed="true">' + ic('recolher') + 'Recolher grade</button></div>';
  }

  function celula(st, p, d) {
    var af = afDe(p, d), b = p.serv[d] || [], ch = p.ch.indexOf(d) >= 0;
    var sel = st.sel && st.sel.p === p.id && st.sel.d === d;
    var cls = 'c' + (dow(d) === 0 || dow(d) === 6 ? ' fds' : '') + (dow(d) === 1 ? ' seg' : '') + (dow(d + 1) === 1 ? ' vespera' : '') + (sel ? ' sel' : '') + (st.sel && st.sel.d === d && !sel ? ' cm' : '');
    var nomes = b.length ? b.map(function (x) { return x[0] === 'exp' ? 'expediente' : SERV[x[0]].n + ' ' + x[1]; }).join(', ') : 'sem serviço';
    var rot = p.pst + ' ' + p.gue + ', dia ' + d + ': ' + nomes + (af ? ', afastado: ' + af.t : '') + (ch ? ', choque' : '');
    var h = '';
    if (af) {
      var ini = d === af.i && af.i >= 1, fim = d === af.f && af.f <= 31;
      h += '<span class="gg-af' + (ini ? ' comeca' : '') + (fim ? ' termina' : '') + '" aria-hidden="true"></span>';
      if (d === Math.max(1, af.i)) h += '<span class="gg-af-rot" aria-hidden="true">' + (af.i < 1 ? '‹ ' : '') + af.t + '</span>';
    }
    b.forEach(function (x) { h += x[0] === 'exp' ? '<span class="gg-q exp" aria-hidden="true"></span>' : '<span class="gg-q" aria-hidden="true" style="background:' + SERV[x[0]].c + '">' + x[1] + '</span>'; });
    return '<td class="' + cls + '"><button type="button" class="gg-cb' + (ch ? ' choque' : '') + '" data-p="' + p.id + '" data-d="' + d + '"' + (af ? ' data-dica="' + af.t + ': ' + periodo(af) + '"' : '') + ' aria-label="' + rot + '">' + h + '</button></td>';
  }

  function linha(st, p) {
    var marcada = st.sel && st.sel.p === p.id;
    var inteiro = mesTodo(p);
    var cota = p.cota ? '<span class="cota' + (p.cota[0] > p.cota[1] ? ' acima' : '') + '" role="img" aria-label="' + p.cota[0] + ' de ' + p.cota[1] + ' saldos no mês"><i style="width:' + Math.min(100, p.cota[0] / p.cota[1] * 100) + '%"></i></span>' : '';
    var h = '<tr data-militar="' + p.id + '"' + (marcada ? ' class="lm"' : '') + '><th scope="row" class="nome"><button type="button" class="gg-nb' + (inteiro ? ' apagado' : '') + '" data-ficha="' + p.id + '" aria-label="Abrir a ficha de ' + p.pst + ' ' + p.gue + '">' +
      '<span class="l1"><small>' + p.pst + '</small><strong>' + p.gue + '</strong></span><span class="mat">' + p.mat + '</span>' + ic('ficha').replace('class="i"', 'class="i ficha"') + cota + '</button></th>';
    for (var d = 1; d <= DIAS; d++) h += celula(st, p, d);
    var bar = function (v, m) { return '<span class="gg-barra-c"><i style="width:' + (m ? v / m * 100 : 0) + '%"></i><b>' + v + '</b></span>'; };
    return h + '<td class="fim pjes">' + bar(p.pjes, MAX.pjes) + '</td><td class="fim diar">' + bar(p.dia, MAX.dia) + '</td></tr>';
  }

  function visiveis(st, e) {
    var t = semAcento(st.busca.trim()), dig = /^[\d.\-\s]+$/.test(t) ? t.replace(/\D/g, '') : '';
    return e.p.filter(function (p) {
      if (st.esconder && mesTodo(p)) return false;
      if (!t) return true;
      return semAcento(p.gue).indexOf(t) >= 0 || (dig && p.mat.replace(/\D/g, '').indexOf(dig) >= 0);
    });
  }

  function tabela(st, op) {
    var h = '<table class="gg-t" aria-label="Grade geral de dezembro de 2026"><thead><tr><th scope="col" class="nome">Militar</th>';
    for (var d = 1; d <= DIAS; d++) {
      var fds = dow(d) === 0 || dow(d) === 6;
      h += '<th scope="col" class="dia' + (fds || FERIADO[d] ? ' fds' : '') + (FERIADO[d] ? ' fer' : '') + '" aria-label="Dia ' + d + (FERIADO[d] ? ', feriado: ' + FERIADO[d] : '') + '"' + (FERIADO[d] ? ' title="' + FERIADO[d] + '"' : '') + '><b>' + d + '</b>' + SIG[dow(d)] + '</th>';
    }
    h += '<th scope="col" class="fim pjes">PJES</th><th scope="col" class="fim diar">Diárias</th></tr></thead><tbody>';
    var algum = false, busca = st.busca.trim() !== '';
    EQUIPES.forEach(function (e) {
      if (st.eqs.length && st.eqs.indexOf(e.k) < 0) return;
      var ps = visiveis(st, e); if (!ps.length) return;
      algum = true;
      var recolhida = !busca && st.rec.indexOf(e.k) >= 0;
      var nAf = ps.filter(function (p) { return afDe(p, HOJE); }).length;
      var resumo = nAf ? '<span class="gg-tr pequeno" aria-hidden="true"><span class="gg-af comeca termina"></span></span>' + nAf + (nAf > 1 ? ' afastados hoje' : ' afastado hoje') : '';
      h += '<tr class="faixa"><th scope="rowgroup" class="nome"><span class="gg-eq"><button type="button" data-rec="' + e.k + '" aria-expanded="' + !recolhida + '" aria-label="' + (recolhida ? 'Mostrar' : 'Recolher') + ' ' + e.n + '">' + ic(recolhida ? 'dir' : 'baixo') + '<strong>' + e.n + '</strong></button><small>' + ps.length + (ps.length > 1 ? ' militares' : ' militar') + '</small></span></th>' +
        '<td colspan="' + DIAS + '"><span class="gg-resumo">' + resumo + '</span></td><td class="fim pjes"></td><td class="fim diar"></td></tr>';
      if (!recolhida) ps.forEach(function (p) { h += linha(st, p); });
    });
    return h + '</tbody></table>' + (algum ? '' : '<p style="padding:16px;color:var(--apagado)">Ninguém com esse nome nas equipes escolhidas.</p>');
  }

  function painel(st, op) {
    var p = achar(st.sel.p), d = st.sel.d, af = afDe(p, d), b = p.serv[d] || [];
    var sub = 'Matrícula ' + p.mat + ', equipe ' + p.eq.toUpperCase() + ', jornada ' + (p.eq === 'adm' ? 'ADM' : 'Pronto');
    var dtxt = SIG[dow(d)].toLowerCase().replace('seg', 'segunda').replace('ter', 'terça').replace('qua', 'quarta').replace('qui', 'quinta').replace('sex', 'sexta').replace('sáb', 'sábado').replace('dom', 'domingo');
    var h = '<aside class="gg-pd" aria-label="Dia de ' + p.pst + ' ' + p.gue + '"><header><div><h4>' + p.pst + ' ' + p.gue + '</h4><p class="sub">' + sub + '</p>' +
      '<p class="chips"><span>CNH D</span><span>Voluntário JES</span></p></div><button type="button" class="botao discreto so-icone" data-fechar aria-label="Fechar">' + ic('x') + '</button></header>';
    h += '<section><p class="data">' + dtxt + ', ' + (d < 10 ? '0' + d : d) + '/12/2026</p>' +
      (af ? '<p class="gg-afastado">' + ic('alerta') + '<span><b>Afastado: ' + af.t + '</b>, de ' + periodo(af, true) + '.</span></p>' : '') +
      '<p style="color:var(--apagado)">' + (af ? 'Não marcou voluntariado neste dia.' : 'Marcou 07h às 19h no voluntariado.') + '</p>' +
      (p.ch.indexOf(d) >= 0 ? '<p style="color:var(--alerta)">O Pronto A e o JES A se sobrepõem das 07h às 19h.</p>' : '') + '</section>';
    h += '<section>';
    if (!b.length) h += '<p style="color:var(--apagado)">Sem serviço neste dia.</p>';
    b.forEach(function (x) {
      if (x[0] === 'exp') { h += '<div class="gg-servico"><div class="topo"><span class="tag" style="background:#8A94A1">Expediente</span><span>07h às 13h</span><span class="acoes"><button type="button" class="botao secundario">Tirar do expediente</button></span></div><p>Calculado pela jornada do ADM.</p></div>'; return; }
      h += '<div class="gg-servico"><div class="topo"><span class="tag" style="background:' + SERV[x[0]].c + '">' + SERV[x[0]].n + ' ' + x[1] + '</span><span>' + (HORA[x[1]] || '07h às 19h') + '</span><span class="acoes"><button type="button" class="botao secundario">Trocar</button><button type="button" class="botao secundario">Remover</button></span></div><p>Ordinário · ABT, Motorista</p></div>';
    });
    // no celular o botão fica fixo no pé da folha
    if (!op.cel) h += '<div><button type="button" class="botao secundario" data-adicionar aria-expanded="' + !!st.adicionando + '">Adicionar serviço neste dia</button></div>';
    if (st.adicionando) {
      if (af) h += '<p class="gg-aviso-af">' + ic('alerta') + '<span>Ele está de ' + af.t.toLowerCase() + ' neste dia. Dá para escalar mesmo assim: nada é bloqueado.</span></p>';
      h += '<div class="gg-servico"><div class="topo"><span class="tag" style="background:' + SERV.pronto.c + '">Pronto A</span><span>07h às 19h</span><span class="acoes"><button type="button" class="botao principal">Escalar</button></span></div><p>Ordinário · ABT, Motorista</p></div>';
    }
    return h + '</section></aside>';
  }

  function montar(raiz, op) {
    op.n = op.n || Math.floor(Math.random() * 1e6);
    var st = { busca: '', eqs: [], rec: [], esconder: false, sel: op.sel || null, adicionando: false, menu: op.menu || 'largo', menuAberto: !!op.menuAberto, antes: null, cheia: !!op.cheia, antesOculto: 'largo' };
    var tip = null;
    function desenhar(manter) {
      var rolaAntes = raiz.querySelector('.gg-rola'), sx = rolaAntes ? rolaAntes.scrollLeft : 0, sy = rolaAntes ? rolaAntes.scrollTop : 0;
      var temPainel = !!st.sel;
      raiz.className = 'gg' + (op.cel ? ' cel' : '') + (st.menu === 'recolhido' && !op.cel ? ' recolhido' : '') + (st.menu === 'oculto' && !op.cel ? ' oculto' : '') + (st.cheia ? ' cheia' : '') + (temPainel && !op.cel ? ' painel' : '') + (temPainel && op.cel ? ' com-folha' : '') + (op.cel && st.menuAberto ? ' menu-aberto' : '');
      var corpo = '<div class="gg-main">' + topo(op) + '<div class="gg-pag">' + cheiaBarra(st, op) + '<div class="gg-tit"><h3>Grade geral</h3><button type="button" class="botao secundario" data-cheia aria-pressed="false">' + ic('expandir') + 'Expandir grade</button></div>' + barra(st, op) + legenda() +
        '<div class="gg-quadro"><div class="gg-tab"><div class="gg-rola" data-rola tabindex="0" role="region" aria-label="Grade geral, role para os lados e para baixo">' + tabela(st, op) + '</div></div>' +
        (temPainel && !op.cel ? painel(st, op) : '') + '</div></div></div>';
      var extra = '';
      if (op.cel && temPainel) extra = '<div class="gg-veu"></div><div class="gg-folha" role="dialog" aria-label="Dia do militar"><div class="puxador" aria-hidden="true"></div><div class="miolo">' + painel(st, op) + '</div><div class="rodape"><button type="button" class="botao secundario" data-adicionar>Adicionar serviço neste dia</button></div></div>';
      if (op.cel && st.menuAberto) extra = '<div class="gg-veu" data-fechar-menu></div>';
      if (!op.cel && st.menu === 'oculto' && !st.cheia) extra += '<button type="button" class="gg-flutua" data-mostrar-menu aria-label="Mostrar o menu">' + ic('menu') + '<span>Menu</span></button>';
      raiz.innerHTML = (op.cel ? (st.menuAberto ? menu(op, st) : '') + corpo : menu(op, st) + corpo) + extra;
      var rola = raiz.querySelector('.gg-rola');
      if (rola) { rola.scrollLeft = manter === false ? 0 : sx; rola.scrollTop = manter === false ? 0 : sy; marcarRolagem(rola); }
      var alt = op.cel ? null : 560; if (alt) { raiz.style.setProperty('--alt', (st.cheia ? 700 : temPainel ? 520 : 560) + 'px'); raiz.style.setProperty('--alt-pd', (st.cheia ? 700 : 600) + 'px'); }
      if (op.cel && temPainel) { var s = raiz.querySelector('[data-p="' + st.sel.p + '"][data-d="' + st.sel.d + '"]'); var r2 = raiz.querySelector('.gg-rola'); if (s && r2) { var tr = s.closest('tr'); r2.scrollTop = Math.max(0, tr.offsetTop - 48); r2.scrollLeft = Math.max(0, s.closest('td').offsetLeft - 148 - 44); } }
    }
    function marcarRolagem(r) { r.classList.toggle('rolou-e', r.scrollLeft > 2); r.classList.toggle('rolou-d', r.scrollLeft + r.clientWidth < r.scrollWidth - 2); }
    function dica(btn) {
      if (!tip) { tip = document.createElement('div'); tip.className = 'gg-dica'; document.body.appendChild(tip); }
      var r = btn.getBoundingClientRect();
      tip.textContent = btn.getAttribute('data-dica'); tip.style.display = 'block';
      tip.style.left = r.left + 'px'; tip.style.top = (r.bottom + 6) + 'px';
    }
    function esconderDica() { if (tip) tip.style.display = 'none'; }
    raiz.addEventListener('mouseover', function (e) { var b = e.target.closest('[data-dica]'); if (b) dica(b); });
    raiz.addEventListener('mouseout', function (e) { if (e.target.closest('[data-dica]')) esconderDica(); });
    raiz.addEventListener('scroll', function (e) { if (e.target.matches && e.target.matches('.gg-rola')) { marcarRolagem(e.target); esconderDica(); } }, true);
    raiz.addEventListener('click', function (e) {
      var t = e.target;
      var cb = t.closest('.gg-cb');
      if (cb) { st.sel = { p: cb.getAttribute('data-p'), d: Number(cb.getAttribute('data-d')) }; st.adicionando = false;
        if (!op.cel && st.menu === 'largo') { st.antes = 'largo'; st.menu = 'recolhido'; }   // abaixo de 1440 px o menu recolhe sozinho para dar lugar ao painel
        desenhar(); return; }
      if (t.closest('[data-fechar]') || (t.closest('.gg-veu') && st.sel)) { st.sel = null; st.adicionando = false; if (!op.cel && st.antes) { st.menu = st.antes; st.antes = null; } desenhar(); return; }
      var fi = t.closest('[data-ficha]');
      if (fi) { var q = achar(fi.getAttribute('data-ficha')); var o = document.createElement('div'); o.className = 'gg-toast'; o.setAttribute('role', 'status'); o.textContent = 'Aqui abre a ficha de ' + q.pst + ' ' + q.gue + ', por cima da Grade.'; raiz.appendChild(o); setTimeout(function () { o.remove(); }, 2200); return; }
      var rc = t.closest('[data-rec]'); if (rc) { var k = rc.getAttribute('data-rec'), i = st.rec.indexOf(k); if (i >= 0) st.rec.splice(i, 1); else st.rec.push(k); desenhar(); return; }
      if (t.closest('[data-ocultar-menu]')) { st.antesOculto = st.antes || st.menu; st.antes = null; st.menu = 'oculto'; desenhar(); return; }
      if (t.closest('[data-mostrar-menu]')) { st.menu = st.antesOculto || 'largo'; desenhar(); var m = raiz.querySelector('.gg-menu a'); if (m) m.focus(); return; }
      if (t.closest('[data-cheia]')) { st.cheia = !st.cheia; desenhar(false); var b = raiz.querySelector('[data-cheia]'); if (b && !st.sel) b.focus(); return; }
      if (t.closest('[data-recolher]')) { st.menu = st.menu === 'largo' ? 'recolhido' : 'largo'; st.antes = null; desenhar(); return; }
      if (t.closest('[data-abrir-menu]')) { st.menuAberto = true; desenhar(); return; }
      if (t.closest('[data-fechar-menu]')) { st.menuAberto = false; desenhar(); return; }
      if (t.closest('[data-adicionar]')) { st.adicionando = !st.adicionando; desenhar(); return; }
      var g = t.closest('[data-eqs] button');
      if (g) {
        var todas = g.hasAttribute('data-todas'), c = g.getAttribute('data-chave');
        if (todas) st.eqs = []; else { var j = st.eqs.indexOf(c); if (j >= 0) st.eqs.splice(j, 1); else st.eqs.push(c); if (st.eqs.length === EQUIPES.length) st.eqs = []; }
        desenhar(); return;
      }
    });
    raiz.addEventListener('input', function (e) {
      if (e.target.matches('[data-busca]')) { st.busca = e.target.value; var pos = e.target.selectionStart; desenhar(); var n = raiz.querySelector('[data-busca]'); n.focus(); n.setSelectionRange(pos, pos); }
    });
    raiz.addEventListener('change', function (e) { if (e.target.matches('[data-esconder]')) { st.esconder = e.target.checked; desenhar(); } });
    desenhar();
    return { definir: function (o) { if (o.menu) { if (o.menu === 'oculto' && st.menu !== 'oculto') st.antesOculto = st.menu; st.menu = o.menu; st.antes = null; } if (o.sel !== undefined) st.sel = o.sel; if (o.menuAberto !== undefined) st.menuAberto = o.menuAberto; if (o.cheia !== undefined) st.cheia = o.cheia; desenhar(); }, estado: st };
  }

  // as amostras do traço do afastado: um trecho da Grade (dias 8 a 14) com dois afastados, um choque e a borda grossa
  function amostra(el, v) {
    var st = { sel: null, busca: "" };
    var h = '<table class="gg-t" aria-label="Amostra do traço do afastado"><thead><tr><th scope="col" class="nome">Militar</th>';
    for (var d = 8; d <= 14; d++) h += '<th scope="col" class="dia' + (dow(d) === 0 || dow(d) === 6 ? ' fds' : '') + '"><b>' + d + '</b>' + SIG[dow(d)] + '</th>';
    h += '</tr></thead><tbody>';
    ['a1', 'a3', 'a4', 'b2'].forEach(function (id) {
      var p = achar(id);
      h += '<tr><th scope="row" class="nome"><span class="gg-nb"><span class="l1"><small>' + p.pst + '</small><strong>' + p.gue + '</strong></span><span class="mat">' + p.mat + '</span></span></th>';
      for (var d = 8; d <= 14; d++) h += celula(st, p, d);
      h += '</tr>';
    });
    el.setAttribute('data-af', v);
    el.innerHTML = '<div class="gg-rola">' + h + '</tbody></table></div>';
  }

  // a tela escala para caber na página: o desenho é no tamanho real e o palco o reduz
  function palco(el, quadro, real) {
    function ajustar() {
      var k = real() ? 1 : Math.min(1, (el.clientWidth - 2) / 1440);
      quadro.style.zoom = k;
      el.classList.toggle('real', real());
    }
    ajustar(); window.addEventListener('resize', ajustar);
    return ajustar;
  }
  window.Grade = { montar: montar, palco: palco, achar: achar, amostra: amostra };
})();
