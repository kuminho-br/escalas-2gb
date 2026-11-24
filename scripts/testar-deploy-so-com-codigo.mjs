// Confere o script que decide se o Vercel faz o deploy (6.41): sai com 0 (pular) só quando todos os arquivos mudados são documento.
// Cada caso monta um repositório temporário com dois commits e roda o script como o Vercel roda (VERCEL_GIT_PREVIOUS_SHA = o commit anterior).
// Uso: node scripts/testar-deploy-so-com-codigo.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'deploy-so-com-codigo.sh');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=teste', '-c', 'user.email=teste@exemplo.test', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();

/** Monta o repositório (commit 1 com a base) e aplica `mudar` no commit 2; devolve o código de saída do script e o commit anterior. */
function rodar(mudar, { semReferencia = false, ambiente = '' } = {}) {
  const pasta = mkdtempSync(join(tmpdir(), 'deploy-'));
  try {
    git(pasta, 'init', '-q');
    for (const [caminho, texto] of Object.entries({ 'docs/base.md': 'a', 'apps/api/src/velho.ts': 'a', 'vercel.json': '{}', 'CLAUDE.md': 'a' })) {
      mkdirSync(dirname(join(pasta, caminho)), { recursive: true });
      writeFileSync(join(pasta, caminho), texto);
    }
    git(pasta, 'add', '-A');
    git(pasta, 'commit', '-q', '-m', 'base');
    const anterior = git(pasta, 'rev-parse', 'HEAD');
    mudar(pasta);
    git(pasta, 'add', '-A');
    git(pasta, 'commit', '-q', '--allow-empty', '-m', 'mudança');
    const r = spawnSync('bash', [script], { cwd: pasta, env: { ...process.env, VERCEL_ENV: ambiente, VERCEL_GIT_PREVIOUS_SHA: semReferencia ? '' : anterior }, encoding: 'utf8' });
    return r.status;
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}
const escreve = (pasta, caminho, texto = 'b') => {
  mkdirSync(dirname(join(pasta, caminho)), { recursive: true });
  writeFileSync(join(pasta, caminho), texto);
};

const casos = [
  ['só documento em docs/: pula o deploy (0)', (p) => escreve(p, 'docs/x.md'), 0],
  ['só um documento fora de docs/ (CLAUDE.md): pula (0)', (p) => escreve(p, 'CLAUDE.md'), 0],
  ['documentos de tipos diferentes dentro de docs/ (docs/telas): pula (0)', (p) => { escreve(p, 'docs/telas/a.html'); escreve(p, 'docs/y.md'); }, 0],
  ['Review Focus 1: documento e código no mesmo commit: deploy (1)', (p) => { escreve(p, 'docs/x.md'); escreve(p, 'apps/api/src/a.ts'); }, 1],
  ['mexer no vercel.json: deploy (1)', (p) => escreve(p, 'vercel.json', '{"a":1}'), 1],
  ['mexer em pacotes/, scripts/, casos/ ou prototipo/: deploy (1)', (p) => escreve(p, 'prototipo/x.js'), 1],
  ['um .md dentro de apps/ também é documento (pula), mas um .ts ao lado dele não (1)', (p) => { escreve(p, 'apps/web/LEIAME.md'); escreve(p, 'apps/web/src/a.tsx'); }, 1],
  ['Review Focus 2: código removido e um .md criado no lugar: deploy (1), o arquivo antigo conta', (p) => { unlinkSync(join(p, 'apps/api/src/velho.ts')); escreve(p, 'apps/api/src/velho.md'); }, 1],
  ['renomear código para .md (git mv): deploy (1)', (p) => renameSync(join(p, 'apps/api/src/velho.ts'), join(p, 'apps/api/src/velho.md')), 1],
  ['nada mudou desde o último deploy (um redeploy do mesmo commit): deploy (1), na dúvida o deploy vale', () => {}, 1],
];

let falhas = 0;
for (const [nome, mudar, esperado] of casos) {
  const saida = rodar(mudar);
  const ok = saida === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome} -> ${saida} (esperado ${esperado})`);
}
// 6.43: os PRs não geram prévia (VERCEL_ENV=preview pula sempre); a produção segue a regra da 6.41; sem a variável também
const codigo = (p) => escreve(p, 'apps/api/src/a.ts');
const documento = (p) => escreve(p, 'docs/x.md');
const porAmbiente = [
  ['prévia de PR com código mudado: pula (0)', codigo, { ambiente: 'preview' }, 0],
  ['prévia de PR só com documentação: pula (0)', documento, { ambiente: 'preview' }, 0],
  ['prévia de PR sem a referência do deploy anterior: pula (0), a prévia nunca faz deploy', codigo, { ambiente: 'preview', semReferencia: true }, 0],
  ['Review Focus 1: produção com código mudado: deploy (1)', codigo, { ambiente: 'production' }, 1],
  ['produção só com documentação: pula (0)', documento, { ambiente: 'production' }, 0],
  ['produção sem a referência do deploy anterior: deploy (1)', documento, { ambiente: 'production', semReferencia: true }, 1],
  ['Review Focus 2: sem VERCEL_ENV e com código mudado: deploy (1), não pula tudo', codigo, { ambiente: '' }, 1],
  ['outro valor de VERCEL_ENV (development) com código mudado: deploy (1), só "preview" pula', codigo, { ambiente: 'development' }, 1],
];
for (const [nome, mudar, opcoes, esperado] of porAmbiente) {
  const saida = rodar(mudar, opcoes);
  const ok = saida === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome} -> ${saida} (esperado ${esperado})`);
}
// Review Focus 3: sem a referência do deploy anterior, o script faz o deploy e não dá erro
const semRef = rodar((p) => escreve(p, 'docs/x.md'), { semReferencia: true });
const okRef = semRef === 1;
if (!okRef) falhas++;
console.log(`${okRef ? 'ok   ' : 'FALHA'} Review Focus 3: sem VERCEL_GIT_PREVIOUS_SHA: deploy (1) -> ${semRef} (esperado 1)`);
// uma referência que não existe no clone (clone raso): deploy, não erro
const pasta = mkdtempSync(join(tmpdir(), 'deploy-'));
try {
  git(pasta, 'init', '-q');
  writeFileSync(join(pasta, 'a.md'), 'a');
  git(pasta, 'add', '-A');
  git(pasta, 'commit', '-q', '-m', 'um');
  const r = spawnSync('bash', [script], { cwd: pasta, env: { ...process.env, VERCEL_ENV: '', VERCEL_GIT_PREVIOUS_SHA: '0123456789abcdef0123456789abcdef01234567' }, encoding: 'utf8' });
  const ok = r.status === 1;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} referência que não está no clone: deploy (1) -> ${r.status} (esperado 1)`);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
console.log(falhas ? `${falhas} falha(s)` : 'deploy-so-com-codigo: tudo ok');
process.exit(falhas ? 1 : 0);
