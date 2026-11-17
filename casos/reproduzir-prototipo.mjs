// Confere que o protótipo reproduz os próprios casos gravados.
// Uso: node casos/reproduzir-prototipo.mjs [--funcao <nome_>] [--pasta <pasta dos casos>]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

const pastaCasos = dirname(fileURLToPath(import.meta.url));
const raiz = join(pastaCasos, '..');
const { values: opcoes } = parseArgs({ options: { funcao: { type: 'string' }, pasta: { type: 'string' } } });
const pasta = opcoes.pasta ?? pastaCasos;

// arquivos do protótipo onde moram as funções do catálogo (e o que elas usam)
const ARQUIVOS = ['nucleo.js', 'parametros.js', 'cadastro_guarnicoes.js', 'choques.js', 'sincronia.js', 'regras_escala.js',
  'pre_escala.js', 'distribuicao_adm.js', 'distribuicao_cotas.js', 'guarnicao.js'];

const catalogo = JSON.parse(readFileSync(join(pastaCasos, 'catalogo.json'), 'utf8'));
const funcoes = Object.values(catalogo).flat().filter((f) => !opcoes.funcao || f === opcoes.funcao);
if (!funcoes.length) {
  console.error(`Função fora do catálogo: ${opcoes.funcao}`);
  process.exit(1);
}
const fontes = ARQUIVOS.map((f) => readFileSync(join(raiz, 'prototipo', f), 'utf8')).join('\n');
const P = new Function(`${fontes}\nreturn {${funcoes.join(', ')}};`)();

const normalizar = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let falhas = 0;
for (const funcao of funcoes) {
  const { casos } = JSON.parse(readFileSync(join(pasta, `${funcao}.json`), 'utf8'));
  let ok = 0;
  const erros = [];
  casos.forEach((caso, i) => {
    let saida, erro;
    try {
      saida = normalizar(P[funcao](...structuredClone(caso.entrada)));
    } catch (e) {
      erro = e.message;
    }
    const bate = 'erro' in caso ? erro === caso.erro : erro === undefined && isDeepStrictEqual(saida, caso.saida);
    if (bate) ok++;
    else erros.push(`  ${caso.teste} #${i}: ${erro ? `erro "${erro}"` : 'saída diferente'}`);
  });
  falhas += erros.length;
  console.log(`${funcao}: ${ok} ok, ${erros.length} falha`);
  if (erros.length) console.log(erros.slice(0, 5).join('\n'));
}
console.log(falhas ? `\n${falhas} falha(s)` : '\ntodos os casos ok');
process.exit(falhas ? 1 : 0);
