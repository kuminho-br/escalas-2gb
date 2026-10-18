// Testes da P16 (funções, viaturas, CNH e escala do Pronto). Uso: node testes/teste_p16.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(dir, f), 'utf8');

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 500) : '')); } };

/** Carrega a camada do Sheets com dublês de SpreadsheetApp/Utilities e uma aba de alocações. */
function comPlanilha(alocacoes, exporta) {
  const fontes = ['nucleo.js', 'choques.js', 'matriz.js', 'sincronia.js', 'sincronia_painel.js'].map(ler).join('\n');
  const cab = ['MATRÍCULA', 'DATA', 'SERVIÇO', 'TURNO', 'FUNÇÃO', 'UNIDADE'];
  const linhas = alocacoes.map(a => [a.mat, a.dia, a.servico, a.turno, a.funcao || '', a.unidade || '']);
  const aba = {
    getName: () => 'ALOCAÇÕES TABULADAS',
    getDataRange: () => ({ getValues: () => [cab].concat(linhas) }),
    getLastRow: () => linhas.length + 1, getLastColumn: () => cab.length, getMaxRows: () => linhas.length + 1,
    getRange: () => ({ getValues: () => [cab], setNumberFormat() { return this; }, setValues() { return this; } })
  };
  const SpreadsheetApp = {
    getActive: () => ({ getSheetByName: n => (n === 'ALOCAÇÕES TABULADAS' ? aba : null), getSpreadsheetTimeZone: () => 'America/Recife' })
  };
  const Utilities = { formatDate: () => '' };
  return new Function('SpreadsheetApp', 'Utilities', fontes + '\nreturn {' + exporta + '};')(SpreadsheetApp, Utilities);
}

console.log('== B35 (RN-36, RN-37) a gravação é conferida na própria tabela');
{
  const A = (mat, servico, turno, dia) => ({ mat, dia: '2026-11-' + (dia || '10'), servico, turno });
  const na = [A('M1', 'Pronto', 'A'), A('M2', 'JES', 'B')];
  const L = comPlanilha(na, 'conferirGravacao_, chaveAloc_');
  const rot = { lista: [], porPar: {} };
  const k = a => L.chaveAloc_(a);

  let c = L.conferirGravacao_({ inserir: [Object.assign({ chave: k(na[0]) }, na[0])], remover: [] }, 'America/Recife', rot, {});
  ver('inclusão que chegou à tabela: nada a reclamar', c.naoGravadas === 0 && c.detalhe.length === 0, c);

  const fantasma = A('M9', 'Pronto', 'A');
  c = L.conferirGravacao_({ inserir: [Object.assign({ chave: k(fantasma) }, fantasma)], remover: [] }, 'America/Recife', rot, {});
  ver('inclusão que NÃO chegou é detectada e descrita', c.naoGravadas === 1 && /não entrou/.test(c.detalhe[0]) && /M9|matrícula/.test(c.detalhe[0]), c);

  c = L.conferirGravacao_({ inserir: [], remover: [{ chave: k(na[1]) }] }, 'America/Recife', rot, {});
  ver('exclusão que não saiu da tabela é detectada', c.naoGravadas === 1 && /não saiu/.test(c.detalhe[0]), c);

  c = L.conferirGravacao_({ inserir: [], remover: [{ chave: k(fantasma) }] }, 'America/Recife', rot, {});
  ver('exclusão que saiu mesmo: nada a reclamar', c.naoGravadas === 0, c);

  const muitas = [];
  for (let i = 0; i < 9; i++) muitas.push(Object.assign({ chave: k(A('X' + i, 'Pronto', 'A')) }, A('X' + i, 'Pronto', 'A')));
  c = L.conferirGravacao_({ inserir: muitas, remover: [] }, 'America/Recife', rot, {});
  ver('conta todas as que faltaram, mas detalha no máximo 5', c.naoGravadas === 9 && c.detalhe.length === 5, c);
}

