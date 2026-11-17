/**
 * ATUALIZAR ESTRUTURA — P19 item 4 (B69; RN-93).
 *
 * Um ponto só para levar a planilha à estrutura atual (abas, colunas, nomes, formatos), em vez de
 * botões espalhados pelos painéis. Menu: Escalas - 2º GB > Atualizar estrutura.
 *
 * MIGRACOES_ é uma lista de passos. Cada passo:
 *   id        : identificador estável (aparece no relatório)
 *   descricao : o que o passo faz, em português
 *   precisa   : function (ss) -> true se a planilha ainda não está na estrutura atual nesse ponto.
 *               Pode devolver { aviso: 'texto' } quando há algo que o código NÃO resolve sozinho
 *               (ex.: coluna antiga ainda preenchida): o passo aparece como "atenção", sem mexer em nada.
 *   aplica    : function (ss) -> texto curto do que foi feito
 * Cada entrega futura que mude a estrutura só acrescenta um passo no fim da lista.
 *
 * Regras de todos os passos (aprendidas no B57, B60 e na P17):
 *   - idempotente: rodar de novo não muda nada e o passo aparece como "já estava no formato atual";
 *   - aba-Tabela do Sheets: insertColumnAfter antes de criar coluna, try-catch ao apagar, flush() depois;
 *   - nenhuma fórmula montada em texto;
 *   - quem reestrutura uma aba guarda a antiga inteira antes (como a conversão de GUARNIÇÕES POR ESCALA);
 *   - cada passo isolado em try-catch: um erro não impede os outros e aparece com a mensagem exata.
 */

/**
 * A aba pelo nome novo ou por um nome antigo (ABAS_NOMES_ANTIGOS_), SEM renomear. Os "precisa" usam esta, e
 * não abaAtual_ (que renomeia): olhar a planilha antes da confirmação não pode mudar nada nela.
 */
function abaSemRenomear_(ss, nome) {
  const aba = ss.getSheetByName(nome);
  if (aba) return aba;
  const antigos = ABAS_NOMES_ANTIGOS_[nome] || [];
  for (let i = 0; i < antigos.length; i++) { const a = ss.getSheetByName(antigos[i]); if (a) return a; }
  return null;
}

/** Os nomes da linha 1 da aba, normalizados (sem acento/caixa/pontuação). [] se a aba não existe ou está vazia. */
function cabecalhoDaAba_(aba) {
  if (!aba) return [];
  const n = aba.getLastColumn();
  if (n < 1) return [];
  return aba.getRange(1, 1, 1, n).getValues()[0].map(normalizar_);
}

/** true se a aba existe e não tem a coluna (comparação pelo começo do nome normalizado, como coluna_). */
function faltaColuna_(aba, rotulo) {
  if (!aba) return false;
  const alvo = normalizar_(rotulo);
  return !cabecalhoDaAba_(aba).some(function (c) { return c === alvo || c.indexOf(alvo) === 0; });
}

