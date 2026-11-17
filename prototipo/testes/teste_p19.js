// Testes da P19 (limpeza do B40, front da aba ESCALA, CNH hierárquica, "Atualizar estrutura").
// Uso: node testes/teste_p19.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(dir, f), 'utf8');

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 600) : '')); } };
const codigo = () => fs.readdirSync(dir).filter(f => /\.(js|html)$/.test(f)).map(f => [f, ler(f)]);

console.log('== P19 item 1 (B70) a visualização "ESCALA DO ORDINÁRIO" (B40) saiu');
{
  ver('os arquivos escala_op.js e escala_op_painel.js não existem mais', !fs.existsSync(path.join(dir, 'escala_op.js')) && !fs.existsSync(path.join(dir, 'escala_op_painel.js')));
  const restos = codigo().filter(([f, s]) => /painelEscalaOperacional|montarEscalaOperacional_|ESCALA_OP_ABA|btnOperacional/.test(s)).map(x => x[0]);
  ver('nenhuma referência a painelEscalaOperacional, montarEscalaOperacional_, ESCALA_OP_ABA ou ao botão', restos.length === 0, restos);
  const N = new Function(ler('nucleo.js') + '\nreturn {planoDeMigracaoDeAbas_, ABAS_NOMES_ANTIGOS_, origemDoServico_};')();
  ver('o código não cria nem renomeia mais a ESCALA DO ORDINÁRIO', !('ESCALA DO ORDINÁRIO' in N.ABAS_NOMES_ANTIGOS_) &&
    N.planoDeMigracaoDeAbas_(['ESCALA OPERACIONAL']).renomear.length === 0);
  ver('a origem dos serviços continua (a impressão usa: PRONTO, SALDO, PJES)',
    N.origemDoServico_('JES', { JES: 'PJES' }) === 'PJES' && N.origemDoServico_('Pronto', {}) === 'PRONTO' && N.origemDoServico_('Saldo', {}) === 'SALDO');
  ver('lerOrigens_ (coluna ORIGEM de TURNOS) continua no código', /function lerOrigens_/.test(ler('choques_painel.js')));
}

