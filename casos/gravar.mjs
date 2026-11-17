// Grava os casos compartilhados: roda cada teste do protótipo com o registrador,
// junta as chamadas por função, tira duplicatas e grava casos/<funcao_>.json.
// Uso: pnpm casos:gravar   (depois de mudar uma regra no protótipo)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pastaCasos = dirname(fileURLToPath(import.meta.url));
const raiz = join(pastaCasos, '..');
const pastaTestes = join(raiz, 'prototipo', 'testes');
const catalogo = JSON.parse(readFileSync(join(pastaCasos, 'catalogo.json'), 'utf8'));
const funcoes = Object.values(catalogo).flat();
// funções do catálogo que nenhum teste do protótipo chama (têm teste próprio em pacotes/dominio)
const SEM_CASOS_ESPERADO = ['novaBaseGuarnicao_'];
const conflitos = [];

const testes = readdirSync(pastaTestes).filter((f) => /^teste_.*\.js$/.test(f)).sort();
const temp = mkdtempSync(join(tmpdir(), 'casos-'));
const porFuncao = new Map(funcoes.map((f) => [f, new Map()]));
const naoGravaveis = new Map(funcoes.map((f) => [f, 0]));

try {
  for (const teste of testes) {
    const saida = join(temp, `${teste}.json`);
    const r = spawnSync(process.execPath, ['--require', join(pastaCasos, 'registrador.cjs'), join(pastaTestes, teste)], {
      encoding: 'utf8',
      env: { ...process.env, CASOS_SAIDA: saida },
    });
    if (r.status !== 0) {
      console.error(`${teste} falhou (código ${r.status}):\n${(r.stdout + r.stderr).split('\n').slice(-20).join('\n')}`);
      process.exit(1);
    }
    const dados = JSON.parse(readFileSync(saida, 'utf8'));
    for (const c of dados.casos) {
      const chave = JSON.stringify(c.entrada);
      const casosDaFuncao = porFuncao.get(c.funcao);
      const caso = { teste, entrada: c.entrada };
      if ('erro' in c) caso.erro = c.erro;
      else caso.saida = c.saida;
      const ja = casosDaFuncao.get(chave);
      if (ja) {
        // a mesma entrada com outra resposta: o protótipo depende de algo fora da entrada
        const resposta = (x) => JSON.stringify('erro' in x ? { erro: x.erro } : { saida: x.saida });
        if (resposta(ja) !== resposta(caso)) conflitos.push(`${c.funcao}: ${ja.teste} e ${teste} dão respostas diferentes para a mesma entrada`);
        continue;
      }
      casosDaFuncao.set(chave, caso);
    }
    for (const [f, n] of Object.entries(dados.naoGravaveis)) naoGravaveis.set(f, naoGravaveis.get(f) + n);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

const semCasos = funcoes.filter((f) => porFuncao.get(f).size === 0 && !SEM_CASOS_ESPERADO.includes(f));
const comCasos = SEM_CASOS_ESPERADO.filter((f) => porFuncao.get(f).size > 0);
if (conflitos.length || semCasos.length || comCasos.length) {
  for (const c of conflitos) console.error(`conflito: ${c}`);
  if (semCasos.length) console.error(`sem nenhum caso (o registrador não achou a função?): ${semCasos.join(', ')}`);
  if (comCasos.length) console.error(`já têm casos, tire de SEM_CASOS_ESPERADO: ${comCasos.join(', ')}`);
  console.error('Nada foi gravado.');
  process.exit(1);
}

for (const f of readdirSync(pastaCasos)) {
  if (f.endsWith('_.json')) rmSync(join(pastaCasos, f));
}
const linhas = [];
for (const funcao of funcoes) {
  const casos = [...porFuncao.get(funcao).entries()]
    .sort(([ca, a], [cb, b]) => (a.teste < b.teste ? -1 : a.teste > b.teste ? 1 : ca < cb ? -1 : ca > cb ? 1 : 0))
    .map(([, c]) => c);
  writeFileSync(join(pastaCasos, `${funcao}.json`), `${JSON.stringify({ funcao, casos }, null, 1)}\n`);
  linhas.push(`${funcao.padEnd(26)} | ${String(casos.length).padStart(5)} | ${String(naoGravaveis.get(funcao)).padStart(5)}`);
}
console.log(`${'função'.padEnd(26)} | casos | não graváveis`);
console.log(linhas.join('\n'));
