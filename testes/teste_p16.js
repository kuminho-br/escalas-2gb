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
    getName: () => 'ALOCAÇÕES',
    getDataRange: () => ({ getValues: () => [cab].concat(linhas) }),
    getLastRow: () => linhas.length + 1, getLastColumn: () => cab.length, getMaxRows: () => linhas.length + 1,
    getRange: () => ({ getValues: () => [cab], setNumberFormat() { return this; }, setValues() { return this; } })
  };
  const SpreadsheetApp = {
    getActive: () => ({ getSheetByName: n => (n === 'ALOCAÇÕES' ? aba : null), getSpreadsheetTimeZone: () => 'America/Recife' })
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

console.log('== B52 as cinco abas renomeadas (migração sozinha, sem apagar nada)');
{
  const P = new Function(ler('nucleo.js') + '\nreturn {planoDeMigracaoDeAbas_, ABAS_NOMES_ANTIGOS_};')();
  const antigos = ['ALOCAÇÕES TABULADAS', 'ESCALA DO MÊS', 'GUARNIÇÃO', 'ESCALA OPERACIONAL', 'VIATURAS', 'ESCALAS', 'MODELOS DE GUARNIÇÃO', 'MILITARES'];
  let p = P.planoDeMigracaoDeAbas_(antigos);
  ver('os cinco nomes antigos viram os cinco novos',
    p.renomear.map(x => x.de + '>' + x.para).sort().join(' | ') ===
    'ALOCAÇÕES TABULADAS>ALOCAÇÕES | ESCALA DO MÊS>GRADE GERAL | ESCALA OPERACIONAL>ESCALA DO ORDINÁRIO | GUARNIÇÃO>ESCALA | VIATURAS>GUARNIÇÕES' && p.avisos.length === 0, p);
  ver('ESCALAS e MODELOS DE GUARNIÇÃO (nomes parecidos) não são tocadas',
    p.renomear.every(x => x.de !== 'ESCALAS' && x.de !== 'MODELOS DE GUARNIÇÃO' && x.para !== 'ESCALAS'));
  ver('cadeia inteira: MATRIZ termina como GRADE GERAL', JSON.stringify(P.planoDeMigracaoDeAbas_(['MATRIZ']).renomear) === '[{"de":"MATRIZ","para":"GRADE GERAL"}]');
  p = P.planoDeMigracaoDeAbas_(['MATRIZ', 'ESCALA DO MÊS']);
  ver('MATRIZ e ESCALA DO MÊS juntas: renomeia a mais recente e avisa da outra', p.renomear.length === 1 && p.renomear[0].de === 'ESCALA DO MÊS' && p.avisos.length === 1, p);
  p = P.planoDeMigracaoDeAbas_(['ALOCAÇÕES', 'ALOCAÇÕES TABULADAS']);
  ver('nova e antiga juntas: não renomeia nem apaga, usa a nova e avisa', p.renomear.length === 0 && /usa "ALOCAÇÕES"/.test(p.avisos[0]), p);
  ver('planilha já com os nomes novos: nada a fazer', (() => { const x = P.planoDeMigracaoDeAbas_(Object.keys(P.ABAS_NOMES_ANTIGOS_)); return !x.renomear.length && !x.avisos.length; })());
  ver('nenhuma das abas existe: nada a fazer', P.planoDeMigracaoDeAbas_(['MILITARES']).renomear.length === 0);
  ver('uma aba só "ESCALAS" não é confundida com a antiga de ESCALA', P.planoDeMigracaoDeAbas_(['ESCALAS']).renomear.length === 0);

  // camada do Sheets: abaAtual_ / migrarAbas_ sobre uma planilha de mentira
  const planilha = nomes => {
    const abas = nomes.map(n => ({ nome: n, dados: 'dados de ' + n, getName() { return this.nome; }, setName(x) { this.nome = x; } }));
    const criadas = [];
    const ss = {
      getSheets: () => abas, getSheetByName: n => abas.filter(a => a.nome === n)[0] || null,
      insertSheet: n => { const a = { nome: n, dados: '', getName() { return this.nome; }, setName(x) { this.nome = x; } }; abas.push(a); criadas.push(n); return a; }
    };
    const F = new Function('SpreadsheetApp', ['nucleo.js', 'matriz.js'].map(ler).join('\n') + '\nreturn {abaAtual_, migrarAbas_, avisosDeAbas_, abaDaEscala_, CONFIG};')({ getActive: () => ss });
    return { ss, abas, criadas, F };
  };
  let W = planilha(antigos);
  W.F.migrarAbas_();
  ver('migrarAbas_: as cinco ficam com os nomes novos, com os dados intactos',
    ['ALOCAÇÕES', 'GRADE GERAL', 'ESCALA', 'ESCALA DO ORDINÁRIO', 'GUARNIÇÕES'].every(n => W.ss.getSheetByName(n)) &&
    W.ss.getSheetByName('ALOCAÇÕES').dados === 'dados de ALOCAÇÕES TABULADAS' && W.ss.getSheetByName('ESCALA').dados === 'dados de GUARNIÇÃO', W.abas.map(a => a.nome));
  ver('nenhuma aba é criada e nenhuma fica com nome antigo', W.criadas.length === 0 && W.abas.length === antigos.length &&
    !['ALOCAÇÕES TABULADAS', 'ESCALA DO MÊS', 'GUARNIÇÃO', 'ESCALA OPERACIONAL', 'VIATURAS'].some(n => W.ss.getSheetByName(n)));
  ver('ESCALAS e MODELOS DE GUARNIÇÃO continuam como estavam', W.ss.getSheetByName('ESCALAS').dados === 'dados de ESCALAS' && !!W.ss.getSheetByName('MODELOS DE GUARNIÇÃO'));
  W.F.migrarAbas_();
  ver('rodar de novo não muda nada', W.abas.length === antigos.length && W.F.avisosDeAbas_().length === 0);
  W = planilha(['MATRIZ']);
  ver('abaDaEscala_ leva MATRIZ direto a GRADE GERAL', W.F.abaDaEscala_(W.ss, false).nome === 'GRADE GERAL' && W.abas[0].dados === 'dados de MATRIZ');
  W = planilha(['ALOCAÇÕES', 'ALOCAÇÕES TABULADAS']);
  ver('nova e antiga juntas: usa a nova, mantém a antiga e avisa',
    W.F.abaAtual_(W.ss, 'ALOCAÇÕES').dados === 'dados de ALOCAÇÕES' && !!W.ss.getSheetByName('ALOCAÇÕES TABULADAS') && W.F.avisosDeAbas_().length === 1);
  W = planilha(['MILITARES']);
  ver('aba que não existe: null, e abaDaEscala_ cria já com o nome novo',
    W.F.abaAtual_(W.ss, 'ALOCAÇÕES') === null && W.F.abaDaEscala_(W.ss, true).nome === 'GRADE GERAL' && W.criadas.join() === 'GRADE GERAL');
  ver('aba fora da lista é só getSheetByName', planilha(['MILITARES']).F.abaAtual_(planilha(['MILITARES']).ss, 'TURNOS') === null);
}

console.log('== B37 revisado (RN-07 a RN-12, RN-93, RN-96) cadastro de guarnições, viatura opcional');
{
  const L = new Function(['nucleo.js', 'cadastro_guarnicoes.js'].map(ler).join('\n') +
    '\nreturn {resolverGuarnicoes_, cnhAtende_, avaliarGuarnicao_, guarnicaoPorNome_, cadgLista_};')();
  // VIGÊNCIA, GUARNIÇÃO, VIATURA, TIPO, ATIVAR, PRIORIDADE, (TIPOS DE SERVIÇO, B58: não é mais lida), CNH, FUNÇÃO, MÍNIMO, MÁXIMO
  const l = (vig, guarnicao, viatura, tipo, ativar, prio, servicos, cnh, funcao, min, max, linha) =>
    ({ linha: linha, vigencia: vig, guarnicao: guarnicao, viatura: viatura, tipo: tipo, ativar: ativar, prioridade: prio, servicos: servicos, cnh: cnh, funcao: funcao, minimo: min, maximo: max });
  // uma guarnição COM viatura, uma SEM viatura (com motorista que exige CNH) e uma desativada
  const base = [
    l('', 'AR', 'AR', 'Auto Resgate', 'SIM', 1, '', 'D', 'MOTORISTA', 1, 1, 2),
    l('', 'AR', '', '', '', '', '', '', 'CHEFE', 1, 1, 3),
    l('', 'AR', '', '', '', '', '', '', 'SOCORRISTA', 1, 3, 4),
    l('', 'APOIO AQUARTELADO', '', 'Aquartelado', 'SIM', 2, 'Pronto', 'D', 'MOTORISTA ACO', 1, 1, 5),
    l('', 'APOIO AQUARTELADO', '', '', '', '', '', '', 'ADJUNTO DE DIA', 1, 1, 6),
    l('', 'ABTS', 'ABTS', 'Auto Bomba', 'NÃO', '', '', 'C', 'MOTORISTA', 1, 1, 7)
  ];
  let r = L.resolverGuarnicoes_(base, '2026-10');
  ver('lê as três guarnições, sem aviso', r.guarnicoes.length === 3 && r.avisos.length === 0, r.avisos);
  const ar = r.porId['AR'], aco = r.porId['APOIOAQUARTELADO'];
  ver('guarnição com viatura: a viatura vem preenchida', ar.viatura === 'AR' && ar.tipo === 'Auto Resgate', ar);
  ver('guarnição SEM viatura é válida e tem CNH própria (RN-96, RN-12)',
    aco.viatura === '' && aco.cnh.join() === 'D' && aco.funcoes.length === 2, aco);
  ver('AR: mínimo 3 e máximo 5 (RN-10, RN-11)',
    ar.funcoes.reduce((s, f) => s + f.minimo, 0) === 3 && ar.funcoes.reduce((s, f) => s + f.maximo, 0) === 5, ar.funcoes);
  ver('ordem de ativação pela prioridade; sem prioridade vai por último (RN-08)',
    r.guarnicoes.map(g => g.id).join() === 'AR,APOIO AQUARTELADO,ABTS', r.guarnicoes.map(g => g.id));
  ver('ATIVAR NÃO é respeitado (RN-07)', r.porId['ABTS'].ativar === false && r.guarnicoes.filter(g => g.ativar).length === 2);
  ver('B58 item 1 (RN-09): TIPOS DE SERVIÇO não é mais lido (o Apoio tinha "Pronto" e a guarnição não guarda isso)',
    !('servicos' in aco) && !('servicos' in ar), aco);
  ver('posto sem guarnição cadastrada: nada a cobrar e nenhum aviso',
    L.guarnicaoPorNome_(r, 'UTI móvel') === null && r.avisos.length === 0);
  ver('a guarnição é achada pelo nome, sem caixa/acento', L.guarnicaoPorNome_(r, 'apoio aquartelado') === aco);

  // RN-93: alterar a guarnição mínima não retroage
  const comMudanca = base.concat([l('2026-11', 'AR', '', '', '', '', '', '', 'SOCORRISTA', 2, 3, 20)]);
  ver('mês já fechado mantém o mínimo antigo (RN-93)', L.resolverGuarnicoes_(comMudanca, '2026-10').porId['AR'].funcoes.find(f => f.funcao === 'SOCORRISTA').minimo === 1);
  ver('o mês da vigência passa a usar o mínimo novo', L.resolverGuarnicoes_(comMudanca, '2026-11').porId['AR'].funcoes.find(f => f.funcao === 'SOCORRISTA').minimo === 2);
  ver('meses seguintes seguem com o valor novo', L.resolverGuarnicoes_(comMudanca, '2027-03').porId['AR'].funcoes.find(f => f.funcao === 'SOCORRISTA').minimo === 2);
  const trocaViatura = base.concat([l('2026-12', 'APOIO AQUARTELADO', 'ACO', '', '', '', '', '', '', '', '', 21)]);
  ver('a viatura também tem vigência: a guarnição pode ganhar viatura depois',
    L.resolverGuarnicoes_(trocaViatura, '2026-10').porId['APOIOAQUARTELADO'].viatura === '' &&
    L.resolverGuarnicoes_(trocaViatura, '2026-12').porId['APOIOAQUARTELADO'].viatura === 'ACO');
  const trocaPrio = base.concat([l('2026-12', 'ABTS', '', '', '', 1, '', '', '', '', '', 22), l('2026-12', 'AR', '', '', '', 3, '', '', '', '', '', 23)]);
  ver('a prioridade também tem vigência', L.resolverGuarnicoes_(trocaPrio, '2026-10').guarnicoes[0].id === 'AR' && L.resolverGuarnicoes_(trocaPrio, '2026-12').guarnicoes[0].id === 'ABTS');
  ver('MÁXIMO 0 tira a função da guarnição a partir da vigência',
    L.resolverGuarnicoes_(base.concat([l('2026-12', 'AR', '', '', '', '', '', '', 'SOCORRISTA', 0, 0, 24)]), '2026-12').porId['AR'].funcoes.map(f => f.funcao).join() === 'CHEFE,MOTORISTA');

  // avisos de linha ruim
  r = L.resolverGuarnicoes_([l('13/2026', 'AR', '', '', '', '', '', '', 'CHEFE', 1, 1, 2)], '2026-10');
  ver('vigência inválida: linha ignorada com aviso', r.guarnicoes.length === 0 && /vigência/.test(r.avisos[0]) && /GUARNIÇÕES, linha 2/.test(r.avisos[0]), r.avisos);
  r = L.resolverGuarnicoes_([l('', 'AR', '', '', '', '', '', '', 'CHEFE', 3, 1, 2)], '2026-10');
  ver('máximo menor que o mínimo: linha ignorada com aviso', r.guarnicoes.length === 0 && /menor que o mínimo/.test(r.avisos[0]), r.avisos);
  r = L.resolverGuarnicoes_([l('', 'AR', '', '', '', '', '', '', 'CHEFE', 'dois', 1, 2)], '2026-10');
  ver('mínimo não numérico: linha ignorada com aviso', r.guarnicoes.length === 0 && /números inteiros/.test(r.avisos[0]), r.avisos);
  ver('linha sem nome de guarnição é ignorada em silêncio', L.resolverGuarnicoes_([l('', '', 'AR', '', '', '', '', '', 'CHEFE', 1, 1, 2)], '2026-10').guarnicoes.length === 0);

  // RN-12: CNH
  ver('CNH exigida D e militar com D: atende', L.cnhAtende_(['D'], ['D']) === true);
  ver('CNH exigida D e militar com B: não atende', L.cnhAtende_(['B'], ['D']) === false);
  ver('militar com "B, D" atende a D (a hierarquia é cadastro, não código)', L.cnhAtende_(L.cadgLista_('B, D'), ['D']) === true);
  ver('guarnição sem CNH exigida: qualquer um atende', L.cnhAtende_([], []) === true && L.cnhAtende_(['B'], []) === true);
  ver('militar sem CNH cadastrada não atende exigência', L.cnhAtende_([], ['D']) === false);

  // RN-10 / RN-11
  let g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1, SOCORRISTA: 1 });
  ver('mínimo atendido: guarnição ativa (RN-10)', g.ativa === true && g.faltando.length === 0, g);
  g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1 });
  ver('faltando socorrista: não é ativada e o relatório diz o que falta (RN-10)',
    g.ativa === false && g.faltando.length === 1 && g.faltando[0].funcao === 'SOCORRISTA' && g.faltando[0].falta === 1, g);
  g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1, SOCORRISTA: 3 });
  ver('no máximo não sobra vaga (RN-11)', g.vagas.SOCORRISTA === 0 && g.vagas.MOTORISTA === 0 && g.ativa === true, g.vagas);
  g = L.avaliarGuarnicao_(ar, { MOTORISTA: 1, CHEFE: 1, SOCORRISTA: 4 });
  ver('acima do máximo é apontado (RN-11)', g.excedendo.length === 1 && g.excedendo[0].funcao === 'SOCORRISTA', g.excedendo);
  ver('guarnição sem função cadastrada não bloqueia nada', L.avaliarGuarnicao_(null, {}).ativa === true);
  ver('máximo em branco = sem limite', L.avaliarGuarnicao_(L.resolverGuarnicoes_([l('', 'X', '', '', '', '', '', '', 'CHEFE', 1, '', 2)], '2026-10').porId['X'], { CHEFE: 9 }).vagas.CHEFE === null);
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
  const L = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'cadastro_guarnicoes.js', 'guarnicao.js'].map(ler).join('\n') +
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

