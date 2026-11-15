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
    '\nreturn {desenhoDaEscala_, textosSemFuncao_, compararAntiguidade_, montarGrade_};')();
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
  const t = G.textosSemFuncao_(linhas, sf, mil);
  ver('2.4: um militar por linha da célula, com graduação, nome e matrícula, do mais antigo ao mais moderno (ST antes de SD)',
    t[0].split('\n').slice(0, 2).join(' / ') === 'ST BM BIA (2) (COZINHEIRO fora do modelo) / SD BM ANA (1)', t[0]);
  ver('2.4: função fora do modelo continua avisada', /\(COZINHEIRO fora do modelo\)/.test(t[0]));
  ver('2.5: a lista do AR fica na 1ª linha do bloco do AR, dentro do turno', t[2] === '3º SGT BM CAIO (3)', t);
  ver('2.5: quem não tem guarnição fica em "Sem guarnição:", na 1ª linha do turno (depois da lista da 1ª guarnição)',
    t[0].split('\n').slice(2).join(' / ') === 'Sem guarnição: / CB BM DANI (4) / (9)', t[0]);
  ver('2.5: guarnição que não está naquele turno vai para "Sem guarnição", com o nome dela',
    t[6] === 'Sem guarnição:\nSD BM ANA (1) (guarnição "UTS" fora deste turno)', t[6]);
  ver('as outras linhas ficam sem texto', [1, 3, 4, 5].every(i => t[i] === ''), t);
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

  const r0 = 6, n = grade.linhas.length;                   // 30 dias × 3 postos
  const bordas = estilo => log.filter(x => x[0] === 'setBorder' && x[9] === estilo).map(x => x[1]);   // setBorder(top..., cor, estilo): cor = x[8], estilo = x[9]
  ver('2.2: linha de dia SOLID_THICK, uma por dia (30), e nenhuma SOLID_MEDIUM entre dias', bordas('SOLID_THICK').length === 30 && bordas('SOLID_MEDIUM').length === 0, [bordas('SOLID_THICK').length, bordas('SOLID_MEDIUM').length]);
  ver('2.1: tracejado cinza claro entre os turnos (30, um por dia), e em cima do turno B', bordas('DASHED').length === 30 && bordas('DASHED')[0] === (r0 + 2) + ',1:' + (r0 + 2) + ',9' &&
    log.filter(x => x[0] === 'setBorder' && x[9] === 'DASHED').every(x => x[8] === '#BDBDBD'), bordas('DASHED').slice(0, 2));
  const fundos = log.filter(x => x[0] === 'setBackground' && x[2] === '#EEF3F1').map(x => x[1]);
  ver('2.3: dias alternados (15 de 30) com fundo claro, só nas colunas DATA a FUNÇÃO (1 a 6)', fundos.length === 15 && fundos[0] === (r0 + 3) + ',1:' + (r0 + 5) + ',6', fundos.slice(0, 2));
  ver('2.3: o cinza de fim de semana (#F1F3F4) não disputa mais as células', !log.some(x => x[0] === 'setBackground' && x[2] === '#F1F3F4'));
  const fds = log.filter(x => x[0] === 'setFontColor' && x[2] === '#C5221F').map(x => x[1]);
  ver('2.3: o fim de semana segue marcado na coluna DIA (vermelho), 9 dias em nov/2026', fds.length === 9 && fds.every(a => /,2(:|$)/.test(a) && /,2$/.test(a)), fds.slice(0, 3));
  ver('2.4: a coluna "sem função" quebra linha e fica alinhada em cima', log.some(x => x[0] === 'setWrap' && x[1] === r0 + ',9:' + (r0 + n - 1) + ',9' && x[2] === true));
  ver('2.4/2.5: a lista do AR (dia 01, turno A) está na linha do AR, ST antes de SD', valores[(r0 + 1) + ',9'] === 'ST BM BIA (2)\nSD BM ANA (1)', valores[(r0 + 1) + ',9']);
  ver('o cabeçalho da coluna fala em turno × guarnição', valores['5,9'] === 'SEM FUNÇÃO (TURNO × GUARNIÇÃO)', valores['5,9']);
  ver('as cores dos serviços e o destaque de vaga vazia continuam (MILITAR e SERVIÇO)', regrasCF.length === 2, regrasCF.length);
  ver('MILITAR e SERVIÇO não recebem o fundo dos dias alternados', !fundos.some(a => /,(7|8)(:|$)/.test(a.split(':')[0]) || /,(7|8)$/.test(a)));
}

// -- fim das seções
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
