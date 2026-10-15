// Testes da P15 (validações da escala). Uso: node testes/teste_p15.js  (a partir da pasta do repositório)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const fontes = ['abertura_automatica.js', 'choques.js', 'sincronia.js', 'nucleo.js', 'pre_escala.js', 'guarnicao.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const L = new Function(fontes + '\nreturn {editouAGradeDaEscala_, painelEscalaAberto_, linhasExtrasVazias_, montarHorarios_, montarRotulos_, montarModeloMatriz_, desmontarMatriz_, detectarChoques_, calcularSincronizacao_, chaveAloc_, partesDaChave_};')();

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

console.log('== B21 (RN-31) quando abrir o painel');
{
  const cfg = { aba: 'ESCALA DO MÊS', primeiraLinha: 5, primeiraColuna: 4 };
  const ed = (aba, linha, coluna, nl, nc) => ({ aba, linha, coluna, nLinhas: nl || 1, nColunas: nc || 1 });
  ver('célula da grade abre', L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 5, 4), cfg) === true);
  ver('célula no meio da grade abre', L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 30, 20), cfg) === true);
  ver('cabeçalho (linha 4) não abre', L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 4, 10), cfg) === false);
  ver('MÊS/SEÇÃO (B1, B2) não abre', L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 1, 2), cfg) === false && L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 2, 2), cfg) === false);
  ver('colunas de identificação (A–C) não abrem', L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 8, 1), cfg) === false && L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 8, 3), cfg) === false);
  ver('outra aba não abre', L.editouAGradeDaEscala_(ed('ALOCAÇÕES TABULADAS', 8, 8), cfg) === false);
  ver('colar uma faixa que começa fora e entra na grade abre', L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 3, 1, 5, 5), cfg) === true);
  ver('colar uma faixa só no cabeçalho não abre', L.editouAGradeDaEscala_(ed('ESCALA DO MÊS', 1, 1, 3, 10), cfg) === false);
  ver('sem evento: não abre', L.editouAGradeDaEscala_(null, cfg) === false);
  const agora = 1000000;
  ver('pulso recente = aberto', L.painelEscalaAberto_(agora, String(agora - 4000)) === true);
  ver('pulso antigo = fechado', L.painelEscalaAberto_(agora, String(agora - 16000)) === false);
  ver('sem pulso (null) = fechado', L.painelEscalaAberto_(agora, null) === false);
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
