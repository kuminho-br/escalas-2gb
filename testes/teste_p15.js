// Testes da P15 (validações da escala). Uso: node testes/teste_p15.js  (a partir da pasta do repositório)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const fontes = ['abertura_automatica.js', 'regras_escala.js', 'choques.js', 'sincronia.js', 'nucleo.js', 'pre_escala.js', 'guarnicao.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const L = new Function(fontes + '\nreturn {violacoesSaldo_, violacoesDeRegras_, listasDeCelula_, bloquearPorRegras_, editouAGradeDaEscala_, painelEscalaAberto_, linhasExtrasVazias_, montarHorarios_, montarRotulos_, montarModeloMatriz_, desmontarMatriz_, detectarChoques_, calcularSincronizacao_, chaveAloc_, partesDaChave_};')();

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

console.log('== B22 (RN-03) Saldo só para o Adm');
{
  const ctx = { adm: { ADM1: true } };
  const A = (mat, dia, servico, turno) => ({ mat, dia: '2026-11-' + dia, servico, turno });
  ver('Saldo para militar do Adm: sem violação', L.violacoesSaldo_([A('ADM1', '05', 'Saldo', 'A')], ctx).length === 0);
  const v = L.violacoesSaldo_([A('PRO1', '05', 'Saldo', 'A')], ctx);
  ver('Saldo para militar do Pronto: violação RN-03', v.length === 1 && v[0].rn === 'RN-03' && v[0].mat === 'PRO1', v);
  ver('militar fora do cadastro conta como não-Adm', L.violacoesSaldo_([A('XXX', '05', 'Saldo', 'A')], ctx).length === 1);
  ver('"saldo" em minúsculas também vale', L.violacoesSaldo_([A('PRO1', '05', 'saldo', 'A')], ctx).length === 1);
  ver('outros serviços não são tocados', L.violacoesSaldo_([A('PRO1', '05', 'Pronto', 'A'), A('PRO1', '06', 'Adm', 'A')], ctx).length === 0);
  ver('expediente implícito é ignorado', L.violacoesDeRegras_([{ mat: 'PRO1', dia: '2026-11-05', servico: 'Saldo', turno: 'A', implicito: true }], ctx).length === 0);

  // sincronia: o Saldo lançado para o Pronto é bloqueado; o do Adm passa
  const pares = { 'Pronto|A': true, 'Saldo|A': true, 'Adm|A': true };
  const base = [];
  const escala = [A('PRO1', '05', 'Saldo', 'A'), A('ADM1', '05', 'Saldo', 'A')];
  let r = L.calcularSincronizacao_(base, escala, [], pares, { regras: ctx, todas: [] });
  ver('Saldo do Pronto bloqueado, com aviso na lista de regras', r.regras.length === 1 && r.regras[0].mat === 'PRO1' && r.regras[0].motivos[0].rn === 'RN-03', r.regras);
  ver('Saldo do Adm segue normal', r.inserir.length === 1 && r.inserir[0].mat === 'ADM1', r.inserir);
  ver('resumo conta o bloqueio', r.resumo.regras === 1 && r.resumo.inclusoes === 1, r.resumo);
  ver('o bloqueado não vai para a base (continua pendente)', r.aplicadas.indexOf('PRO1|2026-11-05|Saldo|A') < 0 && r.aplicadas.indexOf('ADM1|2026-11-05|Saldo|A') >= 0, r.aplicadas);

  // troca: Pronto A -> Saldo A para militar do Pronto: tudo ou nada (a linha antiga fica)
  const tabela = [{ mat: 'PRO1', dia: '2026-11-07', servico: 'Pronto', turno: 'A', linha: 12 }];
  r = L.calcularSincronizacao_([A('PRO1', '07', 'Pronto', 'A')], [A('PRO1', '07', 'Saldo', 'A')], tabela, pares, { regras: ctx, todas: tabela });
  ver('troca bloqueada: nada entra e a linha antiga não sai', r.inserir.length === 0 && r.remover.length === 0 && r.regras.length === 1 && r.regras[0].tipo === 'alteracao', r);

  // violação antiga na tabela não bloqueia outra gravação
  const velha = [{ mat: 'PRO1', dia: '2026-11-02', servico: 'Saldo', turno: 'A', linha: 5 }];
  r = L.calcularSincronizacao_([], [A('PRO1', '09', 'Pronto', 'A')], velha, pares, { regras: ctx, todas: velha });
  ver('Saldo antigo de não-Adm não impede salvar outra célula', r.inserir.length === 1 && r.regras.length === 0, r);

  // sem contexto de regras a sincronia é a de antes
  r = L.calcularSincronizacao_([], escala, [], pares, {});
  ver('sem contexto (testes antigos) nada muda', r.inserir.length === 2 && r.regras.length === 0);

  // lista suspensa
  const hor = L.montarHorarios_([{ servico: 'Pronto', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'Saldo', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'Adm', turno: 'A', inicio: '08:00', fim: '16:00' }]).porChave;
  const rot = L.montarRotulos_(hor, { 'Pronto|A': true, 'Saldo|A': true, 'Adm|A': true });
  const li = L.listasDeCelula_(rot);
  ver('lista do Adm tem Saldo', li.comSaldo.some(t => /^Saldo/.test(t)), li.comSaldo);
  ver('lista dos demais não tem Saldo e mantém o resto', !li.semSaldo.some(t => /^Saldo/.test(t)) && li.semSaldo.length === li.comSaldo.length - 1, li.semSaldo);
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