console.log('== B37 revisado (camada do Sheets) cadastro antigo de viaturas e migração');
{
  // planilha de mentira com a aba GUARNIÇÕES no formato ANTIGO (coluna VIATURA, sem GUARNIÇÃO)
  const planilha = (cab, linhas) => {
    const v = [cab].concat(linhas);
    const aba = {
      nome: 'GUARNIÇÕES', v: v,
      getName() { return this.nome; }, setName(n) { this.nome = n; },
      isSheetHidden: () => false, showSheet() {}, setColumnWidth() {}, setFrozenRows() {}, getLastRow() { return this.v.length; },
      getLastColumn() { return Math.max.apply(null, this.v.map(r => r.length)); },
      insertColumnBefore(i) { this.v.forEach(r => { while (r.length < i - 1) r.push(''); r.splice(i - 1, 0, ''); }); },
      deleteColumn(i) { this.v.forEach(r => r.splice(i - 1, 1)); },
      getDataRange() { return this.getRange(1, 1, this.v.length, this.getLastColumn()); },
      getRange(r, c, nr, nc) {
        const s = this; nr = nr || 1; nc = nc || 1;
        const R = {
          getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((s.v[r - 1 + i] || [])[c - 1 + j] === undefined ? '' : s.v[r - 1 + i][c - 1 + j]); o.push(row); } return o; },
          getValue() { return R.getValues()[0][0]; },
          getDisplayValues() { return R.getValues().map(row => row.map(x => String(x))); },
          setValues(m) { m.forEach((row, i) => { while (s.v.length < r + i) s.v.push([]); row.forEach((x, j) => { const t = s.v[r - 1 + i]; while (t.length < c + j) t.push(''); t[c - 1 + j] = x; }); }); return P; },
          setValue(x) { return R.setValues([[x]]); }
        };
        const P = new Proxy(R, { get(t, k) { if (k in t) return t[k]; return () => P; } });
        return P;
      }
    };
    const ss = { getSheets: () => [aba], getSheetByName: n => (aba.nome === n ? aba : null), getSpreadsheetTimeZone: () => 'America/Recife', insertSheet: n => { aba.nome = n; return aba; }, setActiveSheet() {} };
    const F = new Function('SpreadsheetApp', 'Utilities', 'LockService',
      ['nucleo.js', 'matriz.js', 'cadastro_guarnicoes.js', 'cadastro_guarnicoes_painel.js'].map(ler).join('\n') +
      '\nreturn {cadgLerLinhas_, guarnicoesDoMes_, cadgMigrarParaGuarnicoes_, cadgRetirarTiposDeServico_, CADG_CABECALHO_};')(
      { getActive: () => ss, newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } }) },
      { formatDate: () => '' }, { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) });
    return { aba, ss, F };
  };
  const CAB_ANTIGO = ['VIGÊNCIA (A PARTIR DE)', 'VIATURA', 'TIPO', 'ATIVAR', 'PRIORIDADE', 'TIPOS DE SERVIÇO', 'CNH', 'FUNÇÃO', 'MÍNIMO', 'MÁXIMO'];
  let W = planilha(CAB_ANTIGO, [['', 'AR', 'Auto Resgate', 'SIM', 1, '', 'D', 'MOTORISTA', 1, 1], ['', 'AR', '', '', '', '', '', 'CHEFE', 1, 1]]);
  let r = W.F.guarnicoesDoMes_('2026-11', 'America/Recife');
  ver('cadastro antigo: cada VIATURA vale como guarnição com o mesmo nome',
    r.existe && r.guarnicoes.length === 1 && r.guarnicoes[0].id === 'AR' && r.guarnicoes[0].viatura === 'AR' && r.guarnicoes[0].cnh.join() === 'D', r.guarnicoes);
  ver('e o painel avisa para migrar', r.semColunaGuarnicao === true && r.avisos.some(a => /cadastro antigo/.test(a)), r.avisos);

  const m = W.F.cadgMigrarParaGuarnicoes_();
  ver('migrar: cria a coluna GUARNIÇÃO antes da VIATURA e copia o nome', m.migrou === true && m.linhas === 2 &&
    W.aba.v[0][1] === 'GUARNIÇÃO' && W.aba.v[0][2] === 'VIATURA' && W.aba.v[1][1] === 'AR' && W.aba.v[1][2] === 'AR', W.aba.v.slice(0, 2));
  ver('nada é apagado: as outras colunas continuam na mesma ordem',
    W.aba.v[0].join('|') === 'VIGÊNCIA (A PARTIR DE)|GUARNIÇÃO|VIATURA|TIPO|ATIVAR|PRIORIDADE|TIPOS DE SERVIÇO|CNH|FUNÇÃO|MÍNIMO|MÁXIMO', W.aba.v[0]);
  r = W.F.guarnicoesDoMes_('2026-11', 'America/Recife');
  ver('depois de migrar o aviso some e o cadastro é lido igual', r.semColunaGuarnicao === false && r.guarnicoes[0].id === 'AR' && r.avisos.length === 0, r);
  ver('migrar de novo não faz nada', W.F.cadgMigrarParaGuarnicoes_().migrou === false);

  // já no formato novo, com guarnição SEM viatura
  // B58 item 1: TIPOS DE SERVIÇO ficou na planilha migrada, vazia; o botão de criar colunas a apaga
  ver('B58 item 1: TIPOS DE SERVIÇO vazia é apagada, e o resto do cadastro fica igual',
    W.F.cadgRetirarTiposDeServico_() === 'apagada' && W.aba.v[0].join('|') === W.F.CADG_CABECALHO_.join('|') &&
    W.aba.v[1].join('|') === '|AR|AR|Auto Resgate|SIM|1|D|MOTORISTA|1|1' && W.F.guarnicoesDoMes_('2026-11', 'America/Recife').guarnicoes[0].cnh.join() === 'D', W.aba.v);
  ver('B58 item 1: sem a coluna, nada a fazer', W.F.cadgRetirarTiposDeServico_() === '');
  W = planilha(['VIGÊNCIA (A PARTIR DE)', 'GUARNIÇÃO', 'VIATURA', 'TIPO', 'ATIVAR', 'PRIORIDADE', 'TIPOS DE SERVIÇO', 'CNH', 'FUNÇÃO', 'MÍNIMO', 'MÁXIMO'], [['', 'AR', 'AR', '', 'SIM', 1, 'Pronto', 'D', 'MOTORISTA', 1, 1]]);
  r = W.F.guarnicoesDoMes_('2026-11', 'America/Recife');
  ver('B58 item 1: TIPOS DE SERVIÇO preenchida não é apagada, não é lida, e o resumo avisa',
    W.F.cadgRetirarTiposDeServico_() === 'preenchida' && W.aba.v[0].length === 11 && r.guarnicoes[0].cnh.join() === 'D' &&
    r.avisos.some(a => /TIPOS DE SERVIÇO, preenchida em 1 linha/.test(a) && /não é mais lida/.test(a)), r.avisos);

  W = planilha(W.F.CADG_CABECALHO_, [['', 'APOIO AQUARTELADO', '', 'Aquartelado', 'SIM', 1, 'D', 'MOTORISTA ACO', 1, 1]]);
  r = W.F.guarnicoesDoMes_('2026-11', 'America/Recife');
  ver('guarnição sem viatura é lida e exige CNH (RN-96, RN-12)',
    r.guarnicoes[0].id === 'APOIO AQUARTELADO' && r.guarnicoes[0].viatura === '' && r.guarnicoes[0].cnh.join() === 'D' && !r.semColunaGuarnicao, r.guarnicoes);
  ver('no formato novo não há aviso de migração', r.avisos.length === 0, r.avisos);
  ver('sem a aba, o cadastro vem vazio e nada quebra', (() => {
    const X = planilha(W.F.CADG_CABECALHO_, []); X.aba.nome = 'OUTRA';
    const y = X.F.guarnicoesDoMes_('2026-11', 'America/Recife');
    return y.existe === false && y.guarnicoes.length === 0;
  })());
}