console.log('== B37 (RN-07 a RN-12, RN-93) cadastro das viaturas com vigência mensal');
{
  const L = new Function(['nucleo.js', 'viaturas.js'].map(ler).join('\n') +
    '\nreturn {resolverViaturas_, cnhAtende_, avaliarGuarnicao_, viaturaAceitaServico_, viaturaPorNome_, viatLista_};')();
  // VIGÊNCIA, VIATURA, TIPO, ATIVAR, PRIORIDADE, TIPOS DE SERVIÇO, CNH, FUNÇÃO, MÍNIMO, MÁXIMO
  const l = (vig, viatura, tipo, ativar, prio, servicos, cnh, funcao, min, max, linha) =>
    ({ linha: linha, vigencia: vig, viatura: viatura, tipo: tipo, ativar: ativar, prioridade: prio, servicos: servicos, cnh: cnh, funcao: funcao, minimo: min, maximo: max });
  // duas viaturas com CNH e guarnições diferentes
  const base = [
    l('', 'AR', 'Auto Resgate', 'SIM', 1, '', 'D', 'MOTORISTA', 1, 1, 2),
    l('', 'AR', '', '', '', '', '', 'CHEFE', 1, 1, 3),
    l('', 'AR', '', '', '', '', '', 'SOCORRISTA', 1, 3, 4),
    l('', 'ABTS', 'Auto Bomba', 'SIM', 2, 'Pronto', 'C', 'MOTORISTA', 1, 1, 5),
    l('', 'ABTS', '', '', '', '', '', 'COMBATENTE', 2, 4, 6),
    l('', 'Quartel', 'Efetivo do quartel', 'NÃO', '', '', '', 'ADJUNTO DE DIA', 1, 1, 7)
  ];
  let r = L.resolverViaturas_(base, '2026-10');
  ver('lê as três viaturas, sem aviso', r.viaturas.length === 3 && r.avisos.length === 0, r.avisos);
  const ar = r.porId['AR'];
  ver('AR: mínimo 3 (motorista, chefe, socorrista) e máximo 5 (RN-10, RN-11)',
    ar.funcoes.reduce((s, f) => s + f.minimo, 0) === 3 && ar.funcoes.reduce((s, f) => s + f.maximo, 0) === 5, ar.funcoes);
  ver('AR: dados da viatura vêm da 1ª linha e valem para as demais', ar.tipo === 'Auto Resgate' && ar.ativar === true && ar.prioridade === 1 && ar.cnh.join() === 'D', ar);
  ver('ordem de ativação pela prioridade; sem prioridade vai por último (RN-08)',
    r.viaturas.map(v => v.id).join() === 'AR,ABTS,Quartel', r.viaturas.map(v => v.id));
  ver('ATIVAR NÃO é respeitado (RN-07)', r.porId['QUARTEL'].ativar === false && r.viaturas.filter(v => v.ativar).length === 2);
  ver('TIPOS DE SERVIÇO: ABTS só aceita Pronto (RN-09)',
    L.viaturaAceitaServico_(r.porId['ABTS'], 'Pronto') && !L.viaturaAceitaServico_(r.porId['ABTS'], 'Bioma'));
  ver('sem lista de tipos de serviço a viatura aceita qualquer serviço', L.viaturaAceitaServico_(ar, 'Bioma') === true);
  ver('serviço sem viatura: nada a cobrar e nenhum aviso', L.viaturaPorNome_(r, 'UTI móvel') === null && L.viaturaAceitaServico_(null, 'Bioma') === true && r.avisos.length === 0);

  // RN-93: alterar a guarnição mínima não retroage
  const comMudanca = base.concat([l('2026-11', 'AR', '', '', '', '', '', 'SOCORRISTA', 2, 3, 20)]);
  ver('mês já fechado mantém o mínimo antigo (RN-93)', L.resolverViaturas_(comMudanca, '2026-10').porId['AR'].funcoes.find(f => f.funcao === 'SOCORRISTA').minimo === 1);
  ver('o mês da vigência passa a usar o mínimo novo', L.resolverViaturas_(comMudanca, '2026-11').porId['AR'].funcoes.find(f => f.funcao === 'SOCORRISTA').minimo === 2);
  ver('meses seguintes seguem com o valor novo', L.resolverViaturas_(comMudanca, '2027-03').porId['AR'].funcoes.find(f => f.funcao === 'SOCORRISTA').minimo === 2);
  const trocaPrio = base.concat([l('2026-12', 'ABTS', '', '', 1, '', '', '', '', '', 21), l('2026-12', 'AR', '', '', 3, '', '', '', '', '', 22)]);
  ver('a prioridade também tem vigência', L.resolverViaturas_(trocaPrio, '2026-10').viaturas[0].id === 'AR' && L.resolverViaturas_(trocaPrio, '2026-12').viaturas[0].id === 'ABTS');
  ver('MÁXIMO 0 tira a função da viatura a partir da vigência',
    L.resolverViaturas_(base.concat([l('2026-12', 'AR', '', '', '', '', '', 'SOCORRISTA', 0, 0, 23)]), '2026-12').porId['AR'].funcoes.map(f => f.funcao).join() === 'CHEFE,MOTORISTA');

  // avisos de linha ruim
  r = L.resolverViaturas_([l('13/2026', 'AR', '', '', '', '', '', 'CHEFE', 1, 1, 2)], '2026-10');
  ver('vigência inválida: linha ignorada com aviso', r.viaturas.length === 0 && /vigência/.test(r.avisos[0]), r.avisos);
  r = L.resolverViaturas_([l('', 'AR', '', '', '', '', '', 'CHEFE', 3, 1, 2)], '2026-10');
  ver('máximo menor que o mínimo: linha ignorada com aviso', r.viaturas.length === 0 && /menor que o mínimo/.test(r.avisos[0]), r.avisos);
  r = L.resolverViaturas_([l('', 'AR', '', '', '', '', '', 'CHEFE', 'dois', 1, 2)], '2026-10');
  ver('mínimo não numérico: linha ignorada com aviso', r.viaturas.length === 0 && /números inteiros/.test(r.avisos[0]), r.avisos);

  // RN-12: CNH
  ver('CNH exigida D e militar com D: atende', L.cnhAtende_(['D'], ['D']) === true);
  ver('CNH exigida D e militar com B: não atende', L.cnhAtende_(['B'], ['D']) === false);
  ver('militar com "B, D" atende a D (a hierarquia é cadastro, não código)', L.cnhAtende_(L.viatLista_('B, D'), ['D']) === true);
  ver('viatura sem CNH exigida: qualquer um atende', L.cnhAtende_([], []) === true && L.cnhAtende_(['B'], []) === true);
  ver('militar sem CNH cadastrada não atende exigência', L.cnhAtende_([], ['D']) === false);

  // RN-10 / RN-11
  let g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1, SOCORRISTA: 1 });
  ver('mínimo atendido: viatura ativa (RN-10)', g.ativa === true && g.faltando.length === 0, g);
  g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1 });
  ver('faltando socorrista: viatura não é ativada e o relatório diz o que falta (RN-10)',
    g.ativa === false && g.faltando.length === 1 && g.faltando[0].funcao === 'SOCORRISTA' && g.faltando[0].falta === 1, g);
  g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1, SOCORRISTA: 3 });
  ver('no máximo não sobra vaga (RN-11)', g.vagas.SOCORRISTA === 0 && g.vagas.MOTORISTA === 0 && g.ativa === true, g.vagas);
  g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1, SOCORRISTA: 4 });
  ver('acima do máximo é apontado (RN-11)', g.excedendo.length === 1 && g.excedendo[0].funcao === 'SOCORRISTA', g.excedendo);
  ver('viatura sem função cadastrada não bloqueia nada', L.avaliarGuarnicao_(null, {}).ativa === true);
  ver('máximo em branco = sem limite', L.avaliarGuarnicao_(L.resolverViaturas_([l('', 'X', '', '', '', '', '', 'CHEFE', 1, '', 2)], '2026-10').porId['X'], { CHEFE: 9 }).vagas.CHEFE === null);
}

