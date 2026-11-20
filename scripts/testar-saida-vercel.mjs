// Confere a função empacotada em .vercel/output: carrega o arquivo e responde por HTTP.
// Uso: node scripts/testar-saida-vercel.mjs   (depois de node scripts/build-vercel.mjs)
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivo = pathToFileURL(join(raiz, '.vercel', 'output', 'functions', 'api.func', 'index.mjs')).href;

async function conferir(nome, env, esperado) {
  const antes = { ...process.env };
  Object.assign(process.env, env);
  const { default: handler } = await import(`${arquivo}?${nome}`);
  process.env = antes;
  const servidor = createServer(handler).listen(0);
  const porta = servidor.address().port;
  let falhas = 0;
  for (const [caminho, status] of esperado) {
    const r = await fetch(`http://127.0.0.1:${porta}${caminho}`);
    const ok = r.status === status;
    if (!ok) falhas++;
    console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome} ${caminho} -> ${r.status} (esperado ${status})`);
  }
  servidor.close();
  return falhas;
}

let falhas = 0;
falhas += await conferir('previa', { DATABASE_URL: '' }, [['/api/saude', 200], ['/api/eu', 503]]);
falhas += await conferir(
  'producao',
  {
    DATABASE_URL: 'postgres://ninguem:nada@127.0.0.1:1/inexistente',
    BETTER_AUTH_SECRET: 'segredo-de-teste-com-tamanho-suficiente-123',
    BETTER_AUTH_URL: 'https://exemplo.test',
    CRON_SECRET: 'cron',
  },
  [['/api/saude', 200], ['/api/saude/banco', 401]],
);

process.exit(falhas ? 1 : 0);
