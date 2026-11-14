// Testes da P18 (choque JES × expediente, diárias sem filtro de voluntário JES, escala com N serviços).
// Uso: node testes/teste_p18.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(dir, f), 'utf8');

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 600) : '')); } };

const fontes = ['abertura_automatica.js', 'distribuicao_cotas.js', 'regras_escala.js', 'choques.js', 'sincronia.js', 'nucleo.js', 'pre_escala.js', 'guarnicao.js', 'cadastro_guarnicoes.js'].map(ler).join('\n');
const L = new Function(fontes + '\nreturn {detectarChoques_, montarHorarios_, calcularSincronizacao_, expedienteImplicito_, expedienteChocaCom_, distribuirCotas_, servicoDaOperacao_};')();

// a aba TURNOS da sandbox (o que importa: horários e TIPO DE SERVIÇO)
const hor = L.montarHorarios_([
  { servico: 'Pronto', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'Pronto', turno: 'B', inicio: '20:00', fim: '08:00' },
  { servico: 'Adm', turno: 'A', inicio: '08:00', fim: '16:00' },
  { servico: 'JES', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'JES', turno: 'B', inicio: '20:00', fim: '08:00' },
  { servico: 'Defensoria', turno: 'A', inicio: '07:00', fim: '19:00' },
  { servico: 'Bioma', turno: 'A', inicio: '06:00', fim: '18:00' }, { servico: 'PE Seguro', turno: 'A', inicio: '08:00', fim: '20:00' },
  { servico: 'Saldo', turno: 'A', inicio: '08:00', fim: '20:00' }
]).porChave;
const TIPOS = { Pronto: 'Ordinário', Adm: 'Ordinário', Saldo: 'Ordinário', JES: 'PJES', Defensoria: 'PJES', CPRH: 'PJES', Bioma: 'Diária', 'PE Seguro': 'Diária', 'Eleições': 'Diária' };

console.log('== P18 item 1 (B67; RN-25, RN-17) JES não choca com o expediente invisível do Adm; diária choca');
{
  // ST BM ADELSON BARROS (Adm, RN-17 desligada) · 06/10/2026 (terça, dia útil)
  const exp = L.expedienteImplicito_({ mats: ['707170-1'], dias: ['2026-10-06'], servico: 'Adm', turno: 'A' });
  const com = (servico, turno) => L.detectarChoques_(exp.concat([{ mat: '707170-1', dia: '2026-10-06', servico, turno }]), hor, { mes: '2026-10', tipos: TIPOS }).choques;

  ver('o caso do relato: JES 08–20 no dia de expediente não é choque', com('JES', 'A').length === 0, com('JES', 'A'));
  ver('Bioma (Diária) no mesmo dia continua chocando com o expediente', com('Bioma', 'A').length === 1 && com('Bioma', 'A')[0].tipo === 'expediente', com('Bioma', 'A'));
  ver('PE Seguro (Diária) também', com('PE Seguro', 'A').length === 1);
  ver('Defensoria (PJES) não choca com o expediente', com('Defensoria', 'A').length === 0);
  ver('a escrita do tipo não importa ("DIARIA", "diária")', L.expedienteChocaCom_({ implicito: true }, { servico: 'X' }, { X: 'DIARIA' }) && L.expedienteChocaCom_({ servico: 'X' }, { implicito: true }, { X: 'diária' }));
  ver('serviço sem tipo cadastrado não choca com o expediente', !L.expedienteChocaCom_({ implicito: true }, { servico: 'Novo' }, TIPOS));

  // os choques reais continuam valendo
  const doisReais = L.detectarChoques_([{ mat: 'm', dia: '2026-10-06', servico: 'JES', turno: 'A' }, { mat: 'm', dia: '2026-10-06', servico: 'Pronto', turno: 'A' }], hor, { tipos: TIPOS }).choques;
  ver('JES × Pronto no mesmo horário continua sendo choque (só o expediente mudou)', doisReais.length === 1 && doisReais[0].tipo === 'sobreposicao', doisReais);
  const emenda = L.detectarChoques_([{ mat: 'm', dia: '2026-10-06', servico: 'JES', turno: 'B' }, { mat: 'm', dia: '2026-10-07', servico: 'Pronto', turno: 'A' }], hor, { tipos: TIPOS }).choques;
  ver('emenda JES → Pronto continua proibida', emenda.length === 1 && emenda[0].tipo === 'emenda', emenda);
  ver('sem a lista de tipos, o comportamento antigo fica (nada some em silêncio)', L.detectarChoques_(exp.concat([{ mat: '707170-1', dia: '2026-10-06', servico: 'JES', turno: 'A' }]), hor, {}).choques.length === 1);

  // de ponta a ponta: salvar no Mostrar Grade Geral (o caminho do relato)
  const todas = exp.slice();
  const salvar = (servico, turno) => L.calcularSincronizacao_([], [{ mat: '707170-1', dia: '2026-10-06', servico, turno }], [], {},
    { horarios: hor, todas, regras: { adm: { '707170-1': true }, tipos: TIPOS, voluntariosJes: { '707170-1': true } } });
  const rJes = salvar('JES', 'A');
  ver('salvar o JES do relato: grava, sem "choca com o expediente do Adm"', rJes.inserir.length === 1 && rJes.choques.length === 0, { inserir: rJes.inserir, choques: rJes.choques, regras: rJes.regras });
  const rBioma = salvar('Bioma', 'A');
  ver('salvar um Bioma no mesmo dia: bloqueado por choque com o expediente', rBioma.inserir.length === 0 && rBioma.choques.length === 1 && rBioma.choques[0].com[0].implicito === true, rBioma.choques);
}