const MIGRACOES_ = [
  {
    id: 'renomear-abas', descricao: 'Renomear as abas que ainda têm nome antigo (B52, B58)',
    precisa: function (ss) { return planoDeMigracaoDeAbas_(ss.getSheets().map(function (s) { return s.getName(); })).renomear.length > 0; },
    aplica: function (ss) {
      const plano = planoDeMigracaoDeAbas_(ss.getSheets().map(function (s) { return s.getName(); }));
      migrarAbas_();
      return plano.renomear.map(function (r) { return r.de + ' → ' + r.para; }).join('; ');
    }
  },
  {
    id: 'aba-guarnicoes', descricao: 'Criar a aba GUARNIÇÕES (cadastro das guarnições, B37/B58)',
    precisa: function (ss) { return !abaSemRenomear_(ss, CADG_ABA); },
    aplica: function () { cadgGarantirAba_(); return 'aba GUARNIÇÕES criada, com exemplo'; }
  },
  {
    id: 'guarnicoes-coluna-guarnicao', descricao: 'Criar a coluna GUARNIÇÃO no cadastro antigo, de viaturas (B37)',
    precisa: function (ss) {
      const aba = abaSemRenomear_(ss, CADG_ABA), cab = cabecalhoDaAba_(aba);
      return !!aba && cab.indexOf(normalizar_('GUARNIÇÃO')) < 0 && cab.indexOf(normalizar_('VIATURA')) >= 0;
    },
    aplica: function () { const r = cadgMigrarParaGuarnicoes_(); return 'coluna GUARNIÇÃO criada antes de VIATURA (' + r.linhas + ' nome(s) copiado(s))'; }
  },
  {
    id: 'guarnicoes-sem-tipos-de-servico', descricao: 'Tirar a coluna TIPOS DE SERVIÇO de GUARNIÇÕES (B58 item 1)',
    precisa: function (ss) {
      const aba = abaSemRenomear_(ss, CADG_ABA), cab = cabecalhoDaAba_(aba);
      const i = cab.indexOf(normalizar_(CADG_COLUNA_RETIRADA_));
      if (i < 0) return false;
      const n = aba.getLastRow() - 1;
      const cheia = n > 0 && aba.getRange(2, i + 1, n, 1).getDisplayValues().some(function (r) { return String(r[0]).trim() !== ''; });
      return cheia ? { aviso: 'a coluna TIPOS DE SERVIÇO de GUARNIÇÕES está preenchida e não é mais lida; confira e apague à mão' } : true;
    },
    aplica: function () { cadgRetirarTiposDeServico_(); return 'coluna TIPOS DE SERVIÇO (vazia) apagada de GUARNIÇÕES'; }
  },
  {
    id: 'aba-escalas', descricao: 'Criar a aba ESCALAS (B58, RN-100)',
    precisa: function (ss) { return !ss.getSheetByName(GUARN_ABA.ESCALAS); },
    aplica: function () { guarnGarantirAbaEscalas_(); return 'aba ESCALAS criada, com exemplo'; }
  },
  {
    id: 'aba-vinculos', descricao: 'Criar a aba GUARNIÇÕES POR ESCALA (B58, RN-09)',
    precisa: function (ss) { return !abaSemRenomear_(ss, GUARN_ABA.VINCULOS); },
    aplica: function () { guarnGarantirAbaVinculos_(); return 'aba GUARNIÇÕES POR ESCALA criada, com exemplo'; }
  },
  {
    id: 'vinculos-formato-novo', descricao: 'Converter GUARNIÇÕES POR ESCALA para o formato novo (B58 itens 2 e 3)',
    precisa: function (ss) { return faltaColuna_(abaSemRenomear_(ss, GUARN_ABA.VINCULOS), 'GUARNIÇÃO'); },
    aplica: function () {
      const r = converterVinculos_(null);         // a confirmação é a do menu, uma só para tudo
      if (!r.convertida) throw new Error(r.motivo || 'a conversão não foi feita');
      return r.vinculos + ' vínculo(s) criado(s); a aba antiga ficou guardada como "' + r.antiga + '"' +
        (r.semUnidade ? '; ' + r.semUnidade + ' linha(s) sem UNIDADE ficaram sem vínculo (vincule à mão)' : '');
    }
  },
  {
    id: 'alocacoes-unidade', descricao: 'Criar a coluna UNIDADE em ALOCAÇÕES (guarda a guarnição do posto, B58)',
    precisa: function (ss) { return faltaColuna_(abaSemRenomear_(ss, CONFIG.ABA_ALOCACOES), 'UNIDADE'); },
    aplica: function () { garantirColunaUnidadeAlocacoes_(); return 'coluna UNIDADE criada em ALOCAÇÕES'; }
  },
  {
    id: 'turnos-origem', descricao: 'Criar a coluna ORIGEM em TURNOS (B49 item 2, RN-13)',
    precisa: function (ss) { return faltaColuna_(abaSemRenomear_(ss, CONFIG.ABA_TURNOS), 'ORIGEM'); },
    aplica: function () { garantirColunaOrigem_(); return 'coluna ORIGEM criada em TURNOS (o JES já vem como PJES)'; }
  },
  {
    id: 'militares-cnh', descricao: 'Criar a coluna CNH em MILITARES (B37, RN-12)',
    precisa: function (ss) { return faltaColuna_(abaSemRenomear_(ss, CONFIG.ABA_MILITARES), 'CNH'); },
    aplica: function () { garantirColunaCnh_(); return 'coluna CNH criada em MILITARES (vazia: preencha as categorias)'; }
  },
  {
    id: 'militares-voluntario-jes', descricao: 'Criar a coluna VOLUNTÁRIO JES em MILITARES (RN-46)',
    precisa: function (ss) { return faltaColuna_(abaSemRenomear_(ss, CONFIG.ABA_MILITARES), 'VOLUNTÁRIO JES'); },
    aplica: function () { garantirColunaVoluntarioJes_(); return 'coluna VOLUNTÁRIO JES criada em MILITARES (vazia: preencha sim/não)'; }
  },
  {
    id: 'aba-cotas', descricao: 'Criar a aba COTAS (RN-33)',
    precisa: function (ss) { return !ss.getSheetByName(COTAS_ABA.COTAS); },
    aplica: function () { cotasGarantirAba_(COTAS_ABA.COTAS); return 'aba COTAS criada, com exemplo'; }
  },
  {
    id: 'aba-voluntariado', descricao: 'Criar a aba VOLUNTARIADO (RN-40, RN-41)',
    precisa: function (ss) { return !ss.getSheetByName(COTAS_ABA.VOLUNTARIADO); },
    aplica: function () { cotasGarantirAba_(COTAS_ABA.VOLUNTARIADO); return 'aba VOLUNTARIADO criada, com exemplo'; }
  },
  {
    id: 'aba-configuracoes', descricao: 'Criar a aba CONFIGURAÇÕES (parâmetros, com os valores-base)',
    precisa: function (ss) { return !ss.getSheetByName(PARAM_ABA); },
    aplica: function () { paramGarantirAba_(); return 'aba CONFIGURAÇÕES criada, com os valores-base'; }
  }
];

