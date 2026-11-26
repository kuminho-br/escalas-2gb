/* Pesquisar militares, versão 2 (Manual de Identidade Visual). Dados fictícios: nomes de exemplo e matrículas 990xxx-x.
   A busca só sai no "Buscar", como no site; tirar um critério pelo x da etiqueta busca de novo na hora. */
(function () {
  'use strict';
  // quem aparece: posto, nome de guerra, nome completo, matrícula, lotação (caminho), equipe, jornada, voluntário JES; pode: a pessoa tem nível de acesso sobre ele
  var M = [
    ['SD', 'SOUZA', 'Ricardo Souza Lima', '990101-2', '2º GB / 1ª SB', 'ALFA', 'Pronto', true],
    ['CB', 'SILVA', 'José Carlos da Silva Souza', '990114-5', '2º GB / 1ª SB', 'ALFA', 'Pronto', true],
    ['3º SGT', 'LINS', 'Ana Paula Souza Lins', '990127-1', '2º GB / 1ª SB', 'BRAVO', 'Pronto', false],
    ['SD', 'FARIAS', 'Bruno Farias Neto', '990133-0', '2º GB / 1ª SB', 'BRAVO', 'Pronto', true],
    ['CB', 'QUEIROZ', 'Marcos Queiroz Alves', '990146-8', '2º GB / 1ª SB', 'CHARLIE', 'Pronto', true],
    ['1º SGT', 'TAVARES', 'Carla Tavares Moura', '990152-3', '2º GB / 1ª SB', null, 'ADM', false],
    ['SD', 'NUNES', 'Diego Nunes Ferraz', '990168-6', '2º GB / 2ª SB', 'ALFA', 'Pronto', true],
    ['CB', 'ARRUDA', 'Felipe Arruda Costa', '990171-4', '2º GB / 2ª SB', 'DELTA', 'Pronto', false],
    ['2º SGT', 'CAVALCANTI', 'Renata Cavalcanti Melo', '990185-9', '2º GB / 2ª SB', 'CHARLIE', 'Pronto', true],
    ['SD', 'ROCHA', 'Igor Rocha Sales', '990192-7', '2º GB / 3ª SB', 'BRAVO', 'Pronto', true],
    ['ST', 'PAIVA', 'Hélio Paiva Bastos', '990204-1', '2º GB / 3ª SB', null, 'ADM', false],
    ['1º TEN', 'BEZERRA', 'Lúcia Bezerra Souto', '990216-0', '2º GB', null, 'ADM', false],
    ['CB', 'MELO', 'Tiago Melo Araújo', '990223-2', '4º GB / 1ª SB', 'ALFA', 'Pronto', false, true],
    ['SD', 'SOUTO', 'Paulo Souza Souto', '990237-5', '4º GB / 2ª SB', 'BRAVO', 'Pronto', false, true]
  ].map(function (r, i) {
    return { id: 'm' + i, posto: r[0], guerra: r[1], completo: r[2], mat: r[3], lot: r[4], equipe: r[5], jornada: r[6], jes: r[7], fora: !!r[8] };
  });
  var ORDEM_POSTO = ['1º TEN', 'ST', '1º SGT', '2º SGT', '3º SGT', 'CB', 'SD'];
  var UNIDADES = ['Toda a corporação', '2º GB', '2º GB / 1ª SB', '2º GB / 2ª SB', '2º GB / 3ª SB', '4º GB'];
  var ARVORE = [['2º GB', ['2º GB / 1ª SB', '2º GB / 2ª SB', '2º GB / 3ª SB']], ['4º GB', ['4º GB / 1ª SB', '4º GB / 2ª SB']]];
  var ARQUIVO = ['990101-2', '990146-8', '990171-4', '990204-1', '990237-5', '990999-9'];
  var ABAS = [['texto', 'Nome e matrícula'], ['lotacao', 'Pela árvore'], ['arquivo', 'Arquivo de matrículas'], ['outros', 'Outros filtros']];
  var OUTROS = [
    ['posto', 'Posto ou graduação', ['Todos', 'SD', 'CB', '3º SGT', '2º SGT', '1º SGT', 'ST', '1º TEN']],
    ['quadro', 'Quadro', ['Todos', 'QBMG', 'QOBM']],
    ['jornada', 'Jornada', ['Todas', 'Pronto', 'ADM']],
    ['equipe', 'Equipe', ['Todas', 'ALFA', 'BRAVO', 'CHARLIE', 'DELTA']],
    ['situacao', 'Situação do militar', ['Todas', 'Ativa', 'Agregada']],
    ['funcao', 'Função', ['Todas', 'Motorista', 'Comandante de guarnição']],
    ['jes', 'Voluntário JES', ['Tanto faz', 'Sim', 'Não']],
    ['afastado', 'Afastado hoje', ['Tanto faz', 'Sim', 'Não']],
    ['incompleto', 'Cadastro incompleto', ['Tanto faz', 'Sim', 'Não']]
  ];
  var AGRUPAR = [['', 'Sem grupo'], ['unidade', 'Unidade'], ['equipe', 'Equipe'], ['posto', 'Posto']];

  function ic(n) { return '<svg class="i" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  function sem(t) { return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function vazio() { return { texto: '', unidade: '2º GB', onde: { mat: true, guerra: true, completo: false }, marcas: [], arquivo: null, outros: {}, cnh: [] }; }
  function curta(lot) { var p = lot.split(' / '); return p[p.length - 1]; }

  // os critérios que valem além do texto e de "Lotados em": cada um vira uma etiqueta e conta na marca do botão
  function emUso(c) {
    var l = [];
    if (c.onde.completo) l.push(['completo', 'Procura também no <b>nome completo</b>']);
    if (!c.onde.mat) l.push(['mat', 'Sem procurar na <b>matrícula</b>']);
    if (!c.onde.guerra) l.push(['guerra', 'Sem procurar no <b>nome de guerra</b>']);
    if (c.marcas.length) l.push(['marcas', 'Pela árvore: <b>' + c.marcas.map(curta).join(', ') + '</b>']);
    if (c.arquivo) l.push(['arquivo', 'Arquivo: <b>' + c.arquivo.length + ' matrículas</b>']);
    OUTROS.forEach(function (o) { if (c.outros[o[0]]) l.push(['o:' + o[0], o[1] + ': <b>' + c.outros[o[0]] + '</b>']); });
    if (c.cnh.length) l.push(['cnh', 'CNH: <b>' + c.cnh.join(', ') + '</b>']);
    return l;
  }
  function tirarCriterio(c, chave) {
    if (chave === 'completo') c.onde.completo = false;
    else if (chave === 'mat') c.onde.mat = true;
    else if (chave === 'guerra') c.onde.guerra = true;
    else if (chave === 'marcas') c.marcas = [];
    else if (chave === 'arquivo') c.arquivo = null;
    else if (chave === 'cnh') c.cnh = [];
    else delete c.outros[chave.slice(2)];
  }
  function busca(c) {
    var t = sem(c.texto.trim()), digitos = t.replace(/\D/g, '');
    var temOutro = emUso(c).some(function (x) { return x[0] !== 'completo' && x[0] !== 'mat' && x[0] !== 'guerra'; });
    if (t.length < 3 && c.unidade === 'Toda a corporação' && !temOutro) return null;
    return M.filter(function (m) {
      if (t.length >= 1) {
        var bate = (c.onde.mat && digitos.length >= 3 && m.mat.replace(/\D/g, '').indexOf(digitos) >= 0) || (c.onde.guerra && sem(m.guerra).indexOf(t) >= 0) || (c.onde.completo && sem(m.completo).indexOf(t) >= 0);
        if (!bate) return false;
      }
      if (c.marcas.length) { if (c.marcas.indexOf(m.lot) < 0) return false; }
      else if (c.unidade !== 'Toda a corporação' && m.lot !== c.unidade && m.lot.indexOf(c.unidade + ' / ') !== 0) return false;
      if (c.arquivo && c.arquivo.indexOf(m.mat) < 0) return false;
      var o = c.outros;
      if (o.posto && m.posto !== o.posto) return false;
      if (o.jornada && m.jornada !== o.jornada) return false;
      if (o.equipe && m.equipe !== o.equipe) return false;
      if (o.jes && (o.jes === 'Sim') !== m.jes) return false;
      return true;
    });
  }
  // o trecho que bateu, marcado (só no campo em que a busca procurou)
  function realce(txt, t, liga) {
    if (!liga || t.length < 3) return esc(txt);
    var i = sem(txt).indexOf(sem(t));
    return i < 0 ? esc(txt) : esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + t.length)) + '</mark>' + esc(txt.slice(i + t.length));
  }
  function chaveDoGrupo(m, por) { return por === 'unidade' ? m.lot : por === 'equipe' ? (m.equipe ? 'Equipe ' + m.equipe : 'Sem equipe') : m.posto; }
  function agrupar(lista, por) {
    if (!por) return [[null, lista]];
    var g = {}, ordem = [];
    lista.forEach(function (m) { var k = chaveDoGrupo(m, por); if (!g[k]) { g[k] = []; ordem.push(k); } g[k].push(m); });
    ordem.sort(function (a, b) {
      if (por === 'posto') return ORDEM_POSTO.indexOf(a) - ORDEM_POSTO.indexOf(b);
      if (a.indexOf('Sem') === 0) return 1; if (b.indexOf('Sem') === 0) return -1;
      return a.localeCompare(b, 'pt-BR');
    });
    return ordem.map(function (k) { return [k, g[k]]; });
  }
  function rotuloDoTexto(onde) {
    var p = [];
    if (onde.mat) p.push('matrícula'); if (onde.guerra) p.push('nome de guerra'); if (onde.completo) p.push('nome completo');
    if (!p.length) return 'Procurar (ligue um campo nos critérios)';
    var t = p.length === 1 ? p[0] : p.slice(0, -1).join(', ') + ' ou ' + p[p.length - 1];
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function montar(raiz, op) {
    var id = 'pq' + Math.random().toString(36).slice(2, 7);
    var s = {
      rascunho: vazio(), valendo: null, aberto: false, aba: 'texto', erro: '', folhaSel: false,
      sel: {}, ordemSel: [], agrupar: 'unidade'
    };
    s.rascunho.outros.jornada = 'Pronto';
    s.valendo = copia(s.rascunho);
    ['m0', 'm1', 'm4', 'm6', 'm8', 'm9'].forEach(function (k) { s.sel[k] = true; s.ordemSel.push(k); });

    function campoTexto(dentro) {
      return '<div class="campo pq-texto"><label for="' + id + '-t">' + rotuloDoTexto(s.rascunho.onde) + '</label>' +
        '<input type="search" id="' + id + '-t" data-texto autocomplete="off" value="' + esc(s.rascunho.texto) + '"' + (dentro ? '' : ' aria-describedby="' + id + '-e"') + '></div>';
    }
    function desenhar() {
      var dentro = op.campoDentro, n = emUso(s.valendo).length;
      raiz.innerHTML =
        '<div class="pq-cab"><h3>Pesquisar militares</h3><div class="pq-acoes">' +
          '<button type="button" class="botao secundario" title="Importar planilha">' + ic('enviar') + '<span>Importar</span></button>' +
          '<button type="button" class="botao secundario" title="Exportar para Excel">' + ic('planilha') + '<span>Exportar</span></button>' +
        '</div></div>' +
        '<form class="pq-busca' + (dentro ? ' so-botao' : '') + '" role="search" data-form>' +
          (dentro ? '' : campoTexto(false)) +
          '<div class="campo pq-onde"><label for="' + id + '-u">Lotados em</label><select class="pq-escolha" id="' + id + '-u" data-unidade' + (s.rascunho.marcas.length ? ' disabled' : '') + '>' +
            (s.rascunho.marcas.length ? '<option>Marcadas na árvore</option>' : UNIDADES.map(function (u) { return '<option' + (u === s.rascunho.unidade ? ' selected' : '') + '>' + u + '</option>'; }).join('')) +
          '</select></div>' +
          '<button type="button" class="botao secundario pq-crit-bt" data-abrir aria-expanded="' + s.aberto + '" aria-controls="' + id + '-c">' + ic('filtro') + 'Critérios de pesquisa' +
            (n ? '<span class="pq-conta"><span class="so-leitor">, </span>' + n + '<span class="so-leitor"> em uso</span></span>' : '') + '</button>' +
          '<button type="submit" class="botao principal">' + ic('busca') + 'Buscar</button>' +
        '</form>' +
        (s.erro ? '<p class="pq-erro" id="' + id + '-e" role="alert">' + s.erro + '</p>' : '') +
        ativos() +
        criterios() +
        '<div class="pq-corpo' + (op.nivel ? '' : ' sem-painel') + '"><section class="pq-res" aria-label="Militares encontrados">' + resultado() + '</section>' + (op.nivel ? painel() : '') + '</div>' +
        (op.nivel ? '<div class="pq-sel-barra"' + (s.ordemSel.length && !s.folhaSel ? '' : ' hidden') + '><b>' + s.ordemSel.length + ' selecionados</b><button type="button" class="botao" data-ver-sel>Ver</button></div>' : '');
      raiz.classList.toggle('com-folha', s.folhaSel || s.aberto && raiz.clientWidth <= 600);
    }
    function ativos() {
      var l = emUso(s.valendo);
      if (!l.length) return '';
      return '<div class="pq-ativos" role="group" aria-label="Critérios em uso"><span>Em uso:</span>' + l.map(function (x) {
        return '<span class="pq-chip">' + x[1] + '<button type="button" data-tirar="' + x[0] + '" aria-label="Tirar o critério">' + ic('x') + '</button></span>';
      }).join('') + (l.length > 1 ? '<button type="button" class="botao discreto" data-limpar>Limpar critérios</button>' : '') + '</div>';
    }
    function criterios() {
      var r = s.rascunho;
      var contas = { texto: (r.onde.completo ? 1 : 0) + (r.onde.mat ? 0 : 1) + (r.onde.guerra ? 0 : 1), lotacao: r.marcas.length ? 1 : 0, arquivo: r.arquivo ? 1 : 0, outros: Object.keys(r.outros).length + (r.cnh.length ? 1 : 0) };
      var corpo;
      if (s.aba === 'texto') {
        corpo = (op.campoDentro ? campoTexto(true) : '<p>O texto da barra de busca procura nestes campos.</p>') +
          '<fieldset class="pq-onde-texto"><legend class="so-leitor">Procurar em</legend>' +
          [['mat', 'Matrícula', ''], ['guerra', 'Nome de guerra', ''], ['completo', 'Nome completo', 'Vem desligado: com ele, um sobrenome comum traz muita gente.']].map(function (c) {
            return '<label class="marcar"><input type="checkbox" data-onde="' + c[0] + '"' + (r.onde[c[0]] ? ' checked' : '') + '><span>' + c[1] + (c[2] ? ' <small>' + c[2] + '</small>' : '') + '</span></label>';
          }).join('') + '</fieldset>';
      } else if (s.aba === 'lotacao') {
        corpo = '<p>Marque várias unidades. Com unidades marcadas, "Lotados em" fica de lado.</p><div class="pq-arvore">' + ARVORE.map(function (g) {
          var todos = g[1].every(function (u) { return r.marcas.indexOf(u) >= 0; });
          return '<label class="marcar"><input type="checkbox" data-grupo="' + g[0] + '"' + (todos ? ' checked' : '') + '><span>' + g[0] + '</span></label>' +
            g[1].map(function (u) { return '<label class="marcar filho"><input type="checkbox" data-marca="' + u + '"' + (r.marcas.indexOf(u) >= 0 ? ' checked' : '') + '><span>' + curta(u) + '</span></label>'; }).join('');
        }).join('') + '</div>';
      } else if (s.aba === 'arquivo') {
        corpo = '<div class="pq-arquivo">' + (r.arquivo
          ? '<b>' + r.arquivo.length + ' matrículas lidas</b><p>matriculas-alfa.xlsx</p><button type="button" class="botao discreto" data-arquivo="tirar">Tirar o arquivo</button>'
          : '<p>Uma planilha ou um texto com uma matrícula por linha. A busca traz só esses militares.</p><button type="button" class="botao secundario" data-arquivo="ler">' + ic('enviar') + 'Escolher arquivo</button>') + '</div>';
      } else {
        corpo = '<div class="pq-outros">' + OUTROS.map(function (o) {
          return '<div class="campo"><label for="' + id + '-' + o[0] + '">' + o[1] + '</label><select class="pq-escolha" id="' + id + '-' + o[0] + '" data-outro="' + o[0] + '">' +
            o[2].map(function (v, i) { return '<option value="' + (i ? v : '') + '"' + ((r.outros[o[0]] || '') === (i ? v : '') ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>';
        }).join('') + '<fieldset class="campo"><legend class="rot" style="font-size:var(--t13)">Categoria de CNH</legend><div class="pq-cnh">' + ['A', 'B', 'C', 'D', 'E'].map(function (c) {
          return '<label class="marcar"><input type="checkbox" data-cnh="' + c + '"' + (r.cnh.indexOf(c) >= 0 ? ' checked' : '') + '><span>' + c + '</span></label>';
        }).join('') + '</div></fieldset></div>';
      }
      return '<div class="pq-crit" id="' + id + '-c"' + (s.aberto ? '' : ' hidden') + ' role="region" aria-label="Critérios de pesquisa">' +
        '<div class="pq-crit-cab"><h4>Critérios de pesquisa</h4><button type="button" class="botao discreto so-icone pq-folha-fecha" data-fechar aria-label="Fechar">' + ic('x') + '</button></div>' +
        '<div class="pq-abas" role="tablist">' + ABAS.map(function (a) {
          return '<button type="button" role="tab" data-aba="' + a[0] + '" aria-selected="' + (s.aba === a[0]) + '">' + a[1] + (contas[a[0]] ? '<span class="pq-conta">' + contas[a[0]] + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="pq-aba" role="tabpanel">' + corpo + '</div>' +
        '<div class="pq-crit-pe"><button type="button" class="botao discreto" data-limpar-rascunho>Limpar critérios</button><button type="button" class="botao secundario" data-fechar>Fechar</button><button type="button" class="botao principal" data-buscar>' + ic('busca') + 'Buscar</button></div></div>';
    }
    function linha(m) {
      var t = s.valendo.texto.trim(), o = s.valendo.onde;
      return '<li>' + (op.nivel ? '<label class="marcar"><input type="checkbox" data-sel="' + m.id + '"' + (s.sel[m.id] ? ' checked' : '') + (m.fora ? ' disabled title="Você não tem nível de acesso sobre este militar."' : '') + ' aria-label="Selecionar ' + m.posto + ' ' + m.guerra + '"></label>' : '') +
        '<a class="pq-linha" href="#tela" onclick="return false"' + (op.nivel ? '' : ' style="padding-left:14px"') + '><span class="l1"><span class="posto">' + m.posto + '</span><span class="nome">' + realce(m.guerra, t, o.guerra) + '</span><span class="pq-lot">' + m.lot + '</span></span>' +
        '<span class="l2"><span>' + realce(m.completo, t, o.completo) + '</span><span>' + realce(m.mat, t, o.mat && t.replace(/\D/g, '').length >= 3) + '</span>' + (m.equipe || m.jornada ? '<span>' + [m.equipe ? 'Equipe ' + m.equipe : null, m.jornada].filter(Boolean).join(', ') + '</span>' : '') + '</span></a></li>';
    }
    function resultado() {
      var l = busca(s.valendo);
      if (!l) return '<p class="pq-dica">Busque pela matrícula ou pelo nome de guerra. Para ver quem está lotado numa unidade, escolha a unidade em "Lotados em".</p>';
      if (!l.length) return '<p class="pq-dica">Nenhum militar encontrado. Confira o texto e os critérios em uso.' + (!s.valendo.onde.completo && s.valendo.texto.trim().length >= 3 ? ' O nome completo está desligado nos critérios.' : '') + '</p>';
      var livres = l.filter(function (m) { return !m.fora && !s.sel[m.id]; }), fora = l.filter(function (m) { return m.fora; }).length;
      var topo = '<div class="pq-topo-lista">' + (op.nivel && livres.length ? '<button type="button" class="botao secundario" data-sel-todos>Selecionar estes ' + livres.length + '</button>' : '') +
        (op.nivel && fora ? '<span class="pq-fora">' + (fora === 1 ? '1 fica de fora: você não tem nível de acesso sobre ele.' : fora + ' ficam de fora: você não tem nível de acesso sobre eles.') + '</span>' : '') +
        '<span class="total">' + l.length + (l.length === 1 ? ' militar' : ' militares') + '</span></div>';
      var grupos = agrupar(l, op.agruparLista && op.nivel ? s.agrupar : '');
      return topo + grupos.map(function (g) {
        return '<div class="pq-grupo">' + (g[0] ? '<h4>' + g[0] + ' <small>' + g[1].length + '</small></h4>' : '') + '<ul class="pq-lista">' + g[1].map(linha).join('') + '</ul></div>';
      }).join('');
    }
    function painel() {
      var lista = s.ordemSel.map(function (k) { return M.filter(function (m) { return m.id === k; })[0]; });
      var grupos = agrupar(lista, s.agrupar), porUnidade = s.agrupar === 'unidade', abaixo = op.matAbaixo;
      function quem(m) {
        if (abaixo) return '<span class="pq-sel-quem"><span><span class="posto">' + m.posto + '</span> <b>' + m.guerra + '</b></span><span class="l2"><span>' + m.mat + '</span>' + (porUnidade ? '' : '<span>' + m.lot + '</span>') + '</span></span>';
        return '<span class="pq-sel-quem"><span class="mat">' + m.mat + '</span><span class="posto">' + m.posto + '</span><b>' + m.guerra + '</b>' + (porUnidade ? '' : '<span class="lot">' + curta(m.lot) + '</span>') + '</span>';
      }
      return '<aside class="pq-sel' + (abaixo ? ' mat-abaixo' : '') + (s.folhaSel ? ' aberta' : '') + '" aria-labelledby="' + id + '-s">' +
        '<div class="pq-sel-cab"><h4 id="' + id + '-s">Selecionados (' + lista.length + ')</h4>' + (lista.length ? '<button type="button" class="botao discreto" data-limpar-sel>Limpar</button>' : '') +
          '<button type="button" class="botao discreto so-icone pq-folha-fecha" data-fechar-sel aria-label="Fechar">' + ic('x') + '</button></div>' +
        '<label class="pq-sel-agrupar">Agrupar por <select class="pq-escolha" data-agrupar>' + AGRUPAR.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === s.agrupar ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select></label>' +
        (lista.length ? '<div class="pq-sel-lista">' + grupos.map(function (g) {
          return (g[0] ? '<h5>' + g[0] + ' <span>' + g[1].length + '</span></h5>' : '') + '<ul>' + g[1].map(function (m) {
            return '<li>' + quem(m) + '<button type="button" class="pq-sel-tirar" data-tirar-sel="' + m.id + '" aria-label="Tirar ' + m.posto + ' ' + m.guerra + '">' + ic('x') + '</button></li>';
          }).join('') + '</ul>';
        }).join('') + '</div>' : '<p class="pq-sel-vazio">Marque militares na lista para juntá-los aqui. A seleção fica mesmo quando você muda a busca.</p>') +
        '<div class="pq-sel-pe"><button type="button" class="botao principal"' + (lista.length ? '' : ' disabled') + '>Atualizar em lote</button></div></aside>';
    }
    function aplicar() {
      var inp = raiz.querySelector('[data-texto]');
      if (inp) s.rascunho.texto = inp.value;
      if (!busca(s.rascunho)) { s.erro = 'Digite pelo menos 3 letras ou escolha uma unidade.'; return redesenhar('[data-texto]'); }
      s.erro = ''; s.valendo = copia(s.rascunho); s.aberto = false;
      redesenhar('[data-abrir]');
    }
    function redesenhar(foco) {
      var inp = raiz.querySelector('[data-texto]');
      if (inp) s.rascunho.texto = inp.value;
      desenhar();
      if (foco) { var f = raiz.querySelector(foco); if (f) f.focus(); }
    }

    raiz.addEventListener('submit', function (e) { e.preventDefault(); aplicar(); });
    raiz.addEventListener('change', function (e) {
      var el = e.target, d = el.dataset, r = s.rascunho;
      if ('unidade' in d) r.unidade = el.value;
      else if (d.onde) { r.onde[d.onde] = el.checked; redesenhar('[data-onde="' + d.onde + '"]'); }
      else if (d.marca) { r.marcas = el.checked ? r.marcas.concat(d.marca) : r.marcas.filter(function (u) { return u !== d.marca; }); redesenhar('[data-marca="' + d.marca + '"]'); }
      else if (d.grupo) { var g = ARVORE.filter(function (x) { return x[0] === d.grupo; })[0][1]; r.marcas = r.marcas.filter(function (u) { return g.indexOf(u) < 0; }).concat(el.checked ? g : []); redesenhar('[data-grupo="' + d.grupo + '"]'); }
      else if (d.outro) { if (el.value) r.outros[d.outro] = el.value; else delete r.outros[d.outro]; redesenhar('[data-outro="' + d.outro + '"]'); }
      else if (d.cnh) { r.cnh = el.checked ? r.cnh.concat(d.cnh).sort() : r.cnh.filter(function (c) { return c !== d.cnh; }); redesenhar('[data-cnh="' + d.cnh + '"]'); }
      else if (d.sel) { if (el.checked) { s.sel[d.sel] = true; s.ordemSel.push(d.sel); } else { delete s.sel[d.sel]; s.ordemSel = s.ordemSel.filter(function (k) { return k !== d.sel; }); } redesenhar('[data-sel="' + d.sel + '"]'); }
      else if ('agrupar' in d) { s.agrupar = el.value; redesenhar('[data-agrupar]'); }
    });
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var d = b.dataset;
      if ('abrir' in d) { s.aberto = !s.aberto; if (s.aberto) { s.rascunho = copia(s.valendo); var inp = raiz.querySelector('[data-texto]'); if (inp) s.rascunho.texto = inp.value; raiz.scrollTop = 0; } redesenhar(s.aberto ? '[role="tab"][aria-selected="true"]' : '[data-abrir]'); }
      else if ('fechar' in d) { s.aberto = false; redesenhar('[data-abrir]'); }
      else if (d.aba) { s.aba = d.aba; redesenhar('[data-aba="' + d.aba + '"]'); }
      else if ('buscar' in d) aplicar();
      else if (d.tirar) { tirarCriterio(s.valendo, d.tirar); s.rascunho = copia(s.valendo); s.rascunho.texto = s.valendo.texto; redesenhar('[data-abrir]'); }
      else if ('limpar' in d) { var t = s.valendo.texto, u = s.valendo.unidade; s.valendo = vazio(); s.valendo.texto = t; s.valendo.unidade = u; s.rascunho = copia(s.valendo); redesenhar('[data-abrir]'); }
      else if ('limparRascunho' in d) { var t2 = s.rascunho.texto, u2 = s.rascunho.unidade; s.rascunho = vazio(); s.rascunho.texto = t2; s.rascunho.unidade = u2; redesenhar('[data-limpar-rascunho]'); }
      else if (d.arquivo) { s.rascunho.arquivo = d.arquivo === 'ler' ? ARQUIVO.slice() : null; redesenhar('[data-arquivo]'); }
      else if ('selTodos' in d) { busca(s.valendo).forEach(function (m) { if (!m.fora && !s.sel[m.id]) { s.sel[m.id] = true; s.ordemSel.push(m.id); } }); redesenhar(); }
      else if (d.tirarSel) { delete s.sel[d.tirarSel]; s.ordemSel = s.ordemSel.filter(function (k) { return k !== d.tirarSel; }); redesenhar(); }
      else if ('limparSel' in d) { s.sel = {}; s.ordemSel = []; redesenhar(); }
      else if ('verSel' in d) { s.folhaSel = true; raiz.scrollTop = 0; redesenhar('[data-fechar-sel]'); }
      else if ('fecharSel' in d) { s.folhaSel = false; redesenhar('[data-ver-sel]'); }
    });
    raiz.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && (s.aberto || s.folhaSel)) { var era = s.aberto; s.aberto = false; s.folhaSel = false; redesenhar(era ? '[data-abrir]' : '[data-ver-sel]'); }
    });
    desenhar();
    return { redesenhar: function () { redesenhar(); } };
  }
  window.Pesquisar = { montar: montar };
})();