console.log('== P19 item 2 (B68; RN-02, RN-81) o front da aba ESCALA');
{
  const G = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'cadastro_guarnicoes.js', 'guarnicao.js'].map(ler).join('\n') +
    '\nreturn {desenhoDaEscala_, layoutSemFuncao_, compararAntiguidade_, montarGrade_};')();
  // dois dias (03/11 terça e 07/11 sábado), dois turnos, duas guarnições no turno A
  const L = (dia, turno, unidade, funcao) => ({ dia: '2026-11-' + dia, turno, unidade, funcao, k: 1, mat: '', servico: '' });
  const linhas = [
    L('03', 'A', 'ABT', 'CHEFE'), L('03', 'A', 'ABT', 'MOTORISTA'), L('03', 'A', 'AR', 'CHEFE'), L('03', 'B', 'ABT', 'CHEFE'),
    L('07', 'A', 'ABT', 'CHEFE'), L('07', 'A', 'AR', 'CHEFE'), L('07', 'B', 'ABT', 'CHEFE')
  ];
  const d = G.desenhoDaEscala_(linhas);
  ver('2.2: linha de dia na 1ª linha de cada dia', d.inicioDia.join() === '0,4', d.inicioDia);
  ver('2.1: tracejado na 1ª linha de cada turno que não é a 1ª do dia', d.inicioTurno.join() === '3,6', d.inicioTurno);
  ver('2.1: trocar de guarnição dentro do turno não é troca de turno', d.inicioTurno.indexOf(2) < 0 && d.inicioTurno.indexOf(5) < 0);
  ver('2.3: dias alternados — o 1º sem fundo, o 2º com fundo', JSON.stringify(d.diasComFundo) === '[{"de":4,"ate":6}]', d.diasComFundo);
  ver('2.3: o sábado continua identificado (para a coluna DIA)', JSON.stringify(d.fimDeSemana) === '[{"de":4,"ate":6}]', d.fimDeSemana);
  ver('grade vazia não quebra', G.desenhoDaEscala_([]).inicioDia.length === 0);

  // 2.4 e 2.5: a lista "sem função"
  const mil = {
    '1': { mat: '1', posto: 'SD BM', nome: 'ANA', antig: '', ordem: 0 }, '2': { mat: '2', posto: 'ST BM', nome: 'BIA', antig: '', ordem: 1 },
    '3': { mat: '3', posto: '3º SGT BM', nome: 'CAIO', antig: '', ordem: 2 }, '4': { mat: '4', posto: 'CB BM', nome: 'DANI', antig: '', ordem: 3 }
  };
  const sf = {
    '2026-11-03|A|ABT': [{ mat: '1', funcao: '', unidade: 'ABT' }, { mat: '2', funcao: 'COZINHEIRO', unidade: 'ABT' }],
    '2026-11-03|A|AR': [{ mat: '3', funcao: '', unidade: 'AR' }],
    '2026-11-03|A|': [{ mat: '4', funcao: '', unidade: '' }, { mat: '9', funcao: '', unidade: '' }],
    '2026-11-07|B|UTS': [{ mat: '1', funcao: '', unidade: 'UTS' }]
  };
  const lay = G.layoutSemFuncao_(linhas, sf, mil);
  const t = lay.textos;
  // dia 03 turno A: 3 linhas (ABT, ABT, AR). Lista do ABT: BIA, ANA (2 células, a partir da linha do ABT);
  // a do AR começaria na linha do AR (índice 2), que está livre: CAIO; depois os sem guarnição: DANI e (9)
  // -> não cabem nas 3 linhas do turno: entram 2 linhas extras no fim do turno A do dia 03
  ver('2.4: UM militar por célula, com graduação, nome e matrícula, do mais antigo ao mais moderno (ST antes de SD)',
    t[0] === 'ST BM BIA (2) (COZINHEIRO fora do modelo)' && t[1] === 'SD BM ANA (1)', t.slice(0, 6));
  ver('2.4: função fora do modelo continua avisada', /\(COZINHEIRO fora do modelo\)/.test(t[0]));
  ver('2.5: a lista do AR começa na linha do bloco do AR, dentro do turno', lay.linhas[2].unidade === 'AR' && t[2] === '3º SGT BM CAIO (3)', t.slice(0, 6));
  ver('2.5: quem não tem guarnição vem depois das listas das guarnições, marcado "— sem guarnição"',
    t[3] === 'CB BM DANI (4) — sem guarnição' && t[4] === '(9) — sem guarnição', t.slice(0, 6));
  ver('lista maior que o turno: entram linhas EXTRAS no fim do turno (sem FUNÇÃO, para o salvar ignorar)',
    lay.linhas.length === linhas.length + 2 && lay.linhas[3].extra && lay.linhas[4].extra && lay.linhas[3].funcao === '' &&
    lay.linhas[3].dia === '2026-11-03' && lay.linhas[3].turno === 'A' && lay.linhas[5] === linhas[3], lay.linhas.map(l => (l.extra ? 'EXTRA ' : '') + l.dia.slice(8) + l.turno + l.unidade));
  ver('as linhas de posto continuam todas, na mesma ordem', lay.linhas.filter(l => !l.extra).every((l, k) => l === linhas[k]));
  const iUTS = lay.linhas.indexOf(linhas[6]);
  ver('2.5: guarnição que não está naquele turno vai para o fim do turno, com o nome dela', t[iUTS] === 'SD BM ANA (1) — guarnição "UTS" fora deste turno', t[iUTS]);
  ver('turno sem ninguém sem função: células vazias e nenhuma linha extra', lay.linhas.slice(5, 9).every((l, k) => !l.extra) && t[5] === '' && t[6] === '' && t[7] === '', t.slice(5));
  // lista que cabe: não cria linha
  const cabe = G.layoutSemFuncao_(linhas.slice(0, 3), { '2026-11-03|A|AR': [{ mat: '3', funcao: '', unidade: 'AR' }] }, mil);
  ver('lista que cabe no turno não cria linha extra', cabe.linhas.length === 3 && cabe.textos.join('|') === '||3º SGT BM CAIO (3)', cabe.textos);
  ver('antiguidade: mesmo posto, a ANTIG. desempata; depois o cadastro; fora do cadastro vai por último',
    [{ mat: 'x', m: { posto: 'SD', antig: '', ordem: 1 } }, { mat: 'z' }, { mat: 'y', m: { posto: 'SD', antig: 3, ordem: 9 } }, { mat: 'w', m: { posto: 'SD', antig: '', ordem: 0 } }]
      .sort(G.compararAntiguidade_).map(x => x.mat).join() === 'y,w,x,z');

  // montarGrade_ guarda a UNIDADE da alocação e separa por turno × guarnição
  const esc = { nome: 'Ordinário', servicos: ['Pronto'], turnos: ['A'], slots: { A: [{ unidade: 'ABT', funcao: 'CHEFE', vagas: 1 }] }, militares: 'ESCALADOS' };
  const al = [
    { mat: '1', dia: '2026-11-03', turno: 'A', servico: 'Pronto', funcao: 'CHEFE', unidade: 'ABT', linha: 2 },
    { mat: '2', dia: '2026-11-03', turno: 'A', servico: 'Pronto', funcao: '', unidade: 'ABT', linha: 3 },
    { mat: '3', dia: '2026-11-03', turno: 'A', servico: 'Pronto', funcao: '', unidade: '', linha: 4 }
  ];
  const gr = G.montarGrade_(esc, '2026-11', al);
  ver('montarGrade_: semFuncao por "dia|turno|unidade", com a unidade', JSON.stringify(gr.semFuncao) ===
    '{"2026-11-03|A|ABT":[{"mat":"2","funcao":"","unidade":"ABT"}],"2026-11-03|A|":[{"mat":"3","funcao":"","unidade":""}]}', gr.semFuncao);
  ver('montarGrade_: a contagem de escalados sem função continua por militar', gr.escaladosSemFuncao === 2);
}