console.log('== B54 (RN-12, RN-81) a célula diz por que a lista suspensa está vazia');
{
  const L = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'cadastro_guarnicoes.js', 'guarnicao.js'].map(ler).join('\n') +
    '\nreturn {motivoDaLista_};')();
  const p = x => Object.assign({ funcao: 'CHEFE', unidade: 'AR', exigeCnh: false, escalaTodos: false, candidatos: 3, motoristas: 1, habilitados: 1, exigida: [], temColunaCnh: true }, x);

  ver('posto comum com candidatos: nenhuma nota', L.motivoDaLista_(p()) === '');
  let t = L.motivoDaLista_(p({ candidatos: 0 }));
  ver('posto comum sem ninguém escalado: nota explica e diz o que fazer',
    /Sem lista/.test(t) && /nenhum militar está escalado neste serviço, dia e turno/.test(t) && /monte a grade de novo/.test(t), t);
  ver('escala TODOS sem ninguém: a nota não manda escalar', !/monte a grade de novo/.test(L.motivoDaLista_(p({ candidatos: 0, escalaTodos: true }))));

  // posto de condutor (B38/RN-12): a nota sempre explica a restrição
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: ['D'], habilitados: 2 }));
  ver('posto de condutor com habilitados: diz a regra e quantos são',
    /quadro de motoristas/.test(t) && /CNH D/.test(t) && /guarnição AR/.test(t) && /2 habilitado\(s\)/.test(t), t);
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: ['D'], habilitados: 0, motoristas: 0, candidatos: 4 }));
  ver('nenhum escalado é motorista: a nota diz isso', /Sem lista/.test(t) && /nenhum está marcado como motorista/.test(t) && /4 militares/.test(t), t);
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: ['D'], habilitados: 0, motoristas: 2, candidatos: 4 }));
  ver('motoristas sem a categoria: a nota diz qual categoria falta', /Sem lista/.test(t) && /nenhum tem CNH D/.test(t) && /2 motorista\(s\)/.test(t), t);
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: ['D'], habilitados: 0, motoristas: 2, candidatos: 4, temColunaCnh: false }));
  ver('sem a coluna CNH em MILITARES a nota diz que ninguém tem categoria cadastrada', /não tem a coluna CNH/.test(t), t);
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: [], habilitados: 0, motoristas: 0, candidatos: 0 }));
  ver('posto de condutor sem ninguém no turno: a nota começa pelo motivo', /Sem lista/.test(t) && /nenhum militar está escalado/.test(t), t);
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: [], habilitados: 3, cadastrada: true }));
  ver('guarnição cadastrada sem CNH exigida: a nota só fala do quadro de motoristas', /quadro de motoristas/.test(t) && !/CNH/.test(t), t);
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: [], habilitados: 3, cadastrada: false, unidade: 'AR' }));
  ver('UNIDADE do posto fora do cadastro: a nota aponta o nome que não casa',
    /A guarnição "AR" do posto não está na aba GUARNIÇÕES/.test(t) && /UNIDADE em MODELOS DE GUARNIÇÃO/.test(t), t);
  t = L.motivoDaLista_(p({ exigeCnh: true, exigida: [], habilitados: 3, cadastrada: false, unidade: '' }));
  ver('posto de condutor sem UNIDADE: a nota diz que não há guarnição para exigir categoria', /não tem UNIDADE/.test(t), t);
}