console.log('== P18 item 2 (B50; RN-04, RN-46, RN-39) diária não exige VOLUNTÁRIO JES; JES continua exigindo');
{
  const dias = ['2026-11-03', '2026-11-04'];
  const roda = (servico, vol, voluntariosJes, extra) => L.distribuirCotas_(Object.assign({
    mes: '2026-11',
    operacoes: [{ nome: servico, servico, prioridade: 1, dias, turnos: [{ turno: 'A', vagas: 1 }] }],
    cotas: [{ id: 'C1', operacao: servico, quantidade: 10, origem: 'interna' }],
    militares: [{ mat: 'NAOVOL' }, { mat: 'VOL' }], voluntariado: vol, alocacoes: [], expediente: [],
    horarios: hor, tipos: TIPOS, voluntariosJes
  }, extra || {}));
  const so = mat => dias.map(dia => ({ mat, dia, turno: 'A', servico: 'todos' }));
  const vjes = { VOL: true };            // NAOVOL tem VOLUNTÁRIO JES = não

  let r = roda('PE Seguro', so('NAOVOL'), vjes);
  ver('o aceite: militar não voluntário JES que preencheu o formulário entra na diária (PE Seguro)',
    r.novas.length === 2 && r.novas.every(n => n.mat === 'NAOVOL' && n.fase === 'voluntaria'), r.novas);
  r = roda('Bioma', so('NAOVOL'), vjes);
  ver('o mesmo vale para o Bioma', r.novas.length === 2 && r.novas.every(n => n.mat === 'NAOVOL'), r.novas);

  r = roda('JES', so('NAOVOL'), vjes);
  ver('JES: o não voluntário que se ofereceu NÃO entra', r.novas.length === 0, r.novas);
  ver('e a vaga vazia diz o motivo (RN-46)', r.vazias.length === 2 && r.vazias.every(v => /VOLUNTÁRIO JES = sim \(RN-46\)/.test(v.motivo)), r.vazias);
  r = roda('JES', so('NAOVOL').concat(so('VOL')), vjes);
  ver('JES: entre os dois, só o voluntário entra', r.novas.length === 2 && r.novas.every(n => n.mat === 'VOL'), r.novas);
  // fase compulsória (RN-41): quem preencheu o formulário, mesmo sem se oferecer naquele dia
  r = roda('JES', [{ mat: 'NAOVOL', dia: '2026-11-20', turno: 'A', servico: 'todos' }], vjes);
  ver('JES compulsório também não sorteia o não voluntário', r.novas.length === 0, r.novas);
  r = roda('PE Seguro', [{ mat: 'NAOVOL', dia: '2026-11-20', turno: 'A', servico: 'todos' }], vjes);
  ver('diária compulsória aceita o não voluntário JES que preencheu o formulário (RN-41)', r.novas.length === 2 && r.novas.every(n => n.fase === 'compulsoria'), r.novas);
  r = roda('JES', so('NAOVOL'), null);
  ver('sem a coluna VOLUNTÁRIO JES em MILITARES, ninguém é barrado (como antes)', r.novas.length === 2, r.novas);

  // o painel não corta mais as linhas antes da distribuição
  const painel = ler('distribuicao_cotas_painel.js');
  ver('o painel passa TODAS as linhas do VOLUNTARIADO e a lista de voluntários JES para a distribuição',
    /voluntariado: vol\.linhas/.test(painel) && /voluntariosJes: vjes/.test(painel) && !/voluntariado: sep\.linhas/.test(painel));
}