console.log('== B36 (RN-94, RN-96, RN-83) as funções de cada serviço vêm do cadastro');
{
  const L = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'guarnicao.js'].map(ler).join('\n') +
    '\nreturn {montarModelosGuarnicao_, funcoesPorServico_, funcoesQueExigemCnh_, funcaoExigeCnh_};')();
  const turnosPorServico = { Pronto: ['A', 'B'], 'PE Seguro': ['A', 'B', 'C'], 'Apoio Aquartelado': ['A'] };
  const escalas = [
    { escala: 'Pronto', servicos: 'Pronto', titulo: '', militares: 'ESCALADOS', dias: 'TODOS' },
    { escala: 'PE Seguro', servicos: 'PE Seguro', titulo: '', militares: 'TODOS', dias: 'TODOS' },
    { escala: 'Apoio Aquartelado', servicos: 'Apoio Aquartelado', titulo: '', militares: 'ESCALADOS', dias: 'TODOS' }
  ];
  const modelos = [
    { escala: 'Pronto', turno: 'A', unidade: 'AR', funcao: 'MOTORISTA', vagas: 1, exigeCnh: 'SIM' },
    { escala: 'Pronto', turno: 'A', unidade: 'AR', funcao: 'CHEFE', vagas: 1, exigeCnh: '' },
    { escala: 'Pronto', turno: 'A', unidade: 'AR', funcao: 'SOCORRISTA', vagas: 3, exigeCnh: '' },
    { escala: 'Pronto', turno: 'B', unidade: 'ABTS', funcao: 'MOTORISTA', vagas: 1, exigeCnh: 'SIM' },
    { escala: 'Pronto', turno: 'B', unidade: 'ABTS', funcao: 'COMBATENTE', vagas: 2, exigeCnh: '' },
    { escala: 'PE Seguro', turno: 'TODOS', unidade: '', funcao: 'CHEFE', vagas: 1, exigeCnh: '' },
    // RN-96: o Apoio Operacional Aquartelado é cadastro como qualquer outra unidade (nada de 1+2+1 no código)
    { escala: 'Apoio Aquartelado', turno: 'A', unidade: 'ACO', funcao: 'MOTORISTA ACO', vagas: 1, exigeCnh: 'SIM' },
    { escala: 'Apoio Aquartelado', turno: 'A', unidade: '', funcao: 'DESPACHANTE DE CENTRO DE OPERAÇÕES', vagas: 2, exigeCnh: '' },
    { escala: 'Apoio Aquartelado', turno: 'A', unidade: '', funcao: 'ADJUNTO DE DIA', vagas: 1, exigeCnh: '' }
  ];
  const mod = L.montarModelosGuarnicao_(escalas, modelos, turnosPorServico);
  ver('cada serviço tem a sua lista de funções (RN-83)',
    L.funcoesPorServico_(mod, 'Pronto', 'A').map(f => f.funcao).join() === 'MOTORISTA,CHEFE,SOCORRISTA' &&
    L.funcoesPorServico_(mod, 'PE Seguro', 'A').map(f => f.funcao).join() === 'CHEFE', L.funcoesPorServico_(mod, 'Pronto', 'A'));
  ver('cada turno tem a sua', L.funcoesPorServico_(mod, 'Pronto', 'B').map(f => f.funcao).join() === 'MOTORISTA,COMBATENTE');
  ver('sem turno, todos os postos do serviço (o motorista de cada viatura conta separado)', L.funcoesPorServico_(mod, 'Pronto').length === 5, L.funcoesPorServico_(mod, 'Pronto'));
  ver('turno que não existe na escala não devolve nada', L.funcoesPorServico_(mod, 'Pronto', 'C').length === 0);
  ver('serviço sem cadastro não inventa função', L.funcoesPorServico_(mod, 'Adm', 'A').length === 0);
  ver('o nome do serviço casa sem caixa/acento', L.funcoesPorServico_(mod, 'pe seguro', 'A').length === 1);
  ver('a unidade do posto vem junto', L.funcoesPorServico_(mod, 'Pronto', 'A')[0].unidade === 'AR');
  ver('RN-96: o Apoio Aquartelado é cadastro, com as funções que o escalante pôs',
    L.funcoesPorServico_(mod, 'Apoio Aquartelado', 'A').map(f => f.funcao).join() === 'MOTORISTA ACO,DESPACHANTE DE CENTRO DE OPERAÇÕES,ADJUNTO DE DIA');
  ver('cadastrar uma função nova faz ela aparecer, sem mexer no código',
    L.funcoesPorServico_(L.montarModelosGuarnicao_(escalas, modelos.concat([{ escala: 'Pronto', turno: 'A', unidade: 'AR', funcao: 'AUXILIAR DE 1ª LINHA', vagas: 1, exigeCnh: '' }]), turnosPorServico), 'Pronto', 'A')
      .some(f => f.funcao === 'AUXILIAR DE 1ª LINHA'));

  // B36/B38: quais funções exigem CNH é cadastro, não nome no código
  const comCnh = L.funcoesQueExigemCnh_(mod);
  ver('EXIGE CNH = SIM marca a função no cadastro', comCnh['MOTORISTA'] === true && comCnh['MOTORISTAACO'] === true && !comCnh['CHEFE'], comCnh);
  ver('com o cadastro preenchido, só ele decide', L.funcaoExigeCnh_('MOTORISTA ACO', comCnh) === true && L.funcaoExigeCnh_('CHEFE', comCnh) === false);
  ver('função com MOTORISTA no nome mas não marcada no cadastro não exige CNH', L.funcaoExigeCnh_('AUXILIAR DO MOTORISTA', comCnh) === false);
  ver('sem a coluna EXIGE CNH, a ponte antiga pelo nome continua valendo',
    L.funcaoExigeCnh_('MOTORISTA', {}) === true && L.funcaoExigeCnh_('CHEFE', {}) === false);
  const semCnh = L.funcoesQueExigemCnh_(L.montarModelosGuarnicao_(escalas, modelos.map(x => Object.assign({}, x, { exigeCnh: '' })), turnosPorServico));
  ver('nenhuma função marcada: o cadastro fica vazio e vale a ponte', Object.keys(semCnh).length === 0);
}

