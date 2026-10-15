/**
 * ABERTURA AUTOMÁTICA DO PAINEL "MOSTRAR ESCALA" AO EDITAR A ESCALA — RN-31 (B21).
 *
 * A escala (aba ESCALA DO MÊS) continua livre para edição; nada é travado. Quando o escalante muda uma
 * célula da grade e a mudança precisa ir para a tabela de alocações, o painel abre sozinho, já com a lista
 * de alterações pendentes e o botão Salvar. Assim nenhuma edição fica esquecida sem passar pela
 * sincronia e pela checagem de choques.
 *
 * MECANISMO: gatilho instalável "ao editar" (aoEditarEscala), criado por garantirGatilhoDeEdicao_() quando
 * o painel é aberto. Um gatilho simples (function onEdit) não pode abrir painel; o instalável pode.
 *   - fora da grade da escala (cabeçalho, MÊS/SEÇÃO, outras abas): não faz nada;
 *   - painel já aberto: não reabre. O painel avisa que está aberto com um "pulso" a cada 5 s (cache do
 *     documento, validade 15 s) e, ao notar que houve edição, atualiza sozinho a lista de pendentes;
 *   - painel fechado: só abre se a edição deixou algo a salvar (escala × cópia de referência).
 *
 * LIMITAÇÕES: o gatilho é de cada usuário (quem quiser a abertura automática abre o painel uma vez);
 * só dispara com edição feita à mão na planilha (não com alteração feita por script nem com inserir/apagar
 * linhas); depois de fechar o painel, edições dentro de ~15 s ainda contam como "painel aberto".
 */

const GATILHO_EDICAO_ = 'aoEditarEscala';
const CACHE_PULSO_ = 'PAINEL_ESCALA_PULSO';
const CACHE_EDICAO_ = 'ESCALA_ULTIMA_EDICAO';
const PULSO_VALIDADE_MS_ = 15000;

/** A edição atingiu a grade da escala (RN-31)? ed = { aba, linha, coluna, nLinhas, nColunas }; cfg = { aba, primeiraLinha, primeiraColuna }. */
function editouAGradeDaEscala_(ed, cfg) {
  if (!ed || ed.aba !== cfg.aba) return false;
  const ultimaLinha = ed.linha + Math.max(1, ed.nLinhas || 1) - 1;
  const ultimaColuna = ed.coluna + Math.max(1, ed.nColunas || 1) - 1;
  return ultimaLinha >= cfg.primeiraLinha && ultimaColuna >= cfg.primeiraColuna;
}

/** O painel está aberto? Ele manda um pulso a cada 5 s; passado o prazo, conta como fechado. */
function painelEscalaAberto_(agora, ultimoPulso, validadeMs) {
  const t = Number(ultimoPulso);
  return isFinite(t) && t > 0 && agora - t <= (validadeMs || PULSO_VALIDADE_MS_);
}

/** Gatilho instalável "ao editar". Nunca lança erro: uma falha aqui não pode atrapalhar a edição. */
function aoEditarEscala(e) {
  try {
    if (!e || !e.range) return;
    const aba = e.range.getSheet();
    const ed = { aba: aba.getName(), linha: e.range.getRow(), coluna: e.range.getColumn(), nLinhas: e.range.getNumRows(), nColunas: e.range.getNumColumns() };
    if (!editouAGradeDaEscala_(ed, { aba: CONFIG.ABA_MATRIZ, primeiraLinha: CONFIG.PRIMEIRA_LINHA, primeiraColuna: CONFIG.PRIMEIRA_COL_DIA })) return;

    const cache = CacheService.getDocumentCache();
    const agora = Date.now();
    cache.put(CACHE_EDICAO_, String(agora), 21600);                       // o painel aberto percebe isto no próximo pulso
    if (painelEscalaAberto_(agora, cache.get(CACHE_PULSO_))) return;     // já aberto: só atualiza a lista

    const ss = SpreadsheetApp.getActive();
    const escala = abaDaEscala_(ss, false);
    if (!escala || !temEdicaoPendente_(escala, ss.getSpreadsheetTimeZone())) return;                             // a célula voltou ao que era: nada a salvar
    abrirPainelMatriz();
  } catch (erro) {
    console.error('aoEditarEscala: ' + (erro && erro.message));
  }
}

/** A escala como está × a cópia de referência: sobrou alguma alteração a salvar? (sem referência, o painel pede para recarregar) */
function temEdicaoPendente_(aba, tz) {
  const rot = lerRotulos_(lerCatalogo_().pares).rot;
  const d = lerBase_(tz) ? edicoesNaoSalvas_(aba, [], tz, rot) : null;
  if (!d) return true;
  return d.cmp.total > 0 || d.orfas > 0;
}

/** Cria o gatilho se o usuário ainda não tem. Devolve { ativa, erro }. */
function garantirGatilhoDeEdicao_() {
  try {
    const existe = ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === GATILHO_EDICAO_ && t.getEventType() === ScriptApp.EventType.ON_EDIT;
    });
    if (!existe) ScriptApp.newTrigger(GATILHO_EDICAO_).forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
    return { ativa: true, erro: '' };
  } catch (erro) {
    return { ativa: false, erro: (erro && erro.message) || String(erro) };
  }
}

/** Chamado pela tela a cada 5 s: marca o painel como aberto e informa a última edição na escala. */
function painelPulso() {
  const cache = CacheService.getDocumentCache();
  cache.put(CACHE_PULSO_, String(Date.now()), 30);
  return { edicao: cache.get(CACHE_EDICAO_) || '' };
}

/** Chamado quando a tela fecha (melhor esforço): libera o "aberto" na hora. */
function painelFechando() {
  CacheService.getDocumentCache().remove(CACHE_PULSO_);
}
