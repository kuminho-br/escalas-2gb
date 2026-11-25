// Confere o vercel.json (6.47): só a `main` faz deploy; as branches dos PRs não ganham deploy nenhum (nem o que o Vercel cria antes do ignoreCommand e que conta no limite diário).
// A regra é a da documentação do Vercel (git.deploymentEnabled): um objeto de padrões de branch (minimatch) para true ou false; a branch que nenhum padrão cobre
// fica ligada; a branch que casa com vários padrões faz deploy se pelo menos um for true. Um erro aqui desliga o deploy da main, por isso o teste simula a regra.
// Uso: node scripts/testar-vercel-json.mjs
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(raiz, 'vercel.json'), 'utf8'));

/** O padrão como o minimatch o entende no que usamos: `**` casa qualquer coisa (barras incluídas), `*` casa tudo menos barra, o resto é literal. */
function casa(padrao, branch) {
  const regex = padrao
    .split('**')
    .map((parte) => parte.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${regex}$`).test(branch);
}

/** Faz deploy? Sem padrão que a cubra, sim; com padrões, se pelo menos um que a cubra for true. */
function fazDeploy(regras, branch) {
  if (typeof regras === 'boolean') return regras;
  const cobrem = Object.entries(regras).filter(([padrao]) => casa(padrao, branch));
  return cobrem.length === 0 ? true : cobrem.some(([, ligado]) => ligado === true);
}

const regras = config.git?.deploymentEnabled;
let falhas = 0;
const confere = (nome, ok) => {
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${nome}`);
};

// o simulador acima só entende `**`, `*` e texto literal; um padrão com `?`, `{a,b}`, `!` ou `[...]` daria resultado errado aqui, então o teste recusa
if (regras && typeof regras === 'object') confere('os padrões só usam `**`, `*` e texto literal (o que este teste sabe simular)', Object.keys(regras).every((padrao) => /^[\w.\-/*]+$/.test(padrao)));
confere('o vercel.json tem git.deploymentEnabled como objeto de padrões (não um booleano, que desligaria a main junto)', !!regras && typeof regras === 'object' && !Array.isArray(regras));
if (regras && typeof regras === 'object') {
  confere('Review Focus 1: a main faz deploy', fazDeploy(regras, 'main'));
  for (const branch of ['fase6-47-sem-deploy-nas-branches', 'docs-6-47-sem-deploy-nas-branches', 'p1-1-quadros', 'claude/exemplo', 'dependabot/npm_and_yarn/vite-7.0.0', 'main-antiga', 'Main', 'maintenance']) {
    confere(`a branch ${branch} não faz deploy`, !fazDeploy(regras, branch));
  }
}
// Review Focus 2: o ignoreCommand da 6.41 e o script seguem no lugar (a main só de documentação continua pulada)
confere('Review Focus 2: o ignoreCommand continua apontando para o script da 6.41', config.ignoreCommand === 'bash scripts/deploy-so-com-codigo.sh' && existsSync(join(raiz, 'scripts/deploy-so-com-codigo.sh')));

console.log(falhas ? `${falhas} falha(s)` : 'vercel.json: tudo ok');
process.exit(falhas ? 1 : 0);
