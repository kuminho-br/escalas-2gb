// Monta a saída da Vercel (Build Output API v3) em .vercel/output:
// - static/: o site (apps/web/dist)
// - functions/api.func/: a API empacotada num único arquivo (sem PGlite)
// - config.json: rotas (/api/* vai para a função; o resto é o site) e o cron que mantém o banco acordado
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = join(raiz, '.vercel', 'output');
const funcao = join(saida, 'functions', 'api.func');

execSync('pnpm --filter web build', { cwd: raiz, stdio: 'inherit' });

rmSync(saida, { recursive: true, force: true });
mkdirSync(funcao, { recursive: true });
cpSync(join(raiz, 'apps', 'web', 'dist'), join(saida, 'static'), { recursive: true });

await build({
  entryPoints: [join(raiz, 'apps', 'api', 'src', 'vercel.ts')],
  outfile: join(funcao, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // pacotes CommonJS (pg) dentro de um módulo ESM precisam de require
  banner: { js: "import { createRequire as __criarRequire } from 'node:module'; const require = __criarRequire(import.meta.url);" },
  external: ['pg-native', '@electric-sql/pglite', 'kysely-pglite-dialect'],
  logLevel: 'warning',
});

writeFileSync(join(funcao, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(
  join(funcao, '.vc-config.json'),
  JSON.stringify({
    runtime: 'nodejs22.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: false,
    regions: ['gru1'],
    maxDuration: 30,
  }, null, 2),
);
writeFileSync(
  join(saida, 'config.json'),
  JSON.stringify({
    version: 3,
    routes: [
      { src: '^/api(/.*)?$', dest: '/api' },
      { handle: 'filesystem' },
      { src: '^/(.*)$', dest: '/index.html' },
    ],
    crons: [{ path: '/api/saude/banco', schedule: '0 12 */3 * *' }],
  }, null, 2),
);
console.log('Saída da Vercel em .vercel/output');
