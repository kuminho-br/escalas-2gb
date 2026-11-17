// Registrador dos casos compartilhados. Carregado com `node --require casos/registrador.cjs`
// antes de um teste do protótipo. Os testes carregam o protótipo com
// `new Function(fontes + 'return {...}')()`; aqui o construtor Function é trocado por um
// equivalente que embrulha as funções do catálogo dentro do código carregado. Cada chamada
// a uma delas vinda de fora do motor (do teste ou de um painel) é gravada: entrada e
// saída, ou a mensagem do erro.
// Ao sair, grava tudo no arquivo indicado por CASOS_SAIDA.
'use strict';
const fs = require('fs');
const path = require('path');

const catalogo = require(path.join(__dirname, 'catalogo.json'));
const nomes = new Set(Object.values(catalogo).flat());

const casos = [];
const naoGravaveis = {};

// true se o valor volta igual de JSON.stringify/JSON.parse (propriedades com undefined
// em objetos são aceitas: somem na volta, e o reprodutor do protótipo confere que isso
// não muda o resultado)
function gravavel(v) {
  if (v === null) return true;
  const t = typeof v;
  if (t === 'string' || t === 'boolean') return true;
  if (t === 'number') return Number.isFinite(v) && !Object.is(v, -0);
  if (t !== 'object') return false;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (!(i in v) || v[i] === undefined || !gravavel(v[i])) return false;
    }
    return true;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return false;
  for (const k of Object.keys(v)) {
    if (v[k] !== undefined && !gravavel(v[k])) return false;
  }
  return true;
}

const clonar = (v) => JSON.parse(JSON.stringify(v));

function semUndefinedNoFim(args) {
  const a = Array.prototype.slice.call(args);
  while (a.length && a[a.length - 1] === undefined) a.pop();
  return a;
}

function contarNaoGravavel(nome) {
  naoGravaveis[nome] = (naoGravaveis[nome] || 0) + 1;
}

function embrulhar(nome, original) {
  return function () {
    const args = semUndefinedNoFim(arguments);
    const entradaOk = gravavel(args);
    const entrada = entradaOk ? clonar(args) : null;
    let saida;
    try {
      saida = original.apply(this, arguments);
    } catch (e) {
      if (entradaOk && e && typeof e.message === 'string') casos.push({ funcao: nome, entrada, erro: e.message });
      else contarNaoGravavel(nome);
      throw e;
    }
    if (entradaOk && saida !== undefined && gravavel(saida)) casos.push({ funcao: nome, entrada, saida: clonar(saida) });
    else contarNaoGravavel(nome);
    return saida;
  };
}

// Profundidade de chamadas do catálogo em andamento: só a chamada mais externa (vinda do
// teste ou de um painel) é gravada; as que uma função do motor faz a outra não.
let profundidade = 0;
globalThis.__gravarCaso = (nome, original) => {
  const gravando = embrulhar(nome, original);
  return function () {
    if (profundidade > 0) {
      profundidade++;
      try { return original.apply(this, arguments); } finally { profundidade--; }
    }
    profundidade++;
    try { return gravando.apply(this, arguments); } finally { profundidade--; }
  };
};

// As declarações `function nome_(` são içadas no corpo; reatribuí-las no início faz as
// chamadas internas (dos painéis) e o objeto devolvido usarem a versão que grava.
const FunctionOriginal = globalThis.Function;
function FunctionGravador(...partes) {
  if (partes.length) {
    const corpo = String(partes[partes.length - 1]);
    const presentes = [...nomes].filter((n) => corpo.includes(`function ${n}(`));
    const prefixo = presentes.map((n) => `${n} = __gravarCaso(${JSON.stringify(n)}, ${n});`).join('\n');
    partes[partes.length - 1] = `${prefixo}\n${corpo}`;
  }
  return FunctionOriginal(...partes);
}
FunctionGravador.prototype = FunctionOriginal.prototype;
globalThis.Function = FunctionGravador;

process.on('exit', () => {
  const destino = process.env.CASOS_SAIDA;
  if (destino) fs.writeFileSync(destino, JSON.stringify({ casos, naoGravaveis }));
});