console.log('== P19 item 2 (B68) a aba ESCALA desenhada (planilha que registra a formatação)');
{
  const log = [], valores = {};
  let regrasCF = [];
  const a1 = (r, c, nr, nc) => r + ',' + c + (nr > 1 || nc > 1 ? ':' + (r + (nr || 1) - 1) + ',' + (c + (nc || 1) - 1) : '');
  const faixa = (r, c, nr, nc) => {
    nr = nr || 1; nc = nc || 1;
    const nome = a1(r, c, nr, nc);
    const R = {
      setValues(m) { m.forEach((l, i) => l.forEach((v, j) => { valores[(r + i) + ',' + (c + j)] = v; })); return P; },
      setValue(v) { valores[r + ',' + c] = v; return P; }, getA1Notation: () => nome
    };
    const P = new Proxy(R, { get(t, k) { if (k in t) return t[k]; return (...a) => { log.push([k, nome, ...a]); return P; }; } });
    return P;
  };
  const aba = new Proxy({ getRange: faixa, getMaxRows: () => 500, getMaxColumns: () => 9, setConditionalFormatRules(x) { regrasCF = x; } },
    { get(t, k) { if (k in t) return t[k]; return () => aba; } });
  const lista = new Proxy({ getRange: faixa, getMaxRows: () => 500 }, { get(t, k) { if (k in t) return t[k]; return () => lista; } });
  const regra = () => { const P = new Proxy({}, { get(t, k) { if (k === 'build') return () => ({}); return () => P; } }); return P; };
  const ss = { getSheetByName: n => (n === 'ESCALA' ? aba : n === '_LISTA_MILITARES' ? lista : null), getSheets: () => [], insertSheet: () => aba, setActiveSheet() {} };
  const SpreadsheetApp = { getActive: () => ss, newDataValidation: regra, newConditionalFormatRule: regra, BorderStyle: { SOLID_MEDIUM: 'SOLID_MEDIUM', SOLID_THICK: 'SOLID_THICK', DASHED: 'DASHED' } };
  const fontes = ['nucleo.js', 'choques.js', 'sincronia.js', 'regras_escala.js', 'matriz.js', 'cadastro_guarnicoes.js', 'guarnicao.js', 'guarnicao_painel.js'].map(ler).join('\n');
  const P = new Function('SpreadsheetApp', 'Utilities', fontes + '\nreturn {renderizarGrade_, montarGrade_};')(SpreadsheetApp, { parseDate: s => s });

  const esc = { nome: 'Ordinário', servicos: ['Pronto'], turnos: ['A', 'B'], militares: 'ESCALADOS',
    slots: { A: [{ unidade: 'ABT', funcao: 'CHEFE', vagas: 1 }, { unidade: 'AR', funcao: 'CHEFE', vagas: 1 }], B: [{ unidade: 'ABT', funcao: 'CHEFE', vagas: 1 }] } };
  const al = [
    { mat: '2', dia: '2026-11-01', turno: 'A', servico: 'Pronto', funcao: '', unidade: 'AR', linha: 2 },
    { mat: '1', dia: '2026-11-01', turno: 'A', servico: 'Pronto', funcao: '', unidade: 'AR', linha: 3 }
  ];
  const mil = [{ mat: '1', posto: 'SD BM', nome: 'ANA', antig: '', ordem: 0, motorista: false, cnh: [] }, { mat: '2', posto: 'ST BM', nome: 'BIA', antig: '', ordem: 1, motorista: false, cnh: [] }];
  const grade = P.montarGrade_(esc, '2026-11', al);
  P.renderizarGrade_(esc, '2026-11', grade, al, mil, { porChave: {} }, 'America/Recife', null);

  const r0 = 6;
  const bordas = estilo => log.filter(x => x[0] === 'setBorder' && x[9] === estilo).map(x => x[1]);   // setBorder(top..., cor, estilo): cor = x[8], estilo = x[9]
  ver('2.2: linha de dia SOLID_THICK, uma por dia (30), e nenhuma SOLID_MEDIUM entre dias', bordas('SOLID_THICK').length === 30 && bordas('SOLID_MEDIUM').length === 0, [bordas('SOLID_THICK').length, bordas('SOLID_MEDIUM').length]);
  ver('2.1: tracejado cinza claro entre os turnos (30, um por dia), e em cima do turno B (depois da linha extra no dia 01)', bordas('DASHED').length === 30 && bordas('DASHED')[0] === (r0 + 3) + ',1:' + (r0 + 3) + ',9' &&
    log.filter(x => x[0] === 'setBorder' && x[9] === 'DASHED').every(x => x[8] === '#BDBDBD'), bordas('DASHED').slice(0, 2));
  const fundos = log.filter(x => x[0] === 'setBackground' && x[2] === '#EEF3F1').map(x => x[1]);
  ver('2.3: dias alternados (15 de 30) com fundo claro, só nas colunas DATA a FUNÇÃO (1 a 6)', fundos.length === 15 && fundos[0] === (r0 + 4) + ',1:' + (r0 + 6) + ',6', fundos.slice(0, 2));
  ver('2.3: o cinza de fim de semana (#F1F3F4) não disputa mais as células', !log.some(x => x[0] === 'setBackground' && x[2] === '#F1F3F4'));
  const fds = log.filter(x => x[0] === 'setFontColor' && x[2] === '#C5221F').map(x => x[1]);
  ver('2.3: o fim de semana segue marcado na coluna DIA (vermelho), 9 dias em nov/2026', fds.length === 9 && fds.every(a => /,2(:|$)/.test(a) && /,2$/.test(a)), fds.slice(0, 3));
  // dia 01, turno A: linhas ABT(0), AR(1); a lista do AR tem 2 militares -> AR(1) e uma linha extra (2), antes do turno B
  ver('2.4/2.5: um militar por célula: a lista do AR começa na linha do AR, ST antes de SD, e desce para a linha seguinte',
    valores[(r0 + 1) + ',9'] === 'ST BM BIA (2)' && valores[(r0 + 2) + ',9'] === 'SD BM ANA (1)', [valores[(r0 + 1) + ',9'], valores[(r0 + 2) + ',9']]);
  ver('a linha extra tem dia e turno, mas não tem FUNÇÃO nem MILITAR (o salvar a ignora)',
    valores[(r0 + 2) + ',3'] === 'A' && valores[(r0 + 2) + ',6'] === '' && valores[(r0 + 2) + ',7'] === '' && valores[(r0 + 3) + ',3'] === 'B', [valores[(r0 + 2) + ',3'], valores[(r0 + 2) + ',6'], valores[(r0 + 3) + ',3']]);
  ver('a linha extra fica fora do destaque de vaga vazia', regrasCF.length === 2);
  ver('o cabeçalho da coluna fala em turno × guarnição', valores['5,9'] === 'SEM FUNÇÃO (TURNO × GUARNIÇÃO)', valores['5,9']);
  ver('as cores dos serviços e o destaque de vaga vazia continuam (MILITAR e SERVIÇO)', regrasCF.length === 2, regrasCF.length);
  ver('MILITAR e SERVIÇO não recebem o fundo dos dias alternados', !fundos.some(a => /,(7|8)(:|$)/.test(a.split(':')[0]) || /,(7|8)$/.test(a)));
}

