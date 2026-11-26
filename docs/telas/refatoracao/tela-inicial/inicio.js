// A tela inicial do Manual (versão 3), montada por script para a área "Tela inicial" e para a área "Entrada".
// window.TelaInicial.montar(raiz, opcoes) devolve as alças de que a animação do login precisa (o quadro, o título, os cartões).
(function () {
  'use strict';
  function ic(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function im(n) { return '<svg class="im" aria-hidden="true"><use href="#m-' + n + '"/></svg>'; }
  function placa(posto, nome, cor, eu) { return '<span class="placa parada' + (eu ? ' eu' : '') + '" style="--servico:' + cor + '"><span class="quem"><span class="posto">' + posto + '</span><span class="nome">' + nome + '</span></span>' + (eu ? '<span class="serv">você</span>' : '') + '</span>'; }

  // os próximos serviços do militar: dia da semana, dia do mês, nome do serviço e o horário do turno (decisão do usuário, 25/11/2026)
  var PROXIMOS = [
    { dia: 'qui', diaLongo: 'quinta', n: 26, servico: 'Pronto', cor: 'var(--pronto)', horario: '7h às 19h' },
    { dia: 'sáb', diaLongo: 'sábado', n: 28, servico: 'Pronto', cor: 'var(--pronto)', horario: '19h às 7h' },
    { dia: 'dom', diaLongo: 'domingo', n: 29, servico: 'JES', cor: 'var(--jes)', horario: '8h às 20h' },
    { dia: 'ter', diaLongo: 'terça', n: '1º', servico: 'Bioma', cor: 'var(--bioma)', horario: '8h às 16h' },
    { dia: 'qui', diaLongo: 'quinta', n: 3, servico: 'Pronto', cor: 'var(--pronto)', horario: '7h às 19h' }
  ];
  var AVISOS = [
    { titulo: 'ABT-014 em manutenção', texto: 'Até sexta, 28, a guarnição de ABT sai na ABT-009.', quem: '2º TEN MARQUES, 23/11', fixado: true },
    { titulo: 'Instrução de APH', texto: 'Sexta, 27, às 14h, no auditório. Para quem estiver de folga.', quem: '1º SGT FALCÃO, 22/11' },
    { titulo: 'Voluntariado de dezembro aberto', texto: 'O formulário fica aberto até domingo, 30.', quem: '2º TEN MARQUES, 20/11' }
  ];

  function cartao(s, i) {
    return '<li class="ini-cartao' + (i === 0 ? ' primeiro' : '') + '" style="--servico:' + s.cor + '" aria-label="' + s.diaLongo + ', ' + s.n + ', ' + s.servico + ', das ' + s.horario + '">' +
      '<span class="quando" aria-hidden="true"><small>' + s.dia + '</small><b>' + s.n + '</b></span>' +
      '<span class="nome" aria-hidden="true">' + s.servico + '</span><span class="hora" aria-hidden="true">' + s.horario + '</span></li>';
  }

  function painelDeAvisos() {
    return '<section class="ini-avisos" aria-label="Avisos" data-avisos>' +
      '<header><h2>Avisos</h2><span class="conta">' + AVISOS.length + ' da 1ª SB</span><span class="passar"><button type="button" data-passo="-1" aria-label="Aviso anterior">' + ic('esq') + '</button><button type="button" data-passo="1" aria-label="Próximo aviso">' + ic('dir') + '</button></span></header>' +
      '<div class="ini-aviso" aria-live="polite" data-aviso></div>' +
      '<div class="rodape"><span class="pontos" aria-hidden="true">' + AVISOS.map(function () { return '<i></i>'; }).join('') + '</span><button type="button" class="publicar" data-so="escalante">Publicar aviso</button></div>' +
    '</section>';
  }

  function tela(o) {
    var p = PROXIMOS[0];
    return '' +
      // o cabeçalho (versão 3, 25/11): a marca do sistema, a unidade como um botão de verdade e a pessoa com as iniciais
      '<header class="ini-topo">' +
        '<a class="topo-marca" href="#tela" aria-label="Ir para o início"><img src="' + o.img + 'brasao-2gb.png" alt=""><span class="sistema">Sistema de Gestão <span>- 2º GB</span></span></a>' +
        '<span class="divisa" aria-hidden="true"></span>' +
        '<nav class="ini-unidade" data-unidade aria-label="Unidade de trabalho"></nav>' +
        '<button type="button" class="quem"><span class="iniciais" aria-hidden="true">A</span><span class="nome"><b>CB ALMEIDA</b><small class="nivel">Escalante</small></span>' + ic('baixo') + '</button>' +
      '</header>' +
      '<div class="ini-capa" aria-hidden="true"></div>' +
      '<div class="ini-faixa" data-faixa>' +
        (o.chegada ? '<div class="ini-lampejo" data-lampejo aria-hidden="true"></div><div class="ini-risco" data-risco aria-hidden="true"></div>' : '') +
        '<div class="ini-alta">' +
          '<div class="ini-saudacao" data-saudacao><h1 data-titulo tabindex="-1">' + o.saudacao + ', CB ALMEIDA</h1><p>' + o.data + '</p></div>' +
          '<div class="ini-proximos"><small>Seus próximos serviços</small><ol>' + PROXIMOS.map(cartao).join('') + '</ol></div>' +
          painelDeAvisos() +
        '</div>' +
        '<div class="ini-curta" aria-hidden="true"><b>' + o.saudacao + ', CB ALMEIDA</b><span>Próximo serviço: ' + p.diaLongo + ', ' + p.n + ', ' + p.servico + ', ' + p.horario + '</span><span class="aviso-curto">' + ic('alerta') + AVISOS[0].titulo + '</span></div>' +
        (o.chegada ? '<canvas class="ini-brasas" data-brasas aria-hidden="true"></canvas>' : '') +
      '</div>' +
      '<div class="ini-rola" data-rola tabindex="0" aria-label="Tela inicial">' +
        '<div data-espaco></div>' +
        '<div class="ini-corpo">' +
          painelDeAvisos() +
          '<nav class="ini-atalhos" aria-label="Módulos">' +
            '<a href="#tela" data-so="escalante" data-cartao>' + im('grade') + '<b>Confecção de escalas</b><small>Escala Operacional de novembro</small></a>' +
            '<a href="#tela" data-cartao>' + im('peculio') + '<b>Pecúlio</b><small data-so="escalante">Contatos e cadastros da 1ª SB</small><small data-so="militar">Consulta de militares</small></a>' +
            '<a href="#tela" data-so="escalante" data-cartao>' + im('estrutura') + '<b>Estrutura</b><small>1ª SB e 4 seções</small></a>' +
            '<a href="#tela" data-cartao>' + im('ver') + '<b>Visualização de escalas</b><small>Sua escala e o seu voluntariado</small></a>' +
            '<a href="#tela" data-cartao>' + im('ficha') + '<b>Minha ficha</b><small>Seus dados e o seu telefone</small></a>' +
            '<a href="#tela" data-cartao>' + im('config') + '<b>Configurações</b><small>Suas preferências</small></a>' +
          '</nav>' +
          '<section class="ini-bloco" aria-labelledby="proximo" data-cartao><h2 id="proximo">Seu próximo serviço</h2>' +
            '<div class="ini-servico">' +
              '<div class="dia"><small>' + p.diaLongo + '</small><b>' + p.n + '</b><span>de novembro</span></div>' +
              '<p class="quando">' + p.servico + ', das ' + p.horario + '</p>' +
              '<p class="onde">Turno A, equipe Alfa. Na ABT, como motorista.</p>' +
              '<div class="junto">' + placa('2º SGT', 'RAMALHO', 'var(--pronto)') + placa('CB', 'ALMEIDA', 'var(--pronto)', true) + placa('SD', 'CORREIA', 'var(--pronto)') + '</div>' +
              '<div class="acoes"><a class="elo" href="#tela">Ver minha escala do mês</a></div>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';
  }

  /**
   * Monta a tela dentro de `raiz` (um .ini). opcoes: img (pasta das imagens, com a barra), saudacao, data, chegada (acrescenta as camadas
   * da animação do login). Devolve as alças: faixa, rola, titulo, saudacao, cartoes (o que entra em fila depois do pouso) e medir().
   */
  /*
   * A unidade em degraus (pedido do usuário, 25/11): um botão por nível da hierarquia, separados por ›. Cada degrau abre só as unidades
   * que ficam dentro do degrau anterior; escolhida uma, o próximo nível abre sozinho, até a folha (a SB). Proposta de mudança de
   * comportamento: hoje o site abre a árvore inteira numa caixa só (EscolherUnidade, 6.45).
   * Regras do mockup: só aparecem as unidades a que a pessoa tem acesso ou que levam a uma delas; um nível com uma opção só vira texto
   * (não há o que escolher); "passagem" é a unidade acima das da pessoa, que só serve para descer (não vira a unidade de trabalho).
   * Hierarquia de exemplo: o caminho CBMPE / DGO / DInter/1 / 2º GB / 1ª SB é o do sistema; as unidades vizinhas são fictícias.
   */
  var ARVORE = { sigla: 'CBMPE', nome: 'Corpo de Bombeiros Militar de Pernambuco', filhos: [
    { sigla: 'DGO', nome: 'Diretoria de Gestão Operacional', filhos: [
      { sigla: 'DInter/1', nome: 'Diretoria do Interior 1', filhos: [
        { sigla: '2º GB', nome: '2º Grupamento de Bombeiros', filhos: [
          { sigla: '1ª SB', nome: 'Caruaru', acesso: 'trabalho' },
          { sigla: '2ª SB', nome: 'Seção de exemplo', acesso: 'trabalho' },
          { sigla: '3ª SB', nome: 'Seção de exemplo', acesso: 'consulta' }
        ] },
        { sigla: '4º GB', nome: 'Grupamento de exemplo', acesso: 'consulta', filhos: [
          { sigla: '1ª SB', nome: 'Seção de exemplo' }, { sigla: '2ª SB', nome: 'Seção de exemplo' }
        ] }
      ] }
    ] }
  ] };
  var NOME_DO_NIVEL = ['corporação', 'diretoria', 'diretoria regional', 'grupamento', 'seção'];
  (function herdar(n, acesso) { n.acesso = n.acesso || acesso; (n.filhos || []).forEach(function (f) { herdar(f, n.acesso); }); })(ARVORE);
  function alcanca(n) { return !!n.acesso || (n.filhos || []).some(alcanca); }
  function filhosDe(n) { return (n.filhos || []).filter(alcanca); }
  function caminhoAte(siglas) { var n = ARVORE, c = [n]; siglas.slice(1).forEach(function (s) { n = filhosDe(n).filter(function (f) { return f.sigla === s; })[0]; c.push(n); }); return c; }

  function montarUnidade(raiz, nav) {
    var caminho = caminhoAte(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    var atual = caminho.slice();          // a unidade de trabalho de fato (o caminho pode estar a meio, numa passagem)
    var aberto = -1;                       // o degrau com a lista aberta
    var aviso = '';
    function opcoesDo(i) { return i === 0 ? [ARVORE] : filhosDe(caminho[i - 1]); }
    function desenhar() {
      var h = '<ol class="degraus">', ultimo = caminho[caminho.length - 1];
      caminho.forEach(function (n, i) {
        var ops = opcoesDo(i), folha = i === caminho.length - 1;
        h += '<li class="degrau' + (folha ? ' atual' : '') + '">' + (i ? '<span class="sep" aria-hidden="true">›</span>' : '');
        if (ops.length > 1) h += '<button type="button" data-degrau="' + i + '" aria-expanded="' + (aberto === i) + '" aria-haspopup="listbox"' + (folha ? ' aria-current="location"' : '') + '><span>' + n.sigla + '</span>' + ic('baixo') + '</button>';
        else h += '<span class="fixo"' + (folha ? ' aria-current="location"' : '') + '>' + n.sigla + '</span>';
        if (aberto === i) h += lista(i);
        h += '</li>';
      });
      // o próximo nível: tracejado, com o nome do nível; quando o degrau atual é passagem, ele é obrigatório
      if (filhosDe(ultimo).length) {
        var j = caminho.length, falta = !ultimo.acesso;
        h += '<li class="degrau"><span class="sep" aria-hidden="true">›</span><button type="button" class="proximo' + (falta ? ' falta' : '') + '" data-degrau="' + j + '" aria-expanded="' + (aberto === j) + '" aria-haspopup="listbox">' +
          (falta ? 'Escolha a ' + NOME_DO_NIVEL[j] : NOME_DO_NIVEL[j].charAt(0).toUpperCase() + NOME_DO_NIVEL[j].slice(1)) + ic('baixo') + '</button>' + (aberto === j ? lista(j) : '') + '</li>';
      }
      h += '</ol>';
      nav.innerHTML = h + '<p class="sr-only" role="status">' + aviso + '</p>';
      nav.classList.toggle('aberta', aberto >= 0);
      var foco = nav.querySelector('.lista button[aria-selected="true"]') || nav.querySelector('.lista button');
      if (foco && aberto >= 0) foco.focus();
    }
    function lista(i) {
      var de = i === 0 ? '' : caminho[i - 1].sigla;
      return '<div class="lista" role="listbox" aria-label="' + (de ? 'Unidades dentro de ' + de : 'Corporação') + '">' +
        (de ? '<p class="de">Dentro de ' + de + '</p>' : '') +
        opcoesDo(i).map(function (n, k) {
          var esc = caminho[i] === n, desce = filhosDe(n).length > 0;
          return '<button type="button" role="option" data-opcao="' + k + '" aria-selected="' + esc + '"><span class="txt"><b>' + n.sigla + '</b><small>' + n.nome + '</small></span>' +
            (n.acesso === 'consulta' ? '<span class="etq">Só consulta</span>' : '') + (esc ? ic('ok') : desce ? ic('dir') : '') + '</button>';
        }).join('') + '</div>';
    }
    nav.addEventListener('click', function (e) {
      var d = e.target.closest('[data-degrau]'), op = e.target.closest('[data-opcao]');
      if (op) {
        var n = opcoesDo(aberto)[Number(op.getAttribute('data-opcao'))];
        caminho = caminho.slice(0, aberto).concat(n);
        if (n.acesso) { atual = caminho.slice(); aviso = 'Unidade de trabalho: ' + atual.map(function (x) { return x.sigla; }).join(' / ') + (n.acesso === 'consulta' ? ', só consulta' : ''); }
        // escolheu e tem mais abaixo: o próximo nível abre sozinho, até a folha
        aberto = filhosDe(n).length ? caminho.length : -1;
        desenhar(); if (aberto < 0) focarUltimo(); return;
      }
      if (d) { var i = Number(d.getAttribute('data-degrau')); aberto = aberto === i ? -1 : i; desenhar(); if (aberto < 0) focarUltimo(); }
    });
    function fechar() {
      if (aberto < 0) return;
      // fechou no meio do caminho, numa passagem: volta à unidade de trabalho que valia
      if (!caminho[caminho.length - 1].acesso) caminho = atual.slice();
      aberto = -1; desenhar(); focarUltimo();
    }
    function focarUltimo() { var b = nav.querySelectorAll('.degrau [data-degrau]'); if (b.length) b[b.length - 1].focus(); }
    nav.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      var bs = Array.prototype.slice.call(nav.querySelectorAll('.lista button')), k = bs.indexOf(document.activeElement);
      if (k >= 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); bs[(k + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); }
    });
    raiz.addEventListener('click', function (e) { if (aberto >= 0 && e.target.isConnected && !nav.contains(e.target)) fechar(); });
    desenhar();
  }

  function montar(raiz, opcoes) {
    var o = opcoes || {};
    o.img = o.img || '../img/'; o.saudacao = o.saudacao || 'Bom dia'; o.data = o.data || 'Quarta-feira, 25 de novembro de 2026';
    raiz.innerHTML = tela(o);
    montarUnidade(raiz, raiz.querySelector('[data-unidade]'));
    var rola = raiz.querySelector('[data-rola]'), faixa = raiz.querySelector('[data-faixa]'), espaco = raiz.querySelector('[data-espaco]');
    var alto = 0, min = 0, margem = 0, quadro = 0, n = 0;
    function medir() {
      var cs = getComputedStyle(raiz), w = raiz.clientWidth;
      min = parseFloat(cs.getPropertyValue('--faixa-min')) || 64;
      margem = parseFloat(cs.getPropertyValue('--margem')) || 24;
      var dentro = w - 2 * margem;
      // computador: 3:1, até o teto (400 px; era 300 no site, subiu a pedido do usuário em 25/11); celular: a saudação e os cartões cabem em 250 px
      alto = Math.round(w <= 600 ? 250 : Math.min(window.TelaInicial.TETO || 1e9, dentro / 3));
      espaco.style.height = (alto + margem) + 'px';
      pintar();
      if (o.aoMedir) o.aoMedir();
    }
    function pintar() {
      quadro = 0;
      var s = rola.scrollTop, h = Math.max(min, alto - s), e = Math.min(1, s / Math.max(1, alto - min));
      raiz.style.setProperty('--alto', h + 'px');
      raiz.style.setProperty('--e', e.toFixed(3));
    }
    // os avisos passam só pelas setas, nunca sozinhos
    function mostrar() {
      var a = AVISOS[n];
      raiz.querySelectorAll('[data-aviso]').forEach(function (el) {
        el.innerHTML = (a.fixado ? '<small class="fixado">' + ic('alerta') + 'Fixado</small>' : '') + '<b>' + a.titulo + '</b><p>' + a.texto + '</p><small>' + a.quem + '</small>';
      });
      raiz.querySelectorAll('[data-avisos] .pontos').forEach(function (ps) { Array.prototype.forEach.call(ps.children, function (p, i) { p.className = i === n ? 'atual' : ''; }); });
    }
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('[data-passo]');
      if (b) { n = (n + Number(b.getAttribute('data-passo')) + AVISOS.length) % AVISOS.length; mostrar(); return; }
      var a = e.target.closest('a[href="#tela"]');
      if (a && o.chegada) e.preventDefault();
    });
    rola.addEventListener('scroll', function () { if (!quadro) quadro = requestAnimationFrame(pintar); }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(medir).observe(raiz);
    medir(); mostrar();
    return {
      faixa: faixa, rola: rola, titulo: raiz.querySelector('[data-titulo]'), saudacao: raiz.querySelector('[data-saudacao]'),
      cartoes: Array.prototype.slice.call(raiz.querySelectorAll('[data-cartao]')), medir: medir, proximos: PROXIMOS, avisos: AVISOS
    };
  }

  // TETO: altura máxima da cena no computador, em px (0 = sem teto, só a proporção 3:1)
  window.TelaInicial = { montar: montar, PROXIMOS: PROXIMOS, AVISOS: AVISOS, TETO: 400 };
})();
