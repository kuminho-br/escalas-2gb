// Testes da lógica pura do P13 (chave mat|dia|serviço|turno, grade sem coluna TURNO).
// Uso: node testes/teste_p13.js   (a partir da pasta do repositório)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const fontes = ['choques.js', 'sincronia.js', 'nucleo.js', 'pre_escala.js', 'guarnicao.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const L = new Function(fontes + '\nreturn {montarHorarios_, montarRotulos_, montarModeloMatriz_, desmontarMatriz_, compararAlocacoes_, calcularSincronizacao_, novaBase_, detectarChoques_, chaveAloc_, partesDaChave_, parDoRotulo_, rotuloDe_};')();

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };

const T = [['Pronto','A','08:00','20:00'],['Pronto','B','20:00','08:00'],['JES','A','08:00','20:00'],['JES','B','20:00','08:00'],
  ['Bioma','A','00:00','08:00'],['Bioma','B','08:00','16:00'],['Bioma','C','16:00','00:00'],
  ['PE Seguro','A','00:00','08:00'],['PE Seguro','B','08:00','16:00'],['PE Seguro','C','16:00','00:00'],
  ['Defensoria','A','07:00','19:00'],['Adm','A','08:00','16:00']];
const hor = L.montarHorarios_(T.map(t => ({ servico: t[0], turno: t[1], inicio: t[2], fim: t[3] }))).porChave;
const pares = {}; T.forEach(t => pares[t[0] + '|' + t[1]] = true);
const rot = L.montarRotulos_(hor, pares);
const mil = [{ mat: 'M1', nome: 'UM', posto: 'SD', secao: '1ª SB', equipe: 'ALFA', jornada: 'PRONTO', ordem: 0 }];
const D = '2026-11-';
const A = (mat, dia, servico, turno) => ({ mat, dia: D + dia, servico, turno });
const modelo = (alocs, linhas) => L.montarModeloMatriz_(alocs, mil, { mes: '2026-11', secao: '1ª SB', linhas, rotulos: rot, horarios: hor, catalogo: pares });
const col = (m, dia) => m.dias.indexOf(D + dia);
const volta = (m, cel) => L.desmontarMatriz_(m.linhas, m.dias, cel || m.celulas, rot);

console.log('== Rótulos');
ver('PE Seguro C = "PE Seguro 16–00"', rot.porPar['PE Seguro|C'] === 'PE Seguro 16–00', rot.porPar['PE Seguro|C']);
ver('Pronto A = "Pronto 08–20"', rot.porPar['Pronto|A'] === 'Pronto 08–20');
ver('JES B = "JES 20–08"', rot.porPar['JES|B'] === 'JES 20–08');
ver('Bioma A = "Bioma 00–08"', rot.porPar['Bioma|A'] === 'Bioma 00–08');

console.log('== T1 PE Seguro 16–00 vira PE Seguro turno C');
let m = modelo([], 2);
ver('2 linhas por militar', m.linhas.length === 2, m.linhas.length);
let cel = m.celulas.map(r => r.slice()); cel[0][col(m, '05')] = 'PE Seguro 16–00';
let v = volta(m, cel);
ver('gravado como PE Seguro/C', v.alocs.length === 1 && v.alocs[0].servico === 'PE Seguro' && v.alocs[0].turno === 'C', v.alocs);

console.log('== T2 linha 1 ou 2 grava igual');
let cel2 = m.celulas.map(r => r.slice()); cel2[1][col(m, '05')] = 'PE Seguro 16–00';
ver('mesma chave', L.chaveAloc_(volta(m, cel2).alocs[0]) === L.chaveAloc_(v.alocs[0]));

console.log('== T3 Pronto 08–20 + JES 20–08 no mesmo dia');
cel = m.celulas.map(r => r.slice()); cel[0][col(m, '06')] = 'Pronto 08–20'; cel[1][col(m, '06')] = 'JES 20–08';
v = volta(m, cel);
ver('2 alocações', v.alocs.length === 2);
let ch = L.detectarChoques_(v.alocs.map(a => Object.assign({}, a)), hor, {});
ver('sem choque', ch.choques.length === 0, ch.choques);

console.log('== T4 Bioma 00–08 + Pronto 08–20');
cel = m.celulas.map(r => r.slice()); cel[0][col(m, '06')] = 'Bioma 00–08'; cel[1][col(m, '06')] = 'Pronto 08–20';
v = volta(m, cel);
ver('as duas gravadas (letras A iguais não colidem)', v.alocs.length === 2 && v.repetidas === 0, v);
ch = L.detectarChoques_(v.alocs, hor, {});
ver('sem choque', ch.choques.length === 0, ch.choques);

console.log('== T5 Defensoria 07–19 + PE Seguro 08–16 = choque');
ch = L.detectarChoques_([A('M1','07','Defensoria','A'), A('M1','07','PE Seguro','B')], hor, {});
ver('choque de sobreposição', ch.choques.length === 1 && ch.choques[0].tipo === 'sobreposicao', ch.choques);