console.log('== P19 item 3 (B71; RN-12) CNH hierárquica pelo CTB');
{
  const C = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'cadastro_guarnicoes.js', 'guarnicao.js'].map(ler).join('\n') +
    '\nreturn {cnhAtende_, cnhHabilitadas_, categoriasCnh_, motivoDaLista_};')();
  const pode = (cnh, exigida) => C.cnhAtende_(C.categoriasCnh_(cnh).categorias, exigida);
  ver('D (ou AD) é aceito em posto que exige B', pode('D', ['B']) && pode('AD', ['B']));
  ver('D (ou AD) é aceito em posto que exige C', pode('D', ['C']) && pode('AD', ['C']));
  ver('C é aceito onde pede B', pode('C', ['B']) && pode('AC', ['B']));
  ver('B não é aceito onde pede C ou D', !pode('B', ['C']) && !pode('B', ['D']) && !pode('AB', ['D']));
  ver('C não é aceito onde pede D', !pode('C', ['D']));
  ver('só A não é aceito em posto de carro (B, C, D)', !pode('A', ['B']) && !pode('A', ['C']) && !pode('A', ['D']));
  ver('posto que exige A só aceita quem tem A (D, E e C não habilitam A)', pode('A', ['A']) && pode('AD', ['A']) && !pode('D', ['A']) && !pode('E', ['A']) && !pode('C', ['A']));
  ver('E (CTB) habilita D, C e B', pode('E', ['D']) && pode('E', ['C']) && pode('E', ['B']) && pode('AE', ['D']));
  ver('a notação junta do B59 continua: "AD" vale A, D, C e B', C.cnhHabilitadas_(C.categoriasCnh_('AD').categorias).sort().join() === 'A,B,C,D');
  ver('posto sem exigência aceita qualquer um; militar sem CNH não atende posto que exige', pode('', []) && !pode('', ['B']));
  ver('o posto continua aceitando "qualquer uma das listadas" (exige C ou D: C serve)', pode('C', ['C', 'D']) && !pode('B', ['C', 'D']));

  // a sandbox: CNH dos 76 motoristas (AD 41, AB 16, B 8, C 6, AC 2, D 2, AE 1)
  const sbx = [].concat(...[['AD', 41], ['AB', 16], ['B', 8], ['C', 6], ['AC', 2], ['D', 2], ['AE', 1]].map(([c, n]) => Array(n).fill(c)));
  const conta = ex => sbx.filter(c => pode(c, ex)).length;
  ver('sandbox: posto que pede B (ACO, UTS, Bioma, CPRH) passa de 24 para os 76 motoristas', conta(['B']) === 76, conta(['B']));
  ver('sandbox: posto que pede D (ABT da UTI, AR da UTAPH, PE-Seguro) passa de 43 para 44 (o AE)', conta(['D']) === 44, conta(['D']));

  // as notas da célula continuam explicando a lista vazia
  const nota = C.motivoDaLista_({ funcao: 'MOTORISTA', unidade: 'UTI - PRONTO', exigeCnh: true, escalaTodos: false, candidatos: 3, motoristas: 2, habilitados: 0, exigida: ['D'], temColunaCnh: true, cadastrada: true });
  ver('motivoDaLista_: sem habilitado, a nota diz a categoria exigida e a guarnição', /D/.test(nota) && /UTI - PRONTO/.test(nota), nota);
  const sem = ler('cadastro_guarnicoes.js');
  ver('os comentários não dizem mais que a hierarquia "não está no código"', !/hierarquia[^\n]*N[ÃA]O est[áa] no c[óo]digo/i.test(sem) && !/continua NÃO estando no código/.test(sem));
}

