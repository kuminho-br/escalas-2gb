// Testes da P15 (validações da escala). Uso: node testes/teste_p15.js  (a partir da pasta do repositório)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const fontes = ['choques.js', 'sincronia.js', 'nucleo.js', 'pre_escala.js', 'guarnicao.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const L = new Function(fontes + '\nreturn {linhasExtrasVazias_, montarHorarios_, montarRotulos_, montarModeloMatriz_, desmontarMatriz_, detectarChoques_, calcularSincronizacao_, chaveAloc_, partesDaChave_};')();

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };

console.log('== B20 (RN-02) linhas extras vazias');
{
  // M1: 3 linhas (1ª vazia, 2ª com serviço, 3ª vazia); M2: 2 linhas vazias; M3: 1 linha
  const linhas = [{ mat: 'M1' }, { mat: 'M1' }, { mat: 'M1' }, { mat: 'M2' }, { mat: 'M2' }, { mat: 'M3' }];
  const cel = [['', ''], ['', 'Pronto 08–20'], ['', ''], ['', ''], ['', ''], ['', '']];
  const r = L.linhasExtrasVazias_(linhas, cel);
  ver('oculta a 3ª de M1 e a 2ª de M2', JSON.stringify(r) === '[2,4]', r);
  ver('a 1ª linha de cada militar nunca entra (M1, M2, M3)', r.indexOf(0) < 0 && r.indexOf(3) < 0 && r.indexOf(5) < 0, r);
  ver('a 2ª de M1 tem serviço e fica', r.indexOf(1) < 0, r);
  ver('espaços e null contam como vazio', JSON.stringify(L.linhasExtrasVazias_([{ mat: 'A' }, { mat: 'A' }], [['x'], [' ', null]])) === '[1]');
  ver('texto não reconhecido não é vazio (não pode sumir)', L.linhasExtrasVazias_([{ mat: 'A' }, { mat: 'A' }], [[''], ['xyz']]).length === 0);
  ver('sem linhas: lista vazia', L.linhasExtrasVazias_([], []).length === 0);
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
