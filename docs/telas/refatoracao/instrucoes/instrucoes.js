// As telas da Instrução do dia (Manual). window.Instrucoes.montar(raiz, tipo) monta uma tela dentro de um elemento .in.
// Tipos: 'militar', 'presenca', 'cronograma', 'painel'. Todos os nomes e datas são fictícios; "hoje" é quinta, 3/12/2026.
(function () {
  'use strict';
  function ic(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function im(n) { return '<svg class="im" aria-hidden="true"><use href="#m-' + n + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var VIGENTE = { de: '30/11', ate: '6/12', titulo: 'Salvamento aquático: aproximação e abordagem',
    objetivo: 'Reconhecer os sinais de afogamento e fazer a aproximação segura da vítima.', quem: '1º SGT FALCÃO',
    materiais: [
      { t: 'Manual de Salvamento Aquático, capítulo 3', h: 'biblioteca.exemplo.br/manual-sa/cap3' },
      { t: 'Vídeo: abordagem da vítima (8 min)', h: 'videos.exemplo.br/abordagem-vitima' },
      { t: 'Lista de conferência da aproximação (1 página)', h: 'biblioteca.exemplo.br/lista-aproximacao' } ] };
  var SEMANAS = [
    { de: '23/11', ate: '29/11', titulo: 'Mangueiras e linhas de ataque', quem: '2º SGT RAMALHO', mats: 2, leram: '22 de 24', est: 'passada' },
    { de: '30/11', ate: '6/12', titulo: VIGENTE.titulo, quem: VIGENTE.quem, mats: 3, leram: '18 de 24', est: 'vigente' },
    { de: '7/12', ate: '13/12', titulo: 'Desencarcerador hidráulico: montagem e uso', quem: '3º SGT NUNES', mats: 2, leram: '', est: 'proxima' },
    { de: '14/12', ate: '20/12', titulo: 'Comunicação por rádio em ocorrência', quem: 'A definir', mats: 0, leram: '', est: 'proxima' } ];
  var PROXIMAS = SEMANAS.filter(function (s) { return s.est === 'proxima'; });

  // quem está de serviço hoje, vindo da escala (nome de guerra e função). O adjunto de dia é quem registra.
  var GRUPOS = [
    { nome: 'Pronto, turno A', hora: '7h às 19h', gente: [
      { id: 'p1', p: '2º SGT', n: 'RAMALHO', f: 'ABT, chefe' }, { id: 'p2', p: 'CB', n: 'ALMEIDA', f: 'ABT, motorista' },
      { id: 'p3', p: 'SD', n: 'CORREIA', f: 'ABT' }, { id: 'p4', p: '3º SGT', n: 'NUNES', f: 'APH, chefe' },
      { id: 'p5', p: 'CB', n: 'TAVARES', f: 'APH' }, { id: 'p6', p: 'SD', n: 'BRAGA', f: 'APH' } ] },
    { nome: 'Apoio Operacional Aquartelado', hora: '7h às 19h', gente: [
      { id: 'a1', p: '1º SGT', n: 'FALCÃO', f: 'Adjunto de dia', eu: true }, { id: 'a2', p: 'CB', n: 'LIMA', f: 'ACO, motorista' },
      { id: 'a3', p: 'SD', n: 'PEIXOTO', f: 'ACO, despachante' } ] },
    { nome: 'Saldo', hora: '7h às 19h', gente: [ { id: 's1', p: 'SD', n: 'MACEDO', f: 'ABT, cobrindo o Pronto' } ] } ];

  function moldura(aba, abas, corpo) {
    return '<header class="in-cab"><h3>Instruções</h3><span class="onde">1ª SB · quinta, 3 de dezembro</span></header>' +
      (abas.length > 1 ? '<nav class="in-abas" aria-label="Instruções">' + abas.map(function (a) {
        return '<a href="#' + a.id + '"' + (a.id === aba ? ' aria-current="page"' : '') + '>' + a.t + (a.conta ? '<span class="conta" aria-label="' + a.conta + ' pendentes">' + a.conta + '</span>' : '') + '</a>'; }).join('') + '</nav>' : '') + corpo;
  }

  /* ---- 1. o militar: a instrução desta semana ---- */
  function militar(est) {
    var v = VIGENTE;
    var leu = est.leu
      ? '<div class="feito">' + ic('ok') + 'Você marcou que leu, em 29/11 às 14h12.</div><button type="button" class="botao discreto" data-desfazer>Desfazer</button>'
      : '<button type="button" class="botao principal" data-li>Li o material</button><p>Abra os três materiais e marque aqui quando terminar.</p>';
    var corpo = '<div class="in-corpo"><div>' +
      '<section class="in-bloco" aria-labelledby="vig"><div class="in-soleira"><span class="etiqueta">Esta semana</span><span>' + v.de + ' a ' + v.ate + '</span></div>' +
        '<h4 class="in-titulo" id="vig">' + esc(v.titulo) + '</h4><p class="in-objetivo">' + esc(v.objetivo) + '</p>' +
        '<p class="in-quem">Quem ministra: <b>' + esc(v.quem) + '</b></p>' +
        '<h4 class="in-sub">Material</h4><ul class="in-mat">' + v.materiais.map(function (m) { return '<li><a href="#militar">' + ic('link') + '<span class="t"><b>' + esc(m.t) + '</b><small>' + esc(m.h) + '</small></span></a></li>'; }).join('') + '</ul>' +
        '<div class="in-leu">' + leu + '</div></section></div>' +
      '<aside><section class="in-bloco" aria-labelledby="mi"><h4 id="mi">Seu serviço nesta semana</h4><ul class="in-lista">' +
        '<li><span class="dia">Qui, 3</span><span class="o-que">Pronto, 7h às 19h</span><span class="etiqueta espera">Aguardando o adjunto</span></li>' +
        '<li><span class="dia">Sáb, 5</span><span class="o-que">Pronto, 19h às 7h</span><span class="etiqueta">A vir</span></li></ul>' +
        '<p class="in-rodape">A presença no dia é registrada pelo adjunto de dia.</p></section>' +
      '<section class="in-bloco" aria-labelledby="pr"><h4 id="pr">Próximas</h4><ul class="in-lista">' + PROXIMAS.map(function (s) {
        return '<li><span class="dia">' + s.de + '</span><span class="o-que">' + esc(s.titulo) + '</span></li>'; }).join('') + '</ul></section></aside></div>';
    return moldura('militar', [{ id: 'militar', t: 'Esta semana' }], corpo);
  }

  /* ---- 2. o adjunto de dia: a presença de hoje ---- */
  function conta(est) { var sim = 0, nao = 0, total = 0; GRUPOS.forEach(function (g) { g.gente.forEach(function (x) { total++; var s = est.marca[x.id]; if (s === 'sim') sim++; else if (s === 'nao') nao++; }); }); return { sim: sim, nao: nao, sem: total - sim - nao, total: total }; }
  function presenca(est) {
    var c = conta(est);
    var abas = [{ id: 'semana', t: 'Esta semana' }, { id: 'presenca', t: 'Presença de hoje' }];
    var cabeca = '<div class="in-soleira" style="margin-top:16px"><span class="etiqueta">Hoje, 3/12</span><span>Instrução da semana: <b>' + esc(VIGENTE.titulo) + '</b></span></div>';
    if (est.enviado) {
      return moldura('presenca', abas, cabeca + '<div class="in-enviado">' + ic('ok') + '<p><b>Registro enviado hoje, às 8h40, por 1º SGT FALCÃO.</b><br>' + c.sim + ' presentes, ' + c.nao + ' ausentes' + (c.sem ? ', ' + c.sem + ' sem marcação' : '') + '.</p><button type="button" class="botao secundario" data-corrigir>Corrigir o registro</button></div>');
    }
    var grupos = GRUPOS.map(function (g) {
      return '<section class="in-grupo" aria-label="' + g.nome + '"><h4>' + g.nome + ' <small>' + g.hora + '</small></h4><ul class="in-pessoas">' + g.gente.map(function (x) {
        var s = est.marca[x.id] || '';
        return '<li class="in-pessoa"><span class="quem"><b>' + x.p + ' ' + x.n + '</b>' + (x.eu ? ' <span class="etiqueta">Você</span>' : '') + '<small>' + x.f + '</small></span>' +
          '<span class="in-seg" role="group" aria-label="Presença de ' + x.n + '"><button type="button" class="sim" data-p="' + x.id + '" data-v="sim" aria-pressed="' + (s === 'sim') + '">Presente</button><button type="button" class="nao" data-p="' + x.id + '" data-v="nao" aria-pressed="' + (s === 'nao') + '">Ausente</button></span>' +
          (s === 'nao' ? '<label class="in-motivo"><span class="so-leitor">Motivo da ausência de ' + x.n + '</span><input type="text" data-motivo="' + x.id + '" placeholder="Motivo (opcional)" value="' + esc(est.motivo[x.id] || '') + '"></label>' : '') + '</li>'; }).join('') + '</ul></section>'; }).join('');
    return moldura('presenca', abas, cabeca +
      '<div class="in-resumo"><span class="conta"><b>' + c.sim + '</b> presentes · <b>' + c.nao + '</b> ausentes · <b>' + c.sem + '</b> sem marcação</span><span class="acoes"><button type="button" class="botao secundario" data-todos>' + ic('ok') + 'Marcar todos presentes</button></span></div>' +
      grupos +
      '<div class="in-envio"><label class="campo"><span>Observação (opcional)</span><textarea data-obs placeholder="Ex.: a instrução foi no pátio, por causa da chuva.">' + esc(est.obs) + '</textarea></label>' +
      '<div class="in-foto">' + ic('mais') + '<span>Fotos da instrução: em breve. O lugar fica reservado aqui.</span></div>' +
      '<div class="in-barra"><p>' + (c.sem ? c.sem + ' sem marcação vão como "sem marcação" no painel. Você pode enviar assim e corrigir depois.' : 'Tudo marcado. Você pode corrigir o registro até o fim do dia.') + '</p><button type="button" class="botao principal" data-enviar>' + ic('enviar') + 'Enviar registro</button></div></div>');
  }

  /* ---- 3. o responsável: o cronograma ---- */
  var ROT = { passada: 'Passada', vigente: 'Vigente', proxima: 'Próxima' };
  function cronograma(est, celular) {
    var abas = [{ id: 'semana', t: 'Esta semana' }, { id: 'cronograma', t: 'Cronograma' }, { id: 'painel', t: 'Painel' }];
    var sel = SEMANAS[est.sel] || SEMANAS[2], novo = est.sel < 0;
    var lista = '<div><div class="topo"><h4>Cronograma da 1ª SB</h4><button type="button" class="botao principal" data-nova>' + ic('mais') + 'Nova instrução</button></div><ul class="in-semanas">' + SEMANAS.map(function (s, i) {
      return '<li><button type="button" class="in-semana" data-sel="' + i + '"' + (i === est.sel ? ' aria-current="true"' : '') + '><span class="de">' + s.de + ' a ' + s.ate + '<small>' + ROT[s.est] + '</small></span><span class="t"><b>' + esc(s.titulo) + '</b><small>Ministra: ' + esc(s.quem) + ' · ' + s.mats + ' ' + (s.mats === 1 ? 'material' : 'materiais') + '</small></span>' + (s.est === 'vigente' ? '<span class="etiqueta">Vigente</span>' : '') + '</button></li>'; }).join('') + '</ul></div>';
    var mats = novo ? [{ t: '', h: '' }] : (sel.mats ? VIGENTE.materiais.slice(0, sel.mats) : []);
    var form = '<form class="in-form" onsubmit="return false" aria-label="' + (novo ? 'Nova instrução' : 'Editar instrução') + '"><h4>' + (novo ? 'Nova instrução' : 'Editar instrução') + '</h4>' +
      '<label class="campo"><span>Tema</span><input type="text" value="' + (novo ? '' : esc(sel.titulo)) + '" placeholder="Ex.: Salvamento aquático"></label>' +
      '<div class="duas"><label class="campo"><span>Começa em</span><input type="text" value="' + (novo ? '' : sel.de + '/2026') + '" placeholder="dd/mm/aaaa"></label><label class="campo"><span>Termina em</span><input type="text" value="' + (novo ? '' : sel.ate + '/2026') + '" placeholder="dd/mm/aaaa"></label></div>' +
      (!novo && sel.est !== 'proxima' ? '' : '<p class="in-aviso-sup">' + ic(novo ? 'alerta' : 'ok') + '<span>' + (novo ? 'Se o período cruzar com outra instrução da 1ª SB, o sistema avisa aqui. Não impede de salvar.' : 'Nenhuma outra instrução vale nesse período.') + '</span></p>') +
      '<label class="campo"><span>Objetivo</span><textarea placeholder="O que o militar deve saber ou saber fazer ao fim da semana.">' + (novo || sel.est !== 'vigente' ? '' : esc(VIGENTE.objetivo)) + '</textarea></label>' +
      '<label class="campo"><span>Quem ministra</span><input type="text" value="' + (novo ? '' : esc(sel.quem)) + '" placeholder="Nome de guerra, ou o que preferir"></label>' +
      '<div><span class="in-sub" style="margin:0 0 6px;display:block">Material (links)</span><div class="in-mats">' + mats.map(function (m) { return '<div class="m"><input type="text" value="' + esc(m.t) + '" placeholder="Título" aria-label="Título do material"><input type="text" value="' + esc(m.h) + '" placeholder="Link" aria-label="Link do material"><button type="button" class="botao discreto so-icone" aria-label="Tirar este material">' + ic('lixo') + '</button></div>'; }).join('') +
      '<button type="button" class="botao secundario" style="justify-self:start">' + ic('mais') + 'Adicionar material</button></div></div>' +
      '<div class="in-barra"><button type="button" class="botao principal">Salvar</button><button type="button" class="botao discreto">' + (novo ? 'Cancelar' : 'Fechar') + '</button></div></form>';
    if (celular) {
      return moldura('cronograma', abas, '<div class="in-cron" style="margin-top:12px"><a class="elo" href="#cronograma" style="font-size:var(--t13)">‹ Cronograma da 1ª SB</a>' + form + '</div>');
    }
    return moldura('cronograma', abas, '<div class="in-cron">' + lista + form + '</div>');
  }

  /* ---- 4. o painel ---- */
  var DIAS = [ { d: 'seg', n: 30, s: 'ok', t: 'Registrado' }, { d: 'ter', n: 1, s: 'falta', t: 'Sem registro' }, { d: 'qua', n: 2, s: 'ok', t: 'Registrado' },
    { d: 'qui', n: 3, s: 'hoje', t: 'Hoje' }, { d: 'sex', n: 4, s: 'vem', t: 'A vir' }, { d: 'sáb', n: 5, s: 'vem', t: 'A vir' }, { d: 'dom', n: 6, s: 'vem', t: 'A vir' } ];
  function painel(est, celular) {
    var abas = [{ id: 'semana', t: 'Esta semana' }, { id: 'cronograma', t: 'Cronograma' }, { id: 'painel', t: 'Painel' }];
    var corpo = '<div class="in-filtros"><label class="campo" style="min-width:140px"><span>Unidade</span><select class="in-escolha"><option>1ª SB</option><option>2ª SB</option></select></label>' +
      '<div class="in-passo" role="group" aria-label="Semana"><button type="button" class="botao secundario so-icone" aria-label="Semana anterior">' + ic('esq') + '</button><b>30/11 a 6/12</b><button type="button" class="botao secundario so-icone" aria-label="Próxima semana">' + ic('dir') + '</button></div></div>' +
      '<div class="in-numeros">' +
        '<section class="in-bloco in-numero" aria-labelledby="nl"><h4 id="nl">Leitura</h4><div class="grande">18 de 24 <small>leram o material</small></div><div class="in-barra-leitura" role="img" aria-label="18 de 24, 75%"><i style="width:75%"></i></div></section>' +
        '<section class="in-bloco in-numero" aria-labelledby="np"><h4 id="np">Participação</h4><div class="grande">2 de 3 <small>dias de serviço com registro</small></div>' +
          '<ul class="in-dias" aria-label="Dias da semana">' + DIAS.map(function (x) { return '<li class="' + x.s + '"><span>' + x.d + '</span><b>' + x.n + '</b>' + (x.s === 'ok' ? ic('ok') : x.s === 'falta' ? ic('alerta') : '') + '<span class="so-leitor">' + x.t + '</span></li>'; }).join('') + '</ul>' +
          '<p class="in-legenda">Terça, 1/12, ficou sem registro do adjunto.</p></section></div>' +
      '<div class="in-pendentes">' +
        '<section class="in-bloco in-pend" aria-labelledby="pl"><h4 id="pl">Ainda não leram <span class="etiqueta">6</span></h4><ul>' + ['CB TAVARES', 'SD BRAGA', 'SD CORREIA', 'CB LIMA', 'SD PEIXOTO', 'SD MACEDO'].map(function (n, i) { return '<li><span>' + n + '</span>' + (i < 2 ? '<button type="button" class="botao secundario">Marcar que leu</button>' : '') + '</li>'; }).join('') + '</ul></section>' +
        '<section class="in-bloco in-pend" aria-labelledby="pp"><h4 id="pp">Estiveram de serviço e sem presença <span class="etiqueta">3</span></h4><ul>' +
          '<li><span>SD BRAGA<br><small>quarta, 2/12: sem marcação</small></span></li><li><span>CB ALMEIDA<br><small>quarta, 2/12: ausente, consulta médica</small></span></li><li><span>Terça, 1/12<br><small>sem registro do adjunto: 7 militares</small></span></li></ul></section></div>' +
      '<p class="in-rodape">O painel só mostra: nada aqui trava a escala. Afastados na semana (2) não entram nas contas.</p>';
    return moldura('painel', abas, corpo);
  }

  function montar(raiz, tipo) {
    var est = { leu: false, marca: { a1: 'sim', a3: 'sim', p2: 'nao' }, motivo: { p2: 'Consulta médica' }, obs: '', enviado: false, sel: 2 };
    var celular = !!raiz.closest('.celular');
    function desenhar() {
      var h = tipo === 'militar' ? militar(est) : tipo === 'presenca' ? presenca(est) : tipo === 'cronograma' ? cronograma(est, celular) : painel(est, celular);
      var rola = raiz.scrollTop; raiz.innerHTML = h; raiz.scrollTop = rola;
    }
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('button, a[href^="#"]'); if (!b) return;
      if (b.tagName === 'A') { e.preventDefault(); return; }
      if (b.hasAttribute('data-li')) est.leu = true;
      else if (b.hasAttribute('data-desfazer')) est.leu = false;
      else if (b.dataset.p) { est.marca[b.dataset.p] = est.marca[b.dataset.p] === b.dataset.v ? '' : b.dataset.v; }
      else if (b.hasAttribute('data-todos')) { GRUPOS.forEach(function (g) { g.gente.forEach(function (x) { if (est.marca[x.id] !== 'nao') est.marca[x.id] = 'sim'; }); }); }
      else if (b.hasAttribute('data-enviar')) est.enviado = true;
      else if (b.hasAttribute('data-corrigir')) est.enviado = false;
      else if (b.dataset.sel) est.sel = +b.dataset.sel;
      else if (b.hasAttribute('data-nova')) est.sel = -1;
      else return;
      desenhar();
    });
    raiz.addEventListener('input', function (e) {
      if (e.target.dataset.motivo) est.motivo[e.target.dataset.motivo] = e.target.value;
      if (e.target.hasAttribute('data-obs')) est.obs = e.target.value;
    });
    desenhar();
  }

  // os cartões do módulo na tela inicial (três estados) e no menu
  function cartoes(raiz) {
    function a(cls, marca, sub) { return '<div class="in-atalho ' + cls + '">' + im('instrucoes') + '<b>Instruções</b><small>' + sub + '</small>' + (marca ? '<span class="marca">' + marca + '</span>' : '') + '</div>'; }
    raiz.innerHTML =
      '<figure>' + a('', '1', 'Esta semana: salvamento aquático. Falta ler.') + '<figcaption>Militar que ainda não leu a instrução da semana.</figcaption></figure>' +
      '<figure>' + a('', '', 'Esta semana: salvamento aquático. Você já leu.') + '<figcaption>Militar que já marcou a leitura.</figcaption></figure>' +
      '<figure>' + a('acao', '1', 'Registrar a presença de hoje, 3/12.') + '<figcaption>Adjunto de dia, no dia do serviço dele. Some quando o registro é enviado.</figcaption></figure>';
  }

  window.Instrucoes = { montar: montar, cartoes: cartoes };
})();
