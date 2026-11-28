// As telas da Instrução do dia (Manual), versão 2. window.Instrucoes.montar(raiz, tipo) monta uma tela dentro de um elemento .in.
// Tipos: 'militar', 'presenca', 'cronograma', 'painel'. Todos os nomes e datas são fictícios; "hoje" é quinta, 3/12/2026.
(function () {
  'use strict';
  function ic(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function im(n) { return '<svg class="im" aria-hidden="true"><use href="#m-' + n + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // o material: arquivo enviado ao sistema ou link (decisão do usuário, 28/11)
  var VIGENTE = { de: '30/11', ate: '6/12', titulo: 'Salvamento aquático: aproximação e abordagem',
    objetivo: 'Reconhecer os sinais de afogamento e fazer a aproximação segura da vítima.', quem: '1º SGT FALCÃO',
    materiais: [
      { t: 'Manual de Salvamento Aquático, capítulo 3', tipo: 'arquivo', h: 'manual-sa-cap3.pdf · 2,4 MB' },
      { t: 'Vídeo: abordagem da vítima (8 min)', tipo: 'link', h: 'videos.exemplo.br/abordagem-vitima' },
      { t: 'Lista de conferência da aproximação', tipo: 'arquivo', h: 'lista-aproximacao.pdf · 180 KB' } ] };
  var SEMANAS = [
    { de: '23/11', ate: '29/11', titulo: 'Mangueiras e linhas de ataque', quem: '2º SGT RAMALHO', mats: 2, est: 'passada' },
    { de: '30/11', ate: '6/12', titulo: VIGENTE.titulo, quem: VIGENTE.quem, mats: 3, est: 'vigente' },
    { de: '7/12', ate: '13/12', titulo: 'Desencarcerador hidráulico: montagem e uso', quem: 'Técnico da empresa fornecedora', mats: 2, est: 'proxima' },
    { de: '14/12', ate: '20/12', titulo: 'Comunicação por rádio em ocorrência', quem: 'O mais antigo do dia', mats: 0, est: 'proxima' } ];
  var PROXIMAS = SEMANAS.filter(function (s) { return s.est === 'proxima'; });

  // o efetivo do dia, vindo da escala: cada um com o horário em que assume e deixa o serviço (em horas, 24 = 0h do dia seguinte)
  var EFETIVO = [
    { id: 'p1', p: '2º SGT', n: 'RAMALHO', f: 'Pronto A · ABT', de: 7, ate: 19 }, { id: 'p2', p: 'CB', n: 'ALMEIDA', f: 'Pronto A · ABT', de: 7, ate: 19 },
    { id: 'p3', p: 'SD', n: 'CORREIA', f: 'Pronto A · ABT', de: 7, ate: 19 }, { id: 'p4', p: '3º SGT', n: 'NUNES', f: 'Pronto A · APH', de: 7, ate: 19 },
    { id: 'p5', p: 'CB', n: 'TAVARES', f: 'Pronto A · APH', de: 7, ate: 19 }, { id: 'p6', p: 'SD', n: 'BRAGA', f: 'Pronto A · APH', de: 7, ate: 19 },
    { id: 'a1', p: '1º SGT', n: 'FALCÃO', f: 'Adjunto de dia', de: 7, ate: 31, eu: true }, { id: 'a2', p: 'CB', n: 'LIMA', f: 'ACO · motorista', de: 7, ate: 19 },
    { id: 'a3', p: 'SD', n: 'PEIXOTO', f: 'ACO · despachante', de: 7, ate: 19 }, { id: 's1', p: 'SD', n: 'MACEDO', f: 'Saldo · ABT', de: 7, ate: 19 },
    { id: 'e1', p: '2º TEN', n: 'MARQUES', f: 'Expediente', de: 8, ate: 17 }, { id: 'e2', p: 'CB', n: 'SANTANA', f: 'Expediente', de: 8, ate: 17 },
    { id: 'b1', p: '2º SGT', n: 'VIEIRA', f: 'Pronto B · ABT', de: 19, ate: 31 }, { id: 'b2', p: 'CB', n: 'ROCHA', f: 'Pronto B · ABT', de: 19, ate: 31 },
    { id: 'b3', p: 'SD', n: 'DUARTE', f: 'Pronto B · APH', de: 19, ate: 31 }, { id: 'b4', p: 'SD', n: 'MOURA', f: 'Pronto B · APH', de: 19, ate: 31 } ];
  function horas(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); if (!m) return null; var h = +m[1] + (+m[2]) / 60; return h < 7 ? h + 24 : h; }
  function deServico(t) { var h = horas(t); if (h === null) return []; return EFETIVO.filter(function (x) { return x.de <= h && h < x.ate; }); }

  function moldura(aba, abas, corpo) {
    return '<header class="in-cab"><h3>Instruções</h3><span class="onde">1ª SB · quinta, 3 de dezembro</span></header>' +
      (abas.length > 1 ? '<nav class="in-abas" aria-label="Instruções">' + abas.map(function (a) {
        return '<a href="#' + a.id + '"' + (a.id === aba ? ' aria-current="page"' : '') + '>' + a.t + '</a>'; }).join('') + '</nav>' : '') + corpo;
  }
  function material(m) {
    return '<li><a href="#militar">' + ic(m.tipo === 'arquivo' ? 'arquivo' : 'link') + '<span class="t"><b>' + esc(m.t) + '</b><small>' + (m.tipo === 'arquivo' ? 'Arquivo: ' : 'Link: ') + esc(m.h) + '</small></span></a></li>';
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
        '<h4 class="in-sub">Material</h4><ul class="in-mat">' + v.materiais.map(material).join('') + '</ul>' +
        '<div class="in-leu">' + leu + '</div></section></div>' +
      '<aside><section class="in-bloco" aria-labelledby="pr"><h4 id="pr">Próximas</h4><ul class="in-lista">' + PROXIMAS.map(function (s) {
        return '<li><span class="dia">' + s.de + '</span><span class="o-que">' + esc(s.titulo) + '</span></li>'; }).join('') + '</ul></section></aside></div>';
    return moldura('militar', [{ id: 'militar', t: 'Esta semana' }], corpo);
  }

  /* ---- 2. o adjunto de dia: a instrução e a presença, numa tela só ---- */
  function presenca(est) {
    var abas = [{ id: 'semana', t: 'Esta semana' }, { id: 'presenca', t: 'Registrar a instrução de hoje' }];
    var lista = deServico(est.hora);
    var aus = lista.filter(function (x) { return est.fora[x.id]; });
    if (est.enviado) {
      return moldura('presenca', abas, '<div class="in-enviado" style="margin-top:16px">' + ic('ok') + '<p><b>Registro enviado hoje, às 15h10, por 1º SGT FALCÃO.</b><br>Instrução às ' + esc(est.hora) + ', ministrada por ' + esc(est.quem || 'não informado') + '. ' + (lista.length - aus.length) + ' presentes e ' + aus.length + ' ' + (aus.length === 1 ? 'ausente' : 'ausentes') + '.</p><button type="button" class="botao secundario" data-corrigir>Corrigir o registro</button></div>');
    }
    var instr = '<section class="in-bloco in-hoje" aria-labelledby="ih"><div class="in-soleira"><span class="etiqueta">Instrução da semana</span><span>' + VIGENTE.de + ' a ' + VIGENTE.ate + '</span></div>' +
      '<h4 class="in-titulo" id="ih">' + esc(VIGENTE.titulo) + '</h4>' +
      '<div class="in-dados"><label class="campo"><span>Horário da instrução</span><input type="time" data-hora value="' + esc(est.hora) + '"></label>' +
      '<label class="campo"><span>Quem ministrou</span><input type="text" data-quem value="' + esc(est.quem) + '" placeholder="Ex.: o adjunto de dia, o mais antigo do dia, um técnico"></label></div></section>';
    var checks = lista.length ? '<ul class="in-checks">' + lista.map(function (x) {
      var fora = !!est.fora[x.id];
      return '<li class="' + (fora ? 'fora' : '') + '"><label class="in-check"><input type="checkbox" data-p="' + x.id + '"' + (fora ? '' : ' checked') + '><span class="quem"><b>' + x.p + ' ' + x.n + '</b>' + (x.eu ? ' <small class="voce">você</small>' : '') + '<small>' + x.f + '</small></span></label>' +
        (fora ? '<input class="in-motivo" type="text" data-motivo="' + x.id + '" placeholder="Motivo (opcional)" aria-label="Motivo da ausência de ' + x.n + '" value="' + esc(est.motivo[x.id] || '') + '">' : '') + '</li>'; }).join('') + '</ul>'
      : '<p class="in-vazio">Escreva o horário da instrução para ver quem estava de serviço.</p>';
    return moldura('presenca', abas, instr +
      '<section class="in-pres" aria-labelledby="ip"><div class="in-resumo"><h4 id="ip">De serviço às ' + esc(est.hora || '—') + ' <small>' + lista.length + ' militares, pela escala do dia</small></h4>' +
        '<span class="conta"><b>' + (lista.length - aus.length) + '</b> presentes · <b>' + aus.length + '</b> ' + (aus.length === 1 ? 'ausente' : 'ausentes') + '</span></div>' +
        '<p class="in-dica">Todos começam marcados. Desmarque quem não participou.</p>' + checks + '</section>' +
      '<div class="in-envio"><label class="campo"><span>Observação (opcional)</span><textarea data-obs placeholder="Ex.: a instrução foi no pátio, por causa da chuva.">' + esc(est.obs) + '</textarea></label>' +
      '<div class="in-foto">' + ic('mais') + '<span>Fotos da instrução: em breve. O lugar fica reservado aqui.</span></div>' +
      '<div class="in-barra"><p>Você pode corrigir o registro até o fim do dia.</p><button type="button" class="botao principal" data-enviar' + (lista.length ? '' : ' disabled') + '>' + ic('enviar') + 'Enviar registro</button></div></div>');
  }

  /* ---- 3. a SICT: o cronograma ---- */
  var ROT = { passada: 'Passada', vigente: 'Vigente', proxima: 'Próxima' };
  function cronograma(est, celular) {
    var abas = [{ id: 'semana', t: 'Esta semana' }, { id: 'cronograma', t: 'Cronograma' }, { id: 'painel', t: 'Painel' }];
    var sel = SEMANAS[est.sel] || SEMANAS[2], novo = est.sel < 0;
    var lista = '<div><div class="topo"><h4>Cronograma da 1ª SB</h4><button type="button" class="botao principal" data-nova>' + ic('mais') + 'Nova instrução</button></div><ul class="in-semanas">' + SEMANAS.map(function (s, i) {
      return '<li><button type="button" class="in-semana" data-sel="' + i + '"' + (i === est.sel ? ' aria-current="true"' : '') + '><span class="de">' + s.de + ' a ' + s.ate + '<small>' + ROT[s.est] + '</small></span><span class="t"><b>' + esc(s.titulo) + '</b><small>Ministra: ' + esc(s.quem) + ' · ' + s.mats + ' ' + (s.mats === 1 ? 'material' : 'materiais') + '</small></span>' + (s.est === 'vigente' ? '<span class="etiqueta">Vigente</span>' : '') + '</button></li>'; }).join('') + '</ul></div>';
    var mats = novo ? [{ t: '', tipo: 'arquivo', h: '' }] : (sel.mats ? VIGENTE.materiais.slice(0, sel.mats) : []);
    var form = '<form class="in-form" onsubmit="return false" aria-label="' + (novo ? 'Nova instrução' : 'Editar instrução') + '"><h4>' + (novo ? 'Nova instrução' : 'Editar instrução') + '</h4>' +
      '<label class="campo"><span>Tema</span><input type="text" value="' + (novo ? '' : esc(sel.titulo)) + '" placeholder="Ex.: Salvamento aquático"></label>' +
      '<div class="duas"><label class="campo"><span>Começa em</span><input type="text" value="' + (novo ? '' : sel.de + '/2026') + '" placeholder="dd/mm/aaaa"></label><label class="campo"><span>Termina em</span><input type="text" value="' + (novo ? '' : sel.ate + '/2026') + '" placeholder="dd/mm/aaaa"></label></div>' +
      (novo ? '<p class="in-aviso-sup">' + ic('alerta') + '<span>Se o período cruzar com outra instrução da 1ª SB, o sistema avisa aqui. Não impede de salvar.</span></p>' : '') +
      '<label class="campo"><span>Objetivo</span><textarea placeholder="O que o militar deve saber ou saber fazer ao fim da semana.">' + (novo || sel.est !== 'vigente' ? '' : esc(VIGENTE.objetivo)) + '</textarea></label>' +
      '<label class="campo"><span>Quem ministra</span><input type="text" value="' + (novo ? '' : esc(sel.quem)) + '" placeholder="Texto livre: um militar, o adjunto de dia, um técnico…"></label>' +
      '<div><span class="in-sub" style="margin:0 0 6px;display:block">Material</span><div class="in-mats">' + mats.map(function (m, k) {
        var arq = m.tipo === 'arquivo';
        return '<div class="m"><input type="text" value="' + esc(m.t) + '" placeholder="Título" aria-label="Título do material">' +
          '<span class="in-seg pequeno" role="group" aria-label="Como enviar"><button type="button" aria-pressed="' + arq + '" data-tipo="' + k + ':arquivo">Arquivo</button><button type="button" aria-pressed="' + !arq + '" data-tipo="' + k + ':link">Link</button></span>' +
          (arq ? '<span class="in-arq">' + (m.h ? ic('arquivo') + '<span>' + esc(m.h) + '</span><button type="button" class="botao discreto">Trocar</button>' : '<button type="button" class="botao secundario">' + ic('enviar') + 'Escolher arquivo</button><small>PDF, imagem ou documento</small>') + '</span>'
               : '<input type="text" value="' + esc(m.h) + '" placeholder="https://" aria-label="Link do material">') +
          '<button type="button" class="botao discreto so-icone" aria-label="Tirar este material">' + ic('lixo') + '</button></div>'; }).join('') +
      '<button type="button" class="botao secundario" style="justify-self:start">' + ic('mais') + 'Adicionar material</button></div></div>' +
      '<div class="in-barra"><button type="button" class="botao principal">Salvar</button><button type="button" class="botao discreto">' + (novo ? 'Cancelar' : 'Fechar') + '</button></div></form>';
    if (celular) return moldura('cronograma', abas, '<div class="in-cron" style="margin-top:12px"><a class="elo" href="#cronograma" style="font-size:var(--t13)">‹ Cronograma da 1ª SB</a>' + form + '</div>');
    return moldura('cronograma', abas, '<div class="in-cron">' + lista + form + '</div>');
  }

  /* ---- 4. o painel ---- */
  var DIAS = [ { d: 'seg', n: 30, s: 'ok', t: 'Registrado' }, { d: 'ter', n: 1, s: 'falta', t: 'Sem registro' }, { d: 'qua', n: 2, s: 'ok', t: 'Registrado' },
    { d: 'qui', n: 3, s: 'hoje', t: 'Hoje' }, { d: 'sex', n: 4, s: 'vem', t: 'A vir' }, { d: 'sáb', n: 5, s: 'vem', t: 'A vir' }, { d: 'dom', n: 6, s: 'vem', t: 'A vir' } ];
  var NAO_LERAM = [ { n: 'CB TAVARES', sem: true }, { n: 'SD BRAGA', sem: true }, { n: 'SD CORREIA' }, { n: 'CB LIMA' }, { n: 'SD PEIXOTO' }, { n: 'SD MACEDO' } ];
  function painel(est) {
    var abas = [{ id: 'semana', t: 'Esta semana' }, { id: 'cronograma', t: 'Cronograma' }, { id: 'painel', t: 'Painel' }];
    var corpo = '<div class="in-filtros"><label class="campo" style="min-width:140px"><span>Unidade</span><select class="in-escolha"><option>1ª SB</option><option>2ª SB</option></select></label>' +
      '<div class="in-passo" role="group" aria-label="Semana"><button type="button" class="botao secundario so-icone" aria-label="Semana anterior">' + ic('esq') + '</button><b>30/11 a 6/12</b><button type="button" class="botao secundario so-icone" aria-label="Próxima semana">' + ic('dir') + '</button></div></div>' +
      '<div class="in-numeros">' +
        '<section class="in-bloco in-numero" aria-labelledby="nl"><h4 id="nl">Leitura</h4><div class="grande">18 de 24 <small>leram o material</small></div><div class="in-barra-leitura" role="img" aria-label="18 de 24, 75%"><i style="width:75%"></i></div></section>' +
        '<section class="in-bloco in-numero" aria-labelledby="np"><h4 id="np">Participação</h4><div class="grande">2 de 3 <small>dias de serviço com registro</small></div>' +
          '<ul class="in-dias" aria-label="Dias da semana">' + DIAS.map(function (x) { return '<li class="' + x.s + '"><span>' + x.d + '</span><b>' + x.n + '</b>' + (x.s === 'ok' ? ic('ok') : x.s === 'falta' ? ic('alerta') : '') + '<span class="so-leitor">' + x.t + '</span></li>'; }).join('') + '</ul>' +
          '<p class="in-legenda">Terça, 1/12, ficou sem registro do adjunto.</p></section></div>' +
      '<div class="in-pendentes">' +
        '<section class="in-bloco in-pend" aria-labelledby="pl"><h4 id="pl">Ainda não leram <span class="etiqueta">' + NAO_LERAM.filter(function (x) { return !est.lidos[x.n]; }).length + '</span></h4><ul>' + NAO_LERAM.filter(function (x) { return !est.lidos[x.n]; }).map(function (x) {
          return '<li><span>' + x.n + (x.sem ? '<br><small>ainda não criou o acesso</small>' : '') + '</span>' + (x.sem ? '<button type="button" class="botao secundario" data-lido="' + x.n + '">Registrar a leitura</button>' : '') + '</li>'; }).join('') + '</ul></section>' +
        '<section class="in-bloco in-pend" aria-labelledby="pp"><h4 id="pp">Estiveram de serviço e não participaram <span class="etiqueta">3</span></h4><ul>' +
          '<li><span>CB ALMEIDA<br><small>quarta, 2/12: consulta médica</small></span></li><li><span>SD BRAGA<br><small>quarta, 2/12: sem motivo</small></span></li><li><span>Terça, 1/12<br><small>sem registro do adjunto: 10 militares de serviço</small></span></li></ul></section></div>' +
      '<p class="in-rodape">O painel só mostra: nada aqui trava a escala. Quem conta é quem estava de serviço, pela escala do dia, no horário da instrução.</p>';
    return moldura('painel', abas, corpo);
  }

  function montar(raiz, tipo) {
    var est = { leu: false, hora: '14:00', quem: '1º SGT FALCÃO', fora: { p2: true }, motivo: { p2: 'Consulta médica' }, obs: '', enviado: false, sel: 2, lidos: {} };
    var celular = !!raiz.closest('.celular');
    function desenhar() {
      var h = tipo === 'militar' ? militar(est) : tipo === 'presenca' ? presenca(est) : tipo === 'cronograma' ? cronograma(est, celular) : painel(est);
      var rola = raiz.scrollTop; raiz.innerHTML = h; raiz.scrollTop = rola;
    }
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('button, a[href^="#"]'); if (!b) return;
      if (b.tagName === 'A') { e.preventDefault(); return; }
      if (b.hasAttribute('data-li')) est.leu = true;
      else if (b.hasAttribute('data-desfazer')) est.leu = false;
      else if (b.hasAttribute('data-enviar')) est.enviado = true;
      else if (b.hasAttribute('data-corrigir')) est.enviado = false;
      else if (b.dataset.sel) est.sel = +b.dataset.sel;
      else if (b.hasAttribute('data-nova')) est.sel = -1;
      else if (b.dataset.lido) est.lidos[b.dataset.lido] = true;
      else if (b.dataset.tipo) { var g = b.closest('.in-seg'); g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); return; }
      else return;
      desenhar();
    });
    raiz.addEventListener('change', function (e) {
      if (e.target.dataset.p) { est.fora[e.target.dataset.p] = !e.target.checked; desenhar(); }
      else if (e.target.hasAttribute('data-hora')) { est.hora = e.target.value; desenhar(); }
    });
    raiz.addEventListener('input', function (e) {
      if (e.target.dataset.motivo) est.motivo[e.target.dataset.motivo] = e.target.value;
      if (e.target.hasAttribute('data-obs')) est.obs = e.target.value;
      if (e.target.hasAttribute('data-quem')) est.quem = e.target.value;
    });
    desenhar();
  }

  // os cartões do módulo na tela inicial (três estados)
  function cartoes(raiz) {
    function a(cls, marca, sub) { return '<div class="in-atalho ' + cls + '">' + im('instrucoes') + '<b>Instruções</b><small>' + sub + '</small>' + (marca ? '<span class="marca">' + marca + '</span>' : '') + '</div>'; }
    raiz.innerHTML =
      '<figure>' + a('', '1', 'Esta semana: salvamento aquático. Falta ler.') + '<figcaption>Militar que ainda não leu a instrução da semana.</figcaption></figure>' +
      '<figure>' + a('', '', 'Esta semana: salvamento aquático. Você já leu.') + '<figcaption>Militar que já marcou a leitura.</figcaption></figure>' +
      '<figure>' + a('acao', '1', 'Registrar a instrução de hoje, 3/12.') + '<figcaption>Adjunto de dia, no dia do serviço dele. Some quando o registro é enviado.</figcaption></figure>';
  }

  window.Instrucoes = { montar: montar, cartoes: cartoes };
})();
