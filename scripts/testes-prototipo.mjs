// Roda os testes do protótipo (Apps Script) com Node e falha se algum falhar.
// Uso: node scripts/testes-prototipo.mjs [arquivos...]
// Sem argumentos, roda prototipo/testes/teste_*.js.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = join(raiz, 'prototipo', 'testes');
const arquivos = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync(pasta).filter((f) => /^teste_.*\.js$/.test(f)).sort().map((f) => join(pasta, f));

let falhou = 0;
for (const arquivo of arquivos) {
  const r = spawnSync(process.execPath, [arquivo], { encoding: 'utf8' });
  const linhas = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n');
  console.log(`${basename(arquivo)}: ${linhas[linhas.length - 1]}`);
  if (r.status !== 0) {
    falhou++;
    console.log(linhas.slice(-20).join('\n'));
  }
}
console.log(falhou ? `\n${falhou} arquivo(s) com falha` : `\n${arquivos.length} arquivo(s) ok`);
process.exit(falhou ? 1 : 0);