console.log('== B38 (RN-12) motorista precisa de CNH compatível com a viatura');
{
  const L = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'viaturas.js', 'guarnicao.js'].map(ler).join('\n') +
    '\nreturn {calcularGuarnicao_};')();
  const esc = {
    nome: 'Pronto', servicos: ['Pronto'], militares: 'ESCALADOS', dias: 'TODOS', turnos: ['A'], usaUnidade: true,
    slots: { A: [{ unidade: 'AR', funcao: 'MOTORISTA', vagas: 1, exigeCnh: true }, { unidade: 'AR', funcao: 'CHEFE', vagas: 1, exigeCnh: false }] }
  };
  const tabela = [
    { mat: 'M1', dia: '2026-11-05', turno: 'A', servico: 'Pronto', funcao: '', unidade: '', linha: 10 },
    { mat: 'M2', dia: '2026-11-05', turno: 'A', servico: 'Pronto', funcao: '', unidade: '', linha: 11 }
  ];
  const posto = (mat, funcao, unidade) => ({ linha: 6, dia: '2026-11-05', turno: 'A', unidade: unidade === undefined ? 'AR' : unidade, funcao: funcao, texto: mat, mat: mat });
  const base = [];
  const opc = extra => Object.assign({ motoristas: { M1: true }, funcoesComCnh: { MOTORISTA: true }, cnh: { M1: ['B'], M2: ['D'] }, cnhPorUnidade: { AR: ['D'] } }, extra || {});

  let r = L.calcularGuarnicao_(base, [posto('M1', 'MOTORISTA')], tabela, esc, opc());
  ver('motorista do quadro mas com CNH insuficiente é avisado (RN-12)',
    r.avisosCnh.length === 1 && r.avisosCnh[0].mat === 'M1' && r.avisosCnh[0].exigida === 'D' && r.avisosMotorista.length === 0, [r.avisosCnh, r.avisosMotorista]);
  r = L.calcularGuarnicao_(base, [posto('M2', 'MOTORISTA')], tabela, esc, opc({ motoristas: { M2: true } }));
  ver('motorista com a categoria exigida não gera aviso', r.avisosCnh.length === 0 && r.avisosMotorista.length === 0, [r.avisosCnh, r.avisosMotorista]);
  r = L.calcularGuarnicao_(base, [posto('M2', 'MOTORISTA')], tabela, esc, opc({ motoristas: {} }));
  ver('fora do quadro de motoristas: continua o aviso que já existia, e só ele',
    r.avisosMotorista.length === 1 && r.avisosCnh.length === 0, [r.avisosMotorista, r.avisosCnh]);
  r = L.calcularGuarnicao_(base, [posto('M1', 'CHEFE')], tabela, esc, opc());
  ver('função que não é de condutor não é checada', r.avisosCnh.length === 0 && r.avisosMotorista.length === 0);
  r = L.calcularGuarnicao_(base, [posto('M1', 'MOTORISTA', '')], tabela, esc, opc());
  ver('posto sem viatura vinculada: vale só o quadro de motoristas (RN-12)', r.avisosCnh.length === 0 && r.avisosMotorista.length === 0);
  r = L.calcularGuarnicao_(base, [posto('M1', 'MOTORISTA')], tabela, esc, opc({ cnhPorUnidade: {} }));
  ver('viatura sem CNH exigida: ninguém é barrado', r.avisosCnh.length === 0);
  r = L.calcularGuarnicao_(base, [posto('M1', 'MOTORISTA')], tabela, esc, opc({ cnh: { M1: ['B', 'D'] } }));
  ver('militar com "B, D" atende à exigência D', r.avisosCnh.length === 0);
  r = L.calcularGuarnicao_(base, [posto('M1', 'MOTORISTA')], tabela, esc, opc({ funcoesComCnh: {} }));
  ver('sem cadastro de EXIGE CNH, a ponte pelo nome mantém a checagem', r.avisosCnh.length === 1, r.avisosCnh);
  ver('o resumo conta os avisos de CNH', L.calcularGuarnicao_(base, [posto('M1', 'MOTORISTA')], tabela, esc, opc()).resumo.cnh === 1);
}

