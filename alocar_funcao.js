/**
 * ALOCAR EM FUNÇÃO — camada do Google Sheets (item do menu "Escalas - 2º GB").
 * Depende de nucleo.gs, matriz.gs, choques.gs (montarRotulos_, parDoRotulo_), guarnicao.gs
 * (funcoesPorServico_, funcaoExigeCnh_), guarnicao_painel.gs (lerModelosGuarnicao_,
 * aplicarGuarnicao_) e sincronia_painel.gs (nomesPorMatricula_, colunasAlocacoes_).
 * Tela: dialogo_funcao.html (crie como "HTML" com esse nome exato).
 *
 * B36 (RN-94, RN-96, RN-81): na escala geral, com a célula de um militar que JÁ tem serviço
 * alocado, o escalante diz ali mesmo qual função ele exerce.
 *
 * LIMITAÇÃO CONHECIDA (já esclarecida com o usuário): o menu do Apps Script é montado no onOpen e
 * não pode ser habilitado ou desabilitado conforme a célula selecionada. Por isso o item fica
 * sempre visível e a validação acontece no clique: fora de uma célula de militar com serviço
 * alocado, ele só mostra um aviso curto e não faz nada.
 *
 * A função é gravada na própria alocação (coluna FUNÇÃO da ALOCAÇÕES TABULADAS), pela chave em
 * vigor (matrícula | dia | serviço | turno) e pelo mesmo caminho de escrita da grade de guarnição
 * (aplicarGuarnicao_): não existe um segundo jeito de gravar função. A UNIDADE é relida e regravada
 * como está, então trocar a função aqui não apaga a unidade nem a alocação.
 */

const ALOC_FUNC_AVISO_ = 'Selecione a célula de um militar com serviço alocado, na escala do mês.';

/** Item do menu: valida a célula ativa e abre o diálogo. */
function alocarEmFuncao() {
  const ui = SpreadsheetApp.getUi();
  const ctx = alocarEmFuncaoContexto();
  if (!ctx.ok) { ui.alert('Alocar em Função', ctx.erro, ui.ButtonSet.OK); return; }
  const html = HtmlService.createHtmlOutputFromFile('dialogo_funcao').setWidth(400).setHeight(320);
  ui.showModalDialog(html, 'Alocar em Função');
}

/**
 * O que a célula ativa representa, para o diálogo.
 * { ok, erro, chave, militar, dia, servico, turno, rotulo, unidade, atual, funcoes: [{ funcao, unidade, exigeCnh }], avisos }
 */
function alocarEmFuncaoContexto() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const escala = abaDaEscala_(ss, false);
  const aba = ss.getActiveSheet();
  const nao = function (erro) { return { ok: false, erro: erro || ALOC_FUNC_AVISO_ }; };
  if (!escala || aba.getName() !== escala.getName()) return nao();

  const r = ss.getActiveRange();
  if (!r || r.getNumRows() !== 1 || r.getNumColumns() !== 1) return nao();
  const linha = r.getRow(), col = r.getColumn();
  if (linha < CONFIG.PRIMEIRA_LINHA || col < CONFIG.PRIMEIRA_COL_DIA) return nao();

  const mat = texto_(aba.getRange(linha, CONFIG.COL_MAT).getValue());
  const dia = diaComoTexto_(aba.getRange(CONFIG.LINHA_CABECALHO, col).getValue(), tz);
  const celula = texto_(r.getValue());
  if (!mat || !dia || !celula) return nao();

  const hor = lerHorarios_();
  const rot = montarRotulos_(hor.porChave, lerCatalogo_().pares);
  const p = parDoRotulo_(celula, rot);
  if (!p) return nao('A célula ("' + celula + '") não corresponde a nenhum serviço e horário da aba TURNOS.');

  const chave = chaveAloc_({ mat: mat, dia: dia, servico: p.servico, turno: p.turno });
  const alocs = lerAlocacoes_(tz).alocs.filter(function (a) { return chaveAloc_(a) === chave; });
  if (!alocs.length) {
    return nao('Esta célula ainda não está na tabela de alocações. Salve a escala no painel "Mostrar Escala" e tente de novo.');
  }

  // RN-94 / RN-96: as funções vêm do cadastro (ESCALAS + MODELOS DE GUARNIÇÃO), uma lista por serviço
  const mod = lerModelosGuarnicao_();
  const funcoes = funcoesPorServico_(mod, p.servico, p.turno);
  const avisos = [];
  if (mod.semAbas) avisos.push('As abas ESCALAS e MODELOS DE GUARNIÇÃO não existem: cadastre as funções do serviço no painel "Escalas de Serviço".');
  else if (!funcoes.length) avisos.push('O serviço "' + p.servico + '" não tem função cadastrada para o turno ' + p.turno + ' em MODELOS DE GUARNIÇÃO (RN-94). Cadastre as funções e tente de novo.');

  const nomes = nomesPorMatricula_();
  return {
    ok: true, erro: '',
    chave: chave,
    militar: nomes[mat] || ('matrícula ' + mat),
    mat: mat,
    dia: dia.slice(8) + '/' + dia.slice(5, 7) + '/' + dia.slice(0, 4),
    servico: p.servico, turno: p.turno,
    rotulo: rotuloDe_(rot, p.servico, p.turno),
    unidade: alocs[0].unidade || '',
    atual: alocs[0].funcao || '',
    funcoes: funcoes.map(function (f) { return { funcao: f.funcao, unidade: f.unidade, exigeCnh: f.exigeCnh }; }),
    avisos: avisos
  };
}

/**
 * Grava a função escolhida na alocação. funcao '' apaga só a função.
 * Mantém a UNIDADE que já está na linha (B36: trocar a função não apaga a unidade nem a alocação).
 */
function alocarEmFuncaoGravar(chave, funcao) {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone();
  const escolhida = texto_(funcao);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Outra pessoa está gravando agora. Tente de novo em instantes.');
  try {
    const alocs = lerAlocacoes_(tz).alocs.filter(function (a) { return chaveAloc_(a) === chave; });
    if (!alocs.length) throw new Error('Não achei mais essa alocação na tabela. Atualize a escala e tente de novo.');

    // mesma escrita da grade de guarnição: só a coluna FUNÇÃO das linhas dessa alocação
    const res = { inserir: [], remover: [], atualizar: alocs.map(function (a) { return { linhas: [a.linha], funcao: escolhida, unidade: a.unidade || '' }; }) };
    aplicarGuarnicao_(res, tz);
    SpreadsheetApp.flush();

    const depois = lerAlocacoes_(tz).alocs.filter(function (a) { return chaveAloc_(a) === chave; });
    if (!depois.length) throw new Error('A alocação desapareceu da tabela depois da gravação. Confira a aba ' + CONFIG.ABA_ALOCACOES + ' e avise a programação.');
    const gravou = depois.every(function (a) { return normalizar_(a.funcao) === normalizar_(escolhida); });
    if (!gravou) throw new Error('A função não foi gravada (a aba ' + CONFIG.ABA_ALOCACOES + ' pode estar protegida ou filtrada).');
    const perdeuUnidade = depois.some(function (a, i) { return (alocs[i] ? (alocs[i].unidade || '') : '') !== (a.unidade || ''); });
    return {
      funcao: escolhida,
      unidade: depois[0].unidade || '',
      perdeuUnidade: perdeuUnidade,
      mensagem: escolhida ? ('Função gravada: ' + escolhida + '.') : 'Função apagada (a alocação continua).'
    };
  } finally {
    lock.releaseLock();
  }
}
