// Testes da lógica pura de distribuicao_cotas.js. Uso: node testes/teste_cotas.js (na pasta do repositório)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const fontes = ['choques.js', 'sincronia.js', 'nucleo.js', 'pre_escala.js', 'parametros.js', 'distribuicao_cotas.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const L = new Function(fontes + '\nreturn {montarHorarios_, distribuirCotas_, expedienteImplicito_, diasUteisDoMes_, diasDoMes_, chaveAloc_, detectarChoques_};')();
let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 500) : '')); } };

// Leitura da aba VOLUNTARIADO (B31): precisa de SpreadsheetApp e Utilities, então entra com dublês.
function lerVoluntariadoDe_(cabecalho, linhas, mes) {
  const fontes2 = ['nucleo.js', 'matriz.js', 'distribuicao_cotas_painel.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const aba = {
    getDataRange: () => ({ getValues: () => [cabecalho].concat(linhas) }),
    getMaxRows: () => linhas.length + 1,
    getRange: () => ({ setNumberFormat: () => {}, setValues: () => ({ setFontWeight: () => ({ setBackground: () => ({ setFontColor: () => {} }) }), setFontColor: () => {} }) })
  };
  const SpreadsheetApp = { getActive: () => ({ getSheetByName: n => (n === 'VOLUNTARIADO' ? aba : null), getSpreadsheetTimeZone: () => 'America/Recife' }) };
  const Utilities = {
    formatDate: (d, tz, f) => {
      const p = n => String(n).padStart(2, '0');
      return f === 'yyyy-MM' ? d.getFullYear() + '-' + p(d.getMonth() + 1)
        : d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
  };
  const f = new Function('SpreadsheetApp', 'Utilities', fontes2 + '\nreturn lerVoluntariado_;')(SpreadsheetApp, Utilities);
  return f(mes, 'America/Recife');
}

const T = [['Pronto','A','08:00','20:00'],['Pronto','B','20:00','08:00'],['Adm','A','08:00','16:00'],['JES','A','08:00','20:00'],['JES','B','20:00','08:00'],
  ['Bioma','A','00:00','08:00'],['Bioma','B','08:00','16:00'],['Bioma','C','16:00','00:00'],
  ['PE Seguro','A','00:00','08:00'],['PE Seguro','B','08:00','16:00'],['PE Seguro','C','16:00','00:00'],['Defensoria','A','07:00','19:00']];
const hor = L.montarHorarios_(T.map(t => ({ servico: t[0], turno: t[1], inicio: t[2], fim: t[3] }))).porChave;
const tipos = { Pronto: 'Ordinário', Adm: 'Ordinário', JES: 'PJES', Defensoria: 'PJES', Bioma: 'Diária', 'PE Seguro': 'Diária' };
const dias = L.diasDoMes_('2026-11');
const mils = n => Array.from({ length: n }, (_, i) => ({ mat: 'm' + String(i + 1).padStart(2, '0') }));
const D = d => '2026-11-' + String(d).padStart(2, '0');
const vol = (mat, dia, turno, servico) => ({ mat, dia: D(dia), turno, servico: servico || 'todos' });
const op = (nome, servico, ds, vagas, prio) => ({ nome, servico, prioridade: prio, dias: ds.map(D), turnos: ['A','B','C'].filter(t => hor[servico + '|' + t]).map(t => ({ turno: t, vagas })) });
const base = o => Object.assign({ mes: '2026-11', operacoes: [], cotas: [], militares: mils(10), voluntariado: [], alocacoes: [], expediente: [], horarios: hor, tipos }, o);
const chaves = r => r.novas.map(x => x.mat + '|' + x.dia + '|' + x.servico + '|' + x.turno);

console.log('== Cota é teto');
let e = base({ operacoes: [op('PE Seguro', 'PE Seguro', [1, 2, 3], 2)], cotas: [{ id: 'c1', operacao: 'PE Seguro', quantidade: 5 }],
  voluntariado: mils(10).flatMap(m => [1,2,3].flatMap(d => ['A','B','C'].map(t => vol(m.mat, d, t)))) });
let r = L.distribuirCotas_(e);
ver('distribui exatamente a cota (5)', r.novas.length === 5, r.novas.length);
ver('porCota: recebidas 5, distribuídas 5, restantes 0', r.porCota[0].recebidas === 5 && r.porCota[0].distribuidas === 5 && r.porCota[0].restantes === 0, r.porCota);
ver('vagas sem cota são contadas à parte, não listadas como vazias', r.vazias.length === 0 && r.semCota['PE Seguro'] === 18 * 2 - 5 || r.semCota['PE Seguro'] > 0, [r.vazias, r.semCota]);

console.log('== Voluntária antes da compulsória; compulsória só do formulário');
e = base({ operacoes: [op('PE Seguro', 'PE Seguro', [5], 2)], cotas: [{ id: 'c1', operacao: 'PE Seguro', quantidade: 4 }],
  voluntariado: [vol('m01', 5, 'A'), vol('m02', 9, 'C')] });   // m02 preencheu o formulário, mas para outro dia
r = L.distribuirCotas_(e);
ver('m01 entra no dia 5 A (voluntário)', r.novas.some(x => x.mat === 'm01' && x.dia === D(5) && x.turno === 'A' && x.fase === 'voluntaria'));
ver('m02 pode entrar de forma compulsória', r.novas.some(x => x.mat === 'm02' && x.fase === 'compulsoria'));
ver('quem não preencheu o formulário nunca entra', r.novas.every(x => x.mat === 'm01' || x.mat === 'm02'), chaves(r));
ver('diária única: com 2 pessoas no formulário e 1 diária por dia, só 2 vagas fecham', r.novas.length === 2, r.novas.length);
ver('as vagas que sobraram têm motivo', r.vazias.length > 0 && r.vazias.every(v => v.motivo), r.vazias);

console.log('== Sem formulário: nada é distribuído e há motivo');
r = L.distribuirCotas_(base({ operacoes: [op('Bioma', 'Bioma', [3], 1)], cotas: [{ id: 'c', operacao: 'Bioma', quantidade: 3 }] }));
ver('nenhuma alocação', r.novas.length === 0);
ver('vagas vazias com motivo', r.vazias.length === 3 && r.vazias.every(v => /formulário/.test(v.motivo)), r.vazias);

console.log('== Choque, expediente e diária única');
e = base({ operacoes: [op('PE Seguro', 'PE Seguro', [4], 1)], cotas: [{ id: 'c', operacao: 'PE Seguro', quantidade: 3 }],
  militares: mils(2), voluntariado: [vol('m01', 4, 'A'), vol('m01', 4, 'B'), vol('m01', 4, 'C'), vol('m02', 4, 'A')],
  alocacoes: [{ mat: 'm01', dia: D(4), servico: 'Pronto', turno: 'A' }] });  // Pronto 08–20 do m01
r = L.distribuirCotas_(e);
ver('m01 não pega o PE Seguro B (08–16) nem o C (16–00): choca com o Pronto A', !r.novas.some(x => x.mat === 'm01' && (x.turno === 'B' || x.turno === 'C')), chaves(r));
ver('m01 só pode ficar com o A (00–08)', r.novas.filter(x => x.mat === 'm01').length <= 1);
ver('diária única: ninguém tem duas diárias com início no mesmo dia', Object.values(r.novas.reduce((o, x) => { const k = x.mat + x.dia; o[k] = (o[k] || 0) + 1; return o; }, {})).every(n => n === 1));
e = base({ operacoes: [op('PE Seguro', 'PE Seguro', [4], 1)], cotas: [{ id: 'c', operacao: 'PE Seguro', quantidade: 3 }], militares: mils(1),
  voluntariado: [vol('m01', 4, 'B')], expediente: L.expedienteImplicito_({ mats: ['m01'], dias: L.diasUteisDoMes_('2026-11', {}), servico: 'Adm', turno: 'A' }) });
r = L.distribuirCotas_(e);
ver('Adm de expediente não pega turno que bate com o expediente (dia útil, 08–16)', !r.novas.some(x => x.turno === 'B'), chaves(r));

console.log('== Dobradinha é permitida e preferida');
e = base({ operacoes: [op('Bioma', 'Bioma', [10, 11], 1)], cotas: [{ id: 'c', operacao: 'Bioma', quantidade: 3 }], militares: mils(2),
  voluntariado: [vol('m01', 10, 'C'), vol('m01', 11, 'A'), vol('m02', 11, 'A')],
  alocacoes: [{ mat: 'm02', dia: D(20), servico: 'Bioma', turno: 'A' }] });   // m02 já tem 1: empata com m01 depois do 10 C
r = L.distribuirCotas_(e);
ver('m01 fica com 10 C e 11 A (dobradinha)', r.novas.some(x => x.mat === 'm01' && x.dia === D(10) && x.turno === 'C') && r.novas.some(x => x.mat === 'm01' && x.dia === D(11) && x.turno === 'A'), chaves(r));

console.log('== Equilíbrio');
e = base({ operacoes: [op('Defensoria', 'Defensoria', [1,2,3,4,5,6], 1)], cotas: [{ id: 'c', operacao: 'Defensoria', quantidade: 6 }], militares: mils(3),
  voluntariado: [1,2,3,4,5,6].flatMap(d => ['m01','m02','m03'].map(m => vol(m, d, 'A'))) });
r = L.distribuirCotas_(e);
const por = r.porOperacao['Defensoria'].porMilitar;
ver('6 cotas entre 3 militares: 2 para cada', ['m01','m02','m03'].every(m => por[m] === 2), por);

console.log('== Alocações existentes ficam e rodar duas vezes não duplica');
e = base({ operacoes: [op('PE Seguro', 'PE Seguro', [1, 2], 2)], cotas: [{ id: 'c', operacao: 'PE Seguro', quantidade: 6 }],
  voluntariado: mils(10).flatMap(m => [1,2].flatMap(d => ['A','B','C'].map(t => vol(m.mat, d, t)))),
  alocacoes: [{ mat: 'm09', dia: D(1), servico: 'PE Seguro', turno: 'A' }] });
const r1 = L.distribuirCotas_(e);
ver('a alocação existente conta como distribuída (cota 6 -> 5 novas)', r1.novas.length === 5, r1.novas.length);
ver('nenhuma nova repete a existente', !chaves(r1).includes('m09|' + D(1) + '|PE Seguro|A'));
const e2 = Object.assign({}, e, { alocacoes: e.alocacoes.concat(r1.novas.map(x => ({ mat: x.mat, dia: x.dia, servico: x.servico, turno: x.turno }))) });
const r2 = L.distribuirCotas_(e2);
ver('segunda rodada não grava nada', r2.novas.length === 0, r2.novas.length);
ver('contagens iguais depois da segunda rodada', r2.porCota[0].distribuidas === 6 && r2.porCota[0].restantes === 0);
const todas = e2.alocacoes;
ver('sem choque novo entre as alocações de operação', L.detectarChoques_(todas, hor, {}).choques.length === 0, L.detectarChoques_(todas, hor, {}).choques);

console.log('== Cota externa fora do total da SB');
e = base({ operacoes: [op('Bioma', 'Bioma', [3], 1)], cotas: [{ id: 'i', operacao: 'Bioma', quantidade: 1, origem: 'interna' }, { id: 'x', operacao: 'Bioma', quantidade: 2, origem: 'externa' }],
  voluntariado: mils(10).flatMap(m => ['A','B','C'].map(t => vol(m.mat, 3, t))) });
r = L.distribuirCotas_(e);
ver('interna 1/1 e externa 2/2, listadas separadas', r.porCota.find(c => c.id === 'i').distribuidas === 1 && r.porCota.find(c => c.id === 'x').distribuidas === 2, r.porCota);

console.log('== Prioridade entre operações');
e = base({ operacoes: [op('Bioma', 'Bioma', [3], 1, 2), op('PE Seguro', 'PE Seguro', [3], 1, 1)], cotas: [{ id: 'b', operacao: 'Bioma', quantidade: 1 }, { id: 'p', operacao: 'PE Seguro', quantidade: 1 }],
  militares: mils(1), voluntariado: [vol('m01', 3, 'A'), vol('m01', 3, 'B')] });
r = L.distribuirCotas_(e);
ver('PE Seguro (prioridade 1) fica com o único voluntário no turno A', r.novas.length >= 1 && r.novas[0].servico === 'PE Seguro', chaves(r));

console.log('== B31 (RN-40, RN-41, RN-39) aba VOLUNTARIADO com uma coluna DATA');
{
  const CAB = ['DATA', 'MATRÍCULA', 'TURNO', 'SERVIÇO ACEITO'];
  // data de verdade na célula (é o que a planilha devolve quando a coluna é do tipo data)
  let v = lerVoluntariadoDe_(CAB, [[new Date(2026, 10, 5), '123', 'A', 'todos'], [new Date(2026, 10, 6), '123', 'B', 'todos']], '2026-11');
  ver('lê as linhas com DATA do tipo data', v.linhas.length === 2 && v.linhas[0].dia === '2026-11-05' && v.linhas[0].turno === 'A', v);
  ver('sem aviso quando está tudo certo', v.avisos.length === 0, v.avisos);

  // texto dd/mm/aaaa e d/m/aaaa (o caso do bug: a linha era descartada)
  v = lerVoluntariadoDe_(CAB, [['05/11/2026', '123', 'A', 'todos'], ['6/11/2026', '456', 'C', 'Bioma']], '2026-11');
  ver('aceita 05/11/2026 e 6/11/2026 como texto', v.linhas.length === 2 && v.linhas[1].dia === '2026-11-06' && v.linhas[1].servico === 'Bioma', v);

  v = lerVoluntariadoDe_(CAB, [['2026-11-07', '123', '1º turno', 'todos']], '2026-11');
  ver('aceita aaaa-mm-dd e "1º turno"', v.linhas.length === 1 && v.linhas[0].dia === '2026-11-07' && v.linhas[0].turno === 'A', v);

  // o mês vem da DATA, não de uma coluna MÊS
  v = lerVoluntariadoDe_(CAB, [['05/10/2026', '123', 'A', 'todos'], ['05/11/2026', '123', 'A', 'todos']], '2026-11');
  ver('fica só com as linhas do mês pedido', v.linhas.length === 1 && v.linhas[0].dia === '2026-11-05', v);

  // nada de descarte em silêncio
  v = lerVoluntariadoDe_(CAB, [['5', '123', 'A', 'todos'], [new Date(2026, 10, 5), '123', 'A', 'todos']], '2026-11');
  ver('linha com DATA ilegível é contada e avisada (não some)', v.linhas.length === 1 && v.avisos.some(a => /1 linha\(s\) com DATA ilegível/.test(a) && /"5"/.test(a)), v);
  v = lerVoluntariadoDe_(CAB, [[new Date(2026, 10, 5), '123', 'manhã', 'todos']], '2026-11');
  ver('linha com TURNO ilegível continua avisada', v.linhas.length === 0 && v.avisos.some(a => /TURNO ilegível/.test(a)), v);
  ver('linha sem matrícula é ignorada sem aviso', (() => { const x = lerVoluntariadoDe_(CAB, [[new Date(2026, 10, 5), '', 'A', 'todos']], '2026-11'); return x.linhas.length === 0 && x.avisos.length === 0; })());

  // aba antiga (MÊS + DIA) continua sendo lida, com aviso para renomear
  v = lerVoluntariadoDe_(['MÊS', 'MATRÍCULA', 'DIA', 'TURNO', 'SERVIÇO ACEITO'], [['2026-11', '123', '05/11/2026', 'A', 'todos']], '2026-11');
  ver('aba antiga com DIA ainda é lida, pedindo para renomear para DATA', v.linhas.length === 1 && v.avisos.some(a => /ainda se chama DIA/.test(a)), v);
}

console.log('\n' + ok + ' ok, ' + falhas + ' falhas');
process.exit(falhas ? 1 : 0);