console.log('== B57 (RN-12) leitura do "sim" da coluna MOTORISTA');
{
  const L = new Function(['nucleo.js', 'cadastro_guarnicoes.js', 'matriz.js'].map(ler).join('\n') + '\nreturn {simDaCelula_, relatorioMotoristas_};')();
  ver('"Sim", "SIM", "sim" e "S" contam como sim', ['Sim', 'SIM', 'sim', 'S', ' Sim '].every(x => L.simDaCelula_(x, '')));
  ver('caixa de seleção marcada (true) conta como sim', L.simDaCelula_(true, 'TRUE'));
  ver('"Não", "-", vazio e false não contam', ['Não', 'NÃO', '-', '', null, false].every(x => !L.simDaCelula_(x, '')));
  ver('valor que não é texto, mas exibido como "Sim", conta (coluna tipada da Tabela)', L.simDaCelula_({ chip: 1 }, 'Sim') === true);
  ver('o exibido "Não" não vira sim', L.simDaCelula_({ chip: 1 }, 'Não') === false);
  const t = { cab: ['MATRICULA', 'MOTORISTA'], linhas: [['1', 'Sim'], ['', ''], ['2', 'Não']], exibidos: [['1', 'Sim'], ['', ''], ['2', 'Não']] };
  const r = L.relatorioMotoristas_(t, { mat: 0, motorista: 1 }, [{ motorista: true, cnh: [] }, { motorista: false, cnh: ['D'] }]);
  ver('o relatório do diagnóstico traz índice, cabeçalho, contagens e o valor bruto',
    r.indiceMotorista === 1 && r.cabecalhoNesseIndice === 'MOTORISTA' && r.motoristas === 1 && r.comCnh === 1 &&
    r.amostra.length === 2 && r.amostra[0].motorista.json === '"Sim"' && r.amostra[0].motorista.codigos.join() === '83,105,109' && r.amostra[1].linhaDaPlanilha === 4, r);
}