console.log('== T6 JES seguido de Pronto = emenda');
ch = L.detectarChoques_([A('M1','07','JES','B'), A('M1','08','Pronto','A')], hor, {});
ver('emenda', ch.choques.length === 1 && ch.choques[0].tipo === 'emenda', ch.choques);

console.log('== T7 recarregar põe em ordem de início');
const alocs7 = [A('M1','10','Pronto','A'), A('M1','10','Bioma','A')];
m = modelo(alocs7, 2);
ver('Bioma 00–08 na linha 1, Pronto 08–20 na linha 2', m.celulas[0][col(m, '10')] === 'Bioma 00–08' && m.celulas[1][col(m, '10')] === 'Pronto 08–20', [m.celulas[0][col(m, '10')], m.celulas[1][col(m, '10')]]);
const alocs7b = [A('M1','10','Pronto','B'), A('M1','10','Defensoria','A')];
m = modelo(alocs7b, 2);
ver('Defensoria 07–19 antes de Pronto 20–08', m.celulas[0][col(m, '10')] === 'Defensoria 07–19', m.celulas[0][col(m, '10')]);

console.log('== T8 parâmetro 3 linhas');
m = modelo([A('M1','12','Bioma','A'), A('M1','12','Pronto','A'), A('M1','12','PE Seguro','C')], 3);
ver('3 linhas', m.linhas.length === 3);
ver('nada fora da grade', m.resumo.foraDaGrade === 0 && m.resumo.celulasPreenchidas === 3, m.resumo);
ver('ida e volta sem diferença', L.compararAlocacoes_(m.celulas && [A('M1','12','Bioma','A'), A('M1','12','Pronto','A'), A('M1','12','PE Seguro','C')], volta(m).alocs).total === 0);

console.log('== T9 parâmetro 1 com dia de 2 serviços: aviso e nada apagado');
const tab9 = [A('M1','12','Bioma','A'), A('M1','12','Pronto','A')];
m = modelo(tab9, 1);
ver('1 linha', m.linhas.length === 1);
ver('1 serviço fora da grade, com aviso', m.resumo.foraDaGrade === 1 && m.avisos.length > 0, [m.resumo, m.avisos]);
const escala9 = volta(m).alocs;
const base9 = escala9.slice(); // base = o que carregou na grade
const tabela9 = tab9.map((a, i) => Object.assign({ linha: i + 2 }, a));
const fora = (m.foraDaGrade || []);
const res9 = L.calcularSincronizacao_(base9, escala9, tabela9, pares, {});
ver('salvar sem edição não remove nada', res9.remover.length === 0 && res9.inserir.length === 0, res9);

console.log('== T11 mover serviço de linha mantém função');
m = modelo([A('M1','14','Pronto','A')], 2);
cel = m.celulas.map(r => r.slice()); cel[1][col(m, '14')] = cel[0][col(m, '14')]; cel[0][col(m, '14')] = '';
const esc11 = volta(m, cel).alocs, base11 = volta(m).alocs;
const tab11 = [Object.assign({ linha: 2, funcao: 'Comandante' }, A('M1','14','Pronto','A'))];
const r11 = L.calcularSincronizacao_(base11, esc11, tab11, pares, {});
ver('nenhuma mudança', r11.inserir.length === 0 && r11.remover.length === 0, r11);

console.log('== Troca de serviço = remove + insere');
const esc12 = [A('M1','14','JES','A')];
const r12 = L.calcularSincronizacao_([A('M1','14','Pronto','A')], esc12, tab11, pares, { horarios: hor, todas: [Object.assign({ linha: 2 }, A('M1','14','Pronto','A'))] });
ver('1 remoção e 1 inclusão', r12.remover.length === 1 && r12.inserir.length === 1, r12);

console.log('== T12 compararAlocacoes_: ordem de linha não gera falsa divergência');
ver('0 diferenças', L.compararAlocacoes_([A('M1','12','Bioma','A'), A('M1','12','Pronto','A')], [A('M1','12','Pronto','A'), A('M1','12','Bioma','A')]).total === 0);
ver('1 diferença se serviço mudou', L.compararAlocacoes_([A('M1','12','Bioma','A')], [A('M1','12','Pronto','A')]).total === 2);

console.log('== Texto ilegível não é gravado');
cel = m.celulas.map(r => r.slice()); cel[0][col(m, '20')] = 'Xyz 1–2';
v = volta(m, cel);
ver('ilegível reportado', v.ilegiveis.length === 1 && !v.alocs.some(a => a.dia === D + '20'), v.ilegiveis);

console.log('\n' + ok + ' ok, ' + falhas + ' falhas');
process.exit(falhas ? 1 : 0);