/**
 * Roda os passos, cada um isolado. migracoes: a lista (padrão MIGRACOES_); so: opcional, só olha (não aplica).
 * Retorna { passos: [{ id, descricao, estado: 'feito'|'atual'|'atencao'|'erro', resultado, erro }], feitos, erros, pendentes }.
 */
function atualizarEstrutura_(migracoes, so) {
  const ss = SpreadsheetApp.getActive();
  const passos = [];
  (migracoes || MIGRACOES_).forEach(function (m) {
    const p = { id: m.id, descricao: m.descricao, estado: '', resultado: '', erro: '' };
    try {
      const precisa = m.precisa(ss);
      if (!precisa) p.estado = 'atual';
      else if (precisa.aviso) { p.estado = 'atencao'; p.resultado = precisa.aviso; }
      else if (so === 'so-olhar') p.estado = 'pendente';
      else {
        p.resultado = m.aplica(ss) || '';
        SpreadsheetApp.flush();
        p.estado = 'feito';
      }
    } catch (e) {
      p.estado = 'erro';
      p.erro = (e && e.message) ? e.message : String(e);
    }
    passos.push(p);
  });
  const conta = function (est) { return passos.filter(function (p) { return p.estado === est; }).length; };
  return { passos: passos, feitos: conta('feito'), erros: conta('erro'), pendentes: conta('pendente'), atencao: conta('atencao') };
}

/** O texto do relatório, um passo por linha. */
function textoDaEstrutura_(rel) {
  const marca = { feito: '✔ feito', atual: '· já estava no formato atual', atencao: '! atenção', erro: '✖ ERRO', pendente: '→ a fazer' };
  return rel.passos.map(function (p) {
    let t = marca[p.estado] + ' — ' + p.descricao;
    if (p.resultado) t += ': ' + p.resultado;
    if (p.erro) t += ': ' + p.erro;
    return t;
  }).join('\n');
}

/** Menu: Escalas - 2º GB > Atualizar estrutura. Mostra o que falta, pede UMA confirmação, aplica e relata. */
function atualizarEstrutura() {
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) { ui.alert('Atualizar estrutura', 'Outra pessoa está gravando agora. Tente de novo em instantes.', ui.ButtonSet.OK); return; }
  try {
    const antes = atualizarEstrutura_(MIGRACOES_, 'so-olhar');
    if (!antes.pendentes && !antes.erros) {
      ui.alert('Atualizar estrutura', 'Nada a fazer: a planilha já está na estrutura atual.' +
        (antes.atencao ? '\n\n' + textoDaEstrutura_({ passos: antes.passos.filter(function (p) { return p.estado === 'atencao'; }) }) : ''), ui.ButtonSet.OK);
      return;
    }
    const resp = ui.alert('Atualizar estrutura',
      'Estes passos vão ser feitos (nada é apagado com dado dentro; a aba que muda de formato fica guardada inteira):\n\n' +
      textoDaEstrutura_({ passos: antes.passos.filter(function (p) { return p.estado !== 'atual'; }) }) + '\n\nContinuar?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    const rel = atualizarEstrutura_(MIGRACOES_);
    ui.alert('Atualizar estrutura', (rel.erros ? rel.erros + ' passo(s) com erro; os outros foram feitos.\n\n' : 'Pronto.\n\n') + textoDaEstrutura_(rel), ui.ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}