console.log('== B40 (RN-05, RN-13, RN-49) visualização no formato oficial');
{
  const L = new Function(['nucleo.js', 'choques.js', 'guarnicao.js', 'escala_op.js'].map(ler).join('\n') +
    '\nreturn {montarEscalaOperacional_, origemDoServico_, ordemDosTurnos_};')();
  const hor = {
    'Pronto|A': { ini: 480, fim: 1200, dur: 720 }, 'Pronto|B': { ini: 1200, fim: 480, dur: 720 },
    'JES|A': { ini: 480, fim: 1200, dur: 720 }, 'Saldo|A': { ini: 480, fim: 1200, dur: 720 }
  };
  const mil = {
    '711': { posto: '3º SGT BM', nome: 'JULIO', antig: 10, ordem: 1 },
    '722': { posto: 'CB BM', nome: 'ANA', antig: 20, ordem: 2 },
    '733': { posto: 'SD BM', nome: 'BRUNO', antig: 30, ordem: 3 },
    '744': { posto: 'SD BM', nome: 'CARLOS', antig: 5, ordem: 4 }
  };
  const a = (mat, dia, servico, turno, funcao, unidade) => ({ mat: mat, dia: '2026-10-' + dia, servico: servico, turno: turno, funcao: funcao, unidade: unidade });
  const opc = extra => Object.assign({ mes: '2026-10', militares: mil, horarios: hor, origens: { JES: 'PJES' } }, extra || {});

  ver('origem: JES vira PJES; os outros ficam como estão (RN-13)',
    L.origemDoServico_('JES', { JES: 'PJES' }) === 'PJES' && L.origemDoServico_('Pronto', { JES: 'PJES' }) === 'PRONTO' && L.origemDoServico_('Saldo', {}) === 'SALDO');
  ver('ordem dos turnos vem do horário de início do catálogo', JSON.stringify(L.ordemDosTurnos_(hor)) === '{"A":1,"B":2}', L.ordemDosTurnos_(hor));

  // duas vagas da mesma função e mesma origem: mesma linha, separadas por |
  let d = L.montarEscalaOperacional_([
    a('711', '01', 'Pronto', 'A', 'DESPACHANTE', 'UNIDADE TÁTICA DE INCÊNDIO'),
    a('722', '01', 'Pronto', 'A', 'DESPACHANTE', 'UNIDADE TÁTICA DE INCÊNDIO')
  ], opc());
  let b = d.dias[0].blocos[0];
  ver('a faixa traz unidade, turno e horário', b.titulo === 'UNIDADE TÁTICA DE INCÊNDIO - 1º TURNO (08:00 - 20:00)', b.titulo);
  ver('mesma função e mesma origem: uma linha só, com " | "',
    b.linhas.length === 1 && b.linhas[0].rotulo === 'DESPACHANTE - PRONTO' && b.linhas[0].texto === '3º SGT BM 711 JULIO | CB BM 722 ANA', b.linhas);

  // origens diferentes: duas linhas
  d = L.montarEscalaOperacional_([
    a('711', '05', 'Pronto', 'A', 'DESPACHANTE', 'UTI'),
    a('722', '05', 'JES', 'A', 'DESPACHANTE', 'UTI')
  ], opc());
  b = d.dias[0].blocos[0];
  ver('origens diferentes viram duas linhas (RN-13)',
    b.linhas.length === 2 && b.linhas.map(l => l.rotulo).sort().join(' / ') === 'DESPACHANTE - PJES / DESPACHANTE - PRONTO', b.linhas.map(l => l.rotulo));

  // a composição muda de dia para dia e nada é inventado
  d = L.montarEscalaOperacional_([
    a('711', '01', 'Pronto', 'A', 'CHEFE DE 2ª LINHA', 'UTI'),
    a('722', '01', 'Pronto', 'A', 'COMBATENTE-AUXILIAR', 'UTI'),
    a('733', '05', 'Pronto', 'A', 'AUXILIAR DE 1ª LINHA', 'UTI'),
    a('744', '05', 'Pronto', 'A', 'AUXILIAR DE 2ª LINHA', 'UTI')
  ], opc());
  ver('cada dia mostra o que está alocado nele, sem gabarito',
    d.dias.length === 2 &&
    d.dias[0].blocos[0].linhas.map(l => l.funcao).sort().join() === 'CHEFE DE 2ª LINHA,COMBATENTE-AUXILIAR' &&
    d.dias[1].blocos[0].linhas.map(l => l.funcao).sort().join() === 'AUXILIAR DE 1ª LINHA,AUXILIAR DE 2ª LINHA',
    d.dias.map(x => x.blocos[0].linhas.map(l => l.funcao)));
  ver('nenhuma linha para função sem militar alocado', d.dias[0].blocos[0].linhas.every(l => l.mats.length > 0));

  // ordem: unidades e funções seguem o cadastro; militares por antiguidade
  d = L.montarEscalaOperacional_([
    a('722', '01', 'Pronto', 'A', 'SOCORRISTA', 'AR'),
    a('744', '01', 'Pronto', 'A', 'SOCORRISTA', 'AR'),
    a('711', '01', 'Pronto', 'A', 'MOTORISTA', 'AR'),
    a('733', '01', 'Pronto', 'A', 'ADJUNTO DE DIA', 'APOIO AQUARTELADO')
  ], opc({ ordemUnidades: { 'APOIOAQUARTELADO': 1, 'AR': 2 }, ordemFuncoes: { 'AR': { 'MOTORISTA': 1, 'SOCORRISTA': 2 } } }));
  ver('as unidades saem na ordem do cadastro', d.dias[0].blocos.map(x => x.unidade).join(' / ') === 'APOIO AQUARTELADO / AR', d.dias[0].blocos.map(x => x.unidade));
  const ar = d.dias[0].blocos[1];
  ver('as funções saem na ordem do cadastro', ar.linhas.map(l => l.funcao).join() === 'MOTORISTA,SOCORRISTA', ar.linhas.map(l => l.funcao));
  ver('na linha, os militares vêm por antiguidade', ar.linhas[1].texto === 'SD BM 744 CARLOS | CB BM 722 ANA', ar.linhas[1].texto);

  // turnos na ordem do horário; dias em ordem
  d = L.montarEscalaOperacional_([a('711', '02', 'Pronto', 'B', 'CHEFE', 'AR'), a('722', '02', 'Pronto', 'A', 'CHEFE', 'AR'), a('733', '01', 'Pronto', 'A', 'CHEFE', 'AR')], opc());
  ver('dias em ordem e turnos pelo horário', d.dias.map(x => x.dia).join() === '2026-10-01,2026-10-02' &&
    d.dias[1].blocos.map(x => x.turno).join() === 'A,B', [d.dias.map(x => x.dia), d.dias[1].blocos.map(x => x.turno)]);

  // funções compostas e 12H: exibidas como estão (P-25, P-26)
  d = L.montarEscalaOperacional_([a('711', '06', 'Saldo', 'A', 'MOTORISTA / CHEFE', 'AR'), a('722', '06', 'Pronto', 'A', 'MOTORISTA 12H', 'AR')], opc());
  ver('função composta e "12H" aparecem como estão gravadas',
    d.dias[0].blocos[0].linhas.map(l => l.rotulo).sort().join(' / ') === 'MOTORISTA / CHEFE - SALDO / MOTORISTA 12H - PRONTO', d.dias[0].blocos[0].linhas.map(l => l.rotulo));

  // alocação sem unidade e sem função: aparece e é avisada, não é escondida
  d = L.montarEscalaOperacional_([a('711', '07', 'Pronto', 'A', 'CHEFE', ''), a('722', '07', 'Pronto', 'A', '', 'AR')], opc());
  ver('sem UNIDADE vai para um bloco próprio, com aviso',
    d.dias[0].blocos.some(x => /SEM UNIDADE/.test(x.unidade)) && d.avisos.some(t => /sem UNIDADE/.test(t)), [d.dias[0].blocos.map(x => x.unidade), d.avisos]);
  ver('sem FUNÇÃO aparece como (SEM FUNÇÃO), com aviso',
    JSON.stringify(d.dias[0].blocos).indexOf('(SEM FUNÇÃO)') >= 0 && d.avisos.some(t => /sem FUNÇÃO/.test(t)), d.avisos);

  // mês sem alocação e alocação de outro mês
  d = L.montarEscalaOperacional_([a('711', '01', 'Pronto', 'A', 'CHEFE', 'AR')], opc({ mes: '2026-11' }));
  ver('mês sem alocação não inventa dia', d.dias.length === 0 && d.totais.alocacoes === 0 && d.periodo.de === '2026-11-01' && d.periodo.ate === '2026-11-30', d);
  ver('o período é o mês inteiro', L.montarEscalaOperacional_([], opc()).periodo.ate === '2026-10-31');
  ver('a mesma alocação repetida não duplica o militar na linha',
    L.montarEscalaOperacional_([a('711', '01', 'Pronto', 'A', 'CHEFE', 'AR'), a('711', '01', 'Pronto', 'A', 'CHEFE', 'AR')], opc()).dias[0].blocos[0].linhas[0].mats.length === 1);
  ver('os totais contam alocações, dias e militares',
    JSON.stringify(L.montarEscalaOperacional_([a('711', '01', 'Pronto', 'A', 'CHEFE', 'AR'), a('722', '02', 'Pronto', 'A', 'CHEFE', 'AR')], opc()).totais) ===
    JSON.stringify({ alocacoes: 2, diasComEscala: 2, militares: 2, semUnidade: 0, semFuncao: 0 }));
  ver('militar fora do cadastro aparece pela matrícula, sem quebrar',
    L.montarEscalaOperacional_([a('999', '01', 'Pronto', 'A', 'CHEFE', 'AR')], opc()).dias[0].blocos[0].linhas[0].texto === '999');
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