console.log('== P18 item 3 (B63; RN-09, RN-100, RN-13, RN-83) uma escala agrupa N serviços');
{
  const G = new Function(['nucleo.js', 'choques.js', 'sincronia.js', 'cadastro_guarnicoes.js', 'guarnicao.js'].map(ler).join('\n') +
    '\nreturn {resolverGuarnicoes_, vinculosParaModelo_, montarModelosGuarnicao_, montarGrade_, calcularGuarnicao_, expandirSlots_, funcoesPorServico_};')();
  // o cadastro da sandbox em 14/11
  const c = (g, viat, prio, cnh, funcao, min, max, linha) => ({ linha, vigencia: '2026-01', guarnicao: g, viatura: viat, tipo: '', ativar: 'SIM', prioridade: prio, cnh, funcao, minimo: min, maximo: max });
  const cad = G.resolverGuarnicoes_([
    c('UTI - PRONTO', 'ABT', 1, '', 'CHEFE', 1, 1, 2), c('UTI - PRONTO', 'ABT', 1, '', 'CHEFE DE 2ª LINHA', 1, 1, 3),
    c('UTI - PRONTO', 'ABT', 1, '', 'COMBATENTE', 1, 1, 4), c('UTI - PRONTO', 'ABT', 1, '', 'AUXILIAR DE LINHA', 0, 1, 5),
    c('UTI - PRONTO', 'ABT', 1, 'D', 'MOTORISTA', 1, 1, 6),
    c('UTAPH - PRONTO', 'AR', 2, 'D', 'MOTORISTA', 1, 1, 7), c('UTAPH - PRONTO', 'AR', 2, '', 'CHEFE', 1, 1, 8), c('UTAPH - PRONTO', 'AR', 2, '', 'SOCORRISTA', 1, 3, 9),
    c('Apoio Aquartelado', '', 3, '', 'ADJUNTO', 1, 1, 10), c('Apoio Aquartelado', 'ACO', 3, 'B', 'MOTORISTA DE ACO', 1, 1, 11),
    c('Apoio Aquartelado', '', 3, '', 'DESPACHANTE 1', 1, 1, 12), c('Apoio Aquartelado', '', 3, '', 'DESPACHANTE 2', 1, 1, 13),
    c('UTS - PRONTO', 'ABSA', 4, 'B', 'MOTORISTA', 1, 1, 14),
    c('Guardiões do Bioma', 'ABSL', '', 'B', 'MOTORISTA', 1, 1, 15), c('Guardiões do Bioma', 'ABSL', '', '', 'COMBATENTE', 1, 2, 16)
  ], '2026-11');
  const v = (linha, escala, guarnicao) => ({ linha, vigencia: '2026-01', escala, turno: '', guarnicao });
  const vinc = G.vinculosParaModelo_([v(2, 'Bioma', 'Guardiões do Bioma'), v(6, 'Ordinário', 'Apoio Aquartelado'), v(7, 'Ordinário', 'UTI - PRONTO'),
    v(8, 'Ordinário', 'UTAPH - PRONTO'), v(9, 'Ordinário', 'UTS - PRONTO')], cad, '2026-11');
  const tps = { Pronto: ['A', 'B'], Adm: ['A'], JES: ['A', 'B'], Bioma: ['A', 'B', 'C'], Saldo: ['A', 'B'] };
  const E = (escala, servicos, militares) => ({ escala, servicos, titulo: 'ESCALA DE SERVIÇO', militares: militares || 'TODOS', dias: 'TODOS' });
  const sandbox = [E('Bioma', 'Bioma'), E('Ordinário', 'Pronto'), E('Ordinário', 'JES'), E('Ordinário', 'Saldo')];
  const mod = G.montarModelosGuarnicao_(sandbox, vinc.linhas, tps);
  const ord = mod.escalas['Ordinário'];

  ver('o aceite: a escala "Ordinário" (3 linhas em ESCALAS) é cadastrada com Pronto, JES e Saldo', ord && ord.servicos.join() === 'Pronto,JES,Saldo', ord && ord.servicos);
  ver('sem nenhum aviso de "escala/serviço não existe" nem de linha repetida', !mod.avisos.some(a => /não existe|mais de uma vez|ignorada/.test(a)), mod.avisos);
  ver('MILITARES = TODOS continua TODOS com N serviços (antes virava ESCALADOS)', ord.militares === 'TODOS' && !mod.avisos.some(a => /só vale com um único serviço/.test(a)), mod.avisos);
  ver('os turnos da escala são os dos três serviços, sem repetir (A, B)', ord.turnos.join() === 'A,B', ord.turnos);
  const postosA = G.expandirSlots_(ord, 'A');
  // 5 do ABT (com o auxiliar, máximo 1) + 5 do AR (socorrista até 3) + 4 do apoio + 1 do UTS = 15
  ver('o aceite: as guarnições NÃO são triplicadas — um conjunto de postos por turno (15), não um por serviço',
    postosA.length === 15 && new Set(postosA.map(p => p.unidade)).size === 4, postosA.map(p => p.unidade + '/' + p.funcao));
  ver('a mesma forma numa linha só ("Pronto, JES, Saldo") dá o mesmo resultado',
    JSON.stringify(G.montarModelosGuarnicao_([E('Ordinário', 'Pronto, JES, Saldo')], vinc.linhas.filter(l => l.escala === 'Ordinário'), tps).escalas['Ordinário'].servicos) === JSON.stringify(ord.servicos));
  ver('as escalas de um serviço continuam iguais (Bioma)', mod.escalas.Bioma.servicos.join() === 'Bioma' && mod.escalas.Bioma.militares === 'TODOS');

  // o 2º sintoma do relato: SERVIÇOS vazio, e o nome da escala não é serviço
  const sem = G.montarModelosGuarnicao_([E('Ordinário', '')], vinc.linhas, tps);
  ver('SERVIÇOS vazio e escala que não é nome de serviço: o aviso diz o que escrever', !sem.escalas['Ordinário'] &&
    sem.avisos.some(a => /coluna SERVIÇOS está vazia/.test(a) && /Pronto, JES, Saldo/.test(a)), sem.avisos);
  ver('SERVIÇOS vazio numa escala com o nome de um serviço continua valendo (Bioma → Bioma)', G.montarModelosGuarnicao_([E('Bioma', '')], vinc.linhas, tps).escalas.Bioma.servicos.join() === 'Bioma');
  const errado = G.montarModelosGuarnicao_([E('Ordinário', 'Pronto'), E('Ordinário', 'Ordinario')], vinc.linhas, tps);
  ver('um serviço que não existe na aba TURNOS ainda derruba a escala, com aviso que o nomeia', !errado.escalas['Ordinário'] && errado.avisos.some(a => /o serviço "Ordinario" não existe na aba TURNOS/.test(a)), errado.avisos);
  const difere = G.montarModelosGuarnicao_([E('Ordinário', 'Pronto', 'TODOS'), E('Ordinário', 'JES', 'ESCALADOS')], vinc.linhas, tps);
  ver('MILITARES diferente entre as linhas da mesma escala: vale a 1ª, com aviso', difere.escalas['Ordinário'].militares === 'TODOS' && difere.avisos.some(a => /MILITARES diferente/.test(a)), difere.avisos);

  // a disputa: alocações dos três serviços preenchem os MESMOS postos
  const dia = '2026-11-05';
  const al = [
    { mat: 'P1', dia, turno: 'A', servico: 'Pronto', funcao: 'MOTORISTA', unidade: 'UTI - PRONTO', linha: 10 },
    { mat: 'J1', dia, turno: 'A', servico: 'JES', funcao: 'CHEFE', unidade: 'UTI - PRONTO', linha: 11 },
    { mat: 'S1', dia, turno: 'A', servico: 'Saldo', funcao: 'COMBATENTE', unidade: 'UTI - PRONTO', linha: 12 },
    { mat: 'J2', dia, turno: 'A', servico: 'JES', funcao: 'CHEFE', unidade: 'UTI - PRONTO', linha: 13 },      // o CHEFE do ABT já está com J1
    { mat: 'B1', dia, turno: 'A', servico: 'Bioma', funcao: 'MOTORISTA', unidade: 'Guardiões do Bioma', linha: 14 }
  ];
  const gr = G.montarGrade_(ord, '2026-11', al);
  const abt = gr.linhas.filter(l => l.dia === dia && l.turno === 'A' && l.unidade === 'UTI - PRONTO' && l.mat);
  ver('o mesmo ABT tem o motorista no Pronto, o chefe no JES e o combatente no Saldo',
    abt.map(l => l.funcao + ':' + l.mat + '(' + l.servico + ')').join() === 'CHEFE:J1(JES),COMBATENTE:S1(Saldo),MOTORISTA:P1(Pronto)', abt);
  ver('um 2º chefe (JES) não ganha um ABT a mais: fica "sem função" naquele turno', gr.semFuncao[dia + '|A'] && gr.semFuncao[dia + '|A'][0].mat === 'J2', gr.semFuncao);
  ver('alocação de serviço fora da escala (Bioma) não entra no Ordinário', !gr.linhas.some(l => l.mat === 'B1'));
  ver('as vagas do mês são as de UM conjunto de postos por dia e turno', gr.vagas === 30 * 2 * 15, gr.vagas);

  // MILITARES = TODOS: pôr na grade quem não está escalado cria a alocação no 1º serviço da escala (RN-13: Pronto)
  const linhaG = (mat, unidade, funcao) => ({ linha: 6, dia, turno: 'B', unidade, funcao, texto: mat, mat });
  const g = G.calcularGuarnicao_([], [linhaG('N1', 'UTI - PRONTO', 'CHEFE')], [], ord, {});
  ver('quem não estava escalado entra como Pronto (1º serviço da escala)', g.inserir.length === 1 && g.inserir[0].servico === 'Pronto', g.inserir);
  const jaJes = [{ mat: 'J9', dia, turno: 'B', servico: 'JES', funcao: '', unidade: '', linha: 20 }];
  const g2 = G.calcularGuarnicao_([{ mat: 'J9', dia, turno: 'B', servico: 'JES', funcao: '', unidade: '' }], [linhaG('J9', 'UTI - PRONTO', 'CHEFE')], jaJes, ord, {});
  ver('quem já está no JES continua no JES: só ganha a função e a guarnição', g2.inserir.length === 0 && g2.atualizar.length === 1 && g2.atualizar[0].unidade === 'UTI - PRONTO', g2);
  ver('Alocar em Função: o JES e o Saldo enxergam as funções do Ordinário', G.funcoesPorServico_(mod, 'JES', 'A').length === G.funcoesPorServico_(mod, 'Pronto', 'A').length && G.funcoesPorServico_(mod, 'Saldo', 'A').length > 0);
}