console.log('== P19 item 4 (B69; RN-93) menu "Atualizar estrutura"');
{
  // planilha de mentira com dados de verdade: cada aba é uma matriz de valores
  function novaAba(nome, linhas, opcoes) {
    const aba = {
      nome, v: (linhas || []).map(l => l.slice()), opcoes: opcoes || {}, ss: null,
      getName() { return this.nome; }, setName(n) { this.nome = n; },
      getIndex() { return this.ss.abas.indexOf(this) + 1; },
      getLastRow() { return this.v.length; }, getMaxRows() { return Math.max(this.v.length, 1000); },
      getLastColumn() { return this.v.reduce((m, l) => Math.max(m, l.length), 0); }, getMaxColumns() { return 26; },
      insertColumnAfter(c) { if (this.opcoes.quebra) throw new Error('falha simulada na aba ' + this.nome); this.v.forEach(l => { while (l.length < c) l.push(''); l.splice(c, 0, ''); }); },
      insertColumnBefore(c) { this.v.forEach(l => { while (l.length < c - 1) l.push(''); l.splice(c - 1, 0, ''); }); },
      deleteColumn(c) { this.v.forEach(l => l.splice(c - 1, 1)); },
      getDataRange() { return this.getRange(1, 1, Math.max(this.v.length, 1), Math.max(this.getLastColumn(), 1)); },
      getRange(r, c, nr, nc) {
        const s = this; nr = nr || 1; nc = nc || 1;
        const R = {
          getValues() { const o = []; for (let i = 0; i < nr; i++) { const l = []; for (let j = 0; j < nc; j++) { const x = (s.v[r - 1 + i] || [])[c - 1 + j]; l.push(x === undefined ? '' : x); } o.push(l); } return o; },
          getDisplayValues() { return R.getValues().map(l => l.map(String)); },
          setValues(m) { if (s.opcoes.quebra) throw new Error('falha simulada na aba ' + s.nome); m.forEach((l, i) => { while (s.v.length < r + i) s.v.push([]); l.forEach((x, j) => { const t = s.v[r - 1 + i]; while (t.length < c + j) t.push(''); t[c - 1 + j] = x; }); }); return P; },
          setValue(x) { return R.setValues([[x]]); }
        };
        const P = new Proxy(R, { get(t, k) { if (k in t) return t[k]; return () => P; } });
        return P;
      }
    };
    return new Proxy(aba, { get(t, k) { if (k in t) return t[k]; return () => undefined; } });
  }
  function planilha(abas) {
    const ss = { abas: [] };
    Object.assign(ss, {
      getSheets: () => ss.abas.slice(), getSheetByName: n => ss.abas.filter(a => a.getName() === n)[0] || null,
      insertSheet(n, idx) { const a = novaAba(n, []); a.ss = ss; if (idx) ss.abas.splice(idx, 0, a); else ss.abas.push(a); return a; },
      getSpreadsheetTimeZone: () => 'America/Recife'
    });
    abas.forEach(a => { a.ss = ss; ss.abas.push(a); });
    return ss;
  }
  const regra = () => { const P = new Proxy({}, { get(t, k) { if (k === 'build') return () => ({}); return () => P; } }); return P; };
  function carregar(ss) {
    const fontes = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(ler).join('\n');
    return new Function('SpreadsheetApp', 'Utilities', 'LockService', 'HtmlService', fontes +
      '\nreturn {atualizarEstrutura_, textoDaEstrutura_, MIGRACOES_};')(
      { getActive: () => ss, flush() {}, newDataValidation: regra, newConditionalFormatRule: regra },
      { formatDate: () => '2026-11', parseDate: s => s }, { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) }, {});
  }
  // a sandbox ANTES das P16 a P19: nomes antigos, formato antigo, colunas faltando
  const antiga = () => planilha([
    novaAba('ALOCAÇÕES TABULADAS', [['', 'MATRÍCULA', 'DATA', 'SERVIÇO', 'TURNO', 'FUNÇÃO'], ['', '990170-1', '01/11/2026', 'Pronto', 'A', '']]),
    novaAba('TURNOS', [['ID', 'TIPO DE SERVIÇO', 'SERVIÇO', 'TURNO', 'HORÁRIO INÍCIO', 'HORÁRIO FIM'], [1, 'Ordinário', 'Pronto', 'A', '08:00', '20:00'], [2, 'PJES', 'JES', 'A', '08:00', '20:00']]),
    novaAba('MILITARES', [['MATRÍCULA', 'POSTO/GRAD', 'NOME DE GUERRA', 'SEÇÃO', 'MOTORISTA'], ['990170-1', 'ST BM', 'FICTICIO', '1ª SB', 'Sim']]),
    novaAba('VIATURAS', [['VIGÊNCIA (A PARTIR DE)', 'VIATURA', 'TIPO', 'ATIVAR', 'PRIORIDADE', 'TIPOS DE SERVIÇO', 'CNH', 'FUNÇÃO', 'MÍNIMO', 'MÁXIMO'], ['2026-01', 'ABT', 'Auto Bomba', 'SIM', 1, '', 'D', 'MOTORISTA', 1, 1]]),
    novaAba('ESCALAS', [['ESCALA', 'SERVIÇOS', 'TÍTULO', 'MILITARES', 'DIAS'], ['Bioma', 'Bioma', '', 'TODOS', 'TODOS']]),
    novaAba('MODELOS DE GUARNIÇÃO', [['ESCALA', 'TURNO', 'UNIDADE', 'FUNÇÃO', 'VAGAS', 'EXIGE CNH'], ['Bioma', '', 'ABT', 'MOTORISTA', 1, 'SIM'], ['Bioma', '', 'ABT', 'CHEFE', 1, '']])
  ]);
  let ss = antiga(), E = carregar(ss);
  const ids = E.MIGRACOES_.map(m => m.id);
  ver('cada passo tem id único, descrição, precisa e aplica', new Set(ids).size === ids.length && E.MIGRACOES_.every(m => m.descricao && typeof m.precisa === 'function' && typeof m.aplica === 'function'), ids);

  const olhar = E.atualizarEstrutura_(E.MIGRACOES_, 'so-olhar');
  ver('"só olhar" não muda nada na planilha', ss.getSheetByName('ALOCAÇÕES TABULADAS') && ss.getSheetByName('MODELOS DE GUARNIÇÃO') && olhar.feitos === 0 && olhar.pendentes > 0, olhar.passos.map(p => p.id + ':' + p.estado));

  let rel = E.atualizarEstrutura_();
  const estado = id => (rel.passos.find(p => p.id === id) || {}).estado;
  ver('o aceite: a planilha antiga chega à estrutura atual, sem erro', rel.erros === 0 && rel.feitos >= 10, E.textoDaEstrutura_(rel));
  ver('as abas de nome antigo foram renomeadas (com os dados)', ss.getSheetByName('ALOCAÇÕES') && ss.getSheetByName('GUARNIÇÕES') && ss.getSheetByName('ALOCAÇÕES').v[1][1] === '990170-1');
  const cab = n => ss.getSheetByName(n).v[0].map(String);
  ver('GUARNIÇÕES: ganhou a coluna GUARNIÇÃO antes da VIATURA (com o nome copiado) e perdeu a TIPOS DE SERVIÇO vazia',
    cab('GUARNIÇÕES').indexOf('GUARNIÇÃO') === cab('GUARNIÇÕES').indexOf('VIATURA') - 1 && ss.getSheetByName('GUARNIÇÕES').v[1][1] === 'ABT' && cab('GUARNIÇÕES').indexOf('TIPOS DE SERVIÇO') < 0, cab('GUARNIÇÕES'));
  ver('GUARNIÇÕES POR ESCALA convertida para o formato novo, e a antiga guardada inteira',
    cab('GUARNIÇÕES POR ESCALA').join() === 'VIGÊNCIA (A PARTIR DE),ESCALA,TURNO,GUARNIÇÃO' && ss.getSheetByName('GUARNIÇÕES POR ESCALA (FORMATO ANTIGO)').v.length === 3, cab('GUARNIÇÕES POR ESCALA'));
  ver('ALOCAÇÕES ganhou UNIDADE; TURNOS ganhou ORIGEM (JES → PJES); MILITARES ganhou CNH e VOLUNTÁRIO JES',
    cab('ALOCAÇÕES').indexOf('UNIDADE') >= 0 && cab('TURNOS').indexOf('ORIGEM') >= 0 && ss.getSheetByName('TURNOS').v[2][cab('TURNOS').indexOf('ORIGEM')] === 'PJES' &&
    cab('MILITARES').indexOf('CNH') >= 0 && cab('MILITARES').indexOf('VOLUNTÁRIO JES') >= 0, [cab('ALOCAÇÕES'), cab('TURNOS'), cab('MILITARES')]);
  ver('a CNH entrou ao lado de MOTORISTA', cab('MILITARES').indexOf('CNH') === cab('MILITARES').indexOf('MOTORISTA') + 1, cab('MILITARES'));
  ver('as abas que faltavam foram criadas (COTAS, VOLUNTARIADO, CONFIGURAÇÕES); a ESCALAS que existia ficou como estava',
    ['COTAS', 'VOLUNTARIADO', 'CONFIGURAÇÕES'].every(n => ss.getSheetByName(n)) && estado('aba-escalas') === 'atual' && ss.getSheetByName('ESCALAS').v[1][0] === 'Bioma');
  ver('nenhum dado foi perdido nas abas que já existiam', ss.getSheetByName('MILITARES').v[1].indexOf('FICTICIO') >= 0 && ss.getSheetByName('TURNOS').v.length === 3);

  rel = E.atualizarEstrutura_();
  ver('o aceite: rodar de novo não tem nada a fazer (todos os passos "já estava")', rel.feitos === 0 && rel.erros === 0 && rel.passos.every(p => p.estado === 'atual'), rel.passos.map(p => p.id + ':' + p.estado));

  // um passo que falha mostra o erro exato e não derruba os outros
  ss = antiga();
  ss.abas[1] = novaAba('TURNOS', ss.abas[1].v, { quebra: true }); ss.abas[1].ss = ss;
  E = carregar(ss);
  rel = E.atualizarEstrutura_();
  const erroTurnos = rel.passos.find(p => p.id === 'turnos-origem');
  ver('o aceite: o passo que falha aparece com o erro exato', erroTurnos.estado === 'erro' && /falha simulada na aba TURNOS/.test(erroTurnos.erro), erroTurnos);
  ver('e os outros passos são feitos mesmo assim', rel.erros === 1 && rel.feitos >= 9 && ss.getSheetByName('COTAS') && cab('ALOCAÇÕES').indexOf('UNIDADE') >= 0, E.textoDaEstrutura_(rel));
  ver('o relatório mostra o erro', /✖ ERRO — Criar a coluna ORIGEM em TURNOS[^\n]*falha simulada/.test(E.textoDaEstrutura_(rel)), E.textoDaEstrutura_(rel));

  // TIPOS DE SERVIÇO preenchida: atenção, sem apagar nada
  ss = planilha([novaAba('GUARNIÇÕES', [['GUARNIÇÃO', 'TIPOS DE SERVIÇO', 'FUNÇÃO'], ['ABT', 'Pronto', 'CHEFE']])]);
  E = carregar(ss);
  rel = E.atualizarEstrutura_(E.MIGRACOES_.filter(m => m.id === 'guarnicoes-sem-tipos-de-servico'));
  ver('coluna antiga ainda preenchida: "atenção", e nada é apagado', rel.passos[0].estado === 'atencao' && cab('GUARNIÇÕES').indexOf('TIPOS DE SERVIÇO') >= 0, rel.passos[0]);

  // pedido do usuário (14/11): estrutura só pelo menu; os botões dos painéis saíram
  const telas = ['sidebar_guarnicao.html', 'sidebar_pre_escala.html', 'sidebar_parametros.html'].map(ler).join('\n');
  ver('nenhum painel tem botão de estrutura (Criar abas…, Converter, Migrar para guarnições, Criar coluna CNH)',
    !/btnExemplos|btnConverter|btnCotasAbas|Migrar para guarnições|Criar coluna CNH|Criar abas e colunas? que faltam|Converter para o formato novo/.test(telas));
  const servidor = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(ler).join('\n');
  ver('as funções desses botões saíram do servidor', !/function (painelGuarnicaoExemplos|painelGuarnicaoConverterVinculos|painelCotasAbas|painelGuarnicoesColunaCnh|painelGuarnicoesMigrar)\(/.test(servidor));
  ver('nenhum aviso manda mais o usuário a um botão de estrutura', !/pelo botão "Criar|Use o botão "Converter|botão "Migrar|pelo botão ao lado/.test(servidor));
  ver('o menu tem "Atualizar estrutura"', /addItem\('Atualizar estrutura', 'atualizarEstrutura'\)/.test(ler('matriz.js')));
}

// -- fim das seções
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