console.log('== B48 (RN-94, RN-81) a função aparece como nota na célula da grade geral');
{
  const L = new Function(['nucleo.js', 'choques.js', 'sincronia.js'].map(ler).join('\n') + '\nreturn {notasDeFuncao_, montarRotulos_, montarHorarios_};')();
  const hor = L.montarHorarios_([['Pronto', 'A', '08:00', '20:00'], ['Pronto', 'B', '20:00', '08:00'], ['JES', 'A', '08:00', '20:00']].map(t => ({ servico: t[0], turno: t[1], inicio: t[2], fim: t[3] }))).porChave;
  const pares = {}; Object.keys(hor).forEach(k => pares[k] = true);
  const rot = L.montarRotulos_(hor, pares);
  const rotA = rot.lista.find(x => /^Pronto 08/.test(x)), rotB = rot.lista.find(x => /^Pronto 20/.test(x)), rotJ = rot.lista.find(x => /^JES/.test(x));
  const linhas = [{ mat: 'M1' }, { mat: 'M1' }, { mat: 'M2' }];
  const dias = ['2026-11-03', '2026-11-04'];
  const cel = [[rotA, rotB], ['', rotJ], [rotA, '']];
  const alocs = [
    { mat: 'M1', dia: '2026-11-03', servico: 'Pronto', turno: 'A', funcao: 'MOTORISTA', unidade: 'AR' },
    { mat: 'M1', dia: '2026-11-04', servico: 'Pronto', turno: 'B', funcao: '' },
    { mat: 'M1', dia: '2026-11-04', servico: 'JES', turno: 'A', funcao: 'CHEFE' },
    { mat: 'M2', dia: '2026-11-03', servico: 'Pronto', turno: 'A', funcao: 'COMBATENTE' }
  ];
  const n = L.notasDeFuncao_(linhas, dias, cel, rot, alocs);
  ver('a nota traz a função (e a unidade, quando há)', n[0][0] === 'Função: MOTORISTA (AR)' && n[2][0] === 'Função: COMBATENTE', n);
  ver('sem função atribuída, sem nota', n[0][1] === '');
  ver('na 2ª linha do militar, a nota é da alocação daquela célula', n[1][1] === 'Função: CHEFE' && n[1][0] === '', n[1]);
  ver('célula vazia não tem nota', n[2][1] === '');
  ver('a matriz de notas tem o tamanho da grade', n.length === 3 && n.every(l => l.length === 2));
  ver('célula com texto que não é serviço não ganha nota', L.notasDeFuncao_([{ mat: 'M1' }], ['2026-11-03'], [['xyz']], rot, alocs)[0][0] === '');
}