console.log('== P18 item 3 (B63) cotas de uma escala com N serviços');
{
  const ord = { nome: 'Ordinário', servicos: ['Pronto', 'JES', 'Saldo'] };
  ver('escala de um serviço: é ele, sem olhar a cota', L.servicoDaOperacao_({ nome: 'Bioma', servicos: ['Bioma'] }, []).servico === 'Bioma');
  ver('N serviços: vale o SERVIÇO escrito na COTA, se for da escala', L.servicoDaOperacao_(ord, [{ servico: 'jes' }, { servico: 'JES' }]).servico === 'JES');
  ver('N serviços sem dizer qual: problema explicado (antes: "use uma escala por serviço")', /agrupa 3 serviços \(Pronto, JES, Saldo\)/.test(L.servicoDaOperacao_(ord, [{ servico: '' }]).problema || ''));
  ver('N serviços com serviço de fora da escala, ou dois diferentes: problema', !!L.servicoDaOperacao_(ord, [{ servico: 'Bioma' }]).problema && !!L.servicoDaOperacao_(ord, [{ servico: 'JES' }, { servico: 'Saldo' }]).problema);
  ver('o painel não recusa mais escala com N serviços', !/use uma escala por serviço/.test(ler('distribuicao_cotas_painel.js')));
}

// -- fim das seções
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