console.log('== B49 item 2 (RN-13, RN-94) a origem do serviço vem da coluna ORIGEM de TURNOS');
{
  const L = new Function(['nucleo.js'].map(ler).join('\n') + '\nreturn {origemDoServico_};')();
  const cad = { 'JES|A': 'PJES', 'JES': 'PJES', 'Saldo|A': 'SALDO ADM', 'Diária Bioma|A': 'DIÁRIA' };
  ver('serviço com ORIGEM cadastrada usa a origem do cadastro', L.origemDoServico_('JES', cad, 'A') === 'PJES');
  ver('o cadastro vale por turno', L.origemDoServico_('Saldo', cad, 'A') === 'SALDO ADM');
  ver('turno sem ORIGEM própria usa a de outro turno do serviço', L.origemDoServico_('JES', cad, 'B') === 'PJES');
  ver('serviço sem ORIGEM cadastrada mantém o comportamento atual: o próprio nome em maiúsculas',
    L.origemDoServico_('Pronto', cad, 'A') === 'PRONTO' && L.origemDoServico_('Saldo', cad, 'B') === 'SALDO');
  ver('sem cadastro nenhum, nada é inventado: JES aparece como JES', L.origemDoServico_('JES', {}, 'A') === 'JES');
  ver('a comparação do serviço é sem caixa/acento', L.origemDoServico_('diaria bioma', cad, 'A') === 'DIÁRIA');
  ver('uma origem nova cadastrada vale sem mexer no código', L.origemDoServico_('Eleições', { 'Eleições': 'TRE' }, 'A') === 'TRE');

  const G = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'cadastro_guarnicoes.js', 'guarnicao.js'].map(ler).join('\n') + '\nreturn {linhasParaImpressao_};')();
  const esc = { servicos: ['Pronto', 'JES'], turnos: ['A'], dias: 'TODOS' };
  const grade = { linhas: [{ dia: '2026-11-03', turno: 'A', unidade: '', funcao: 'MOTORISTA', mat: 'M1', servico: 'JES' }, { dia: '2026-11-03', turno: 'A', unidade: '', funcao: 'CHEFE', mat: 'M2', servico: 'Pronto' }] };
  let li = G.linhasParaImpressao_(grade, esc, {}, {}, { 'JES|A': 'PJES' });
  ver('impressão: a função leva a origem do cadastro (MOTORISTA - PJES)', li[0].funcao === 'MOTORISTA - PJES' && li[1].funcao === 'CHEFE - PRONTO', li.map(x => x.funcao));
  li = G.linhasParaImpressao_(grade, esc, {}, {}, {});
  ver('impressão sem a coluna ORIGEM: o nome do serviço', li[0].funcao === 'MOTORISTA - JES', li.map(x => x.funcao));
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
