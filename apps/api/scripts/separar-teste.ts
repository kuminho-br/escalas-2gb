// Separa do banco REAL os militares fictícios e tudo o que depende deles (6.58). O que é de teste é dito pela marca `militar.de_teste`, nunca pela matrícula
// (990xxx-x é de militar real). Três passos, cada um com a conferência da quantidade que a lista mostrou:
//   pnpm --filter api separar-teste:teste               só lista: os candidatos seguros, os suspeitos (com o motivo) e os já marcados; nada é alterado
//   pnpm --filter api separar-teste:teste --marcar=N    marca como teste os N candidatos seguros da lista (o suspeito nunca é marcado pelo script)
//   pnpm --filter api separar-teste:teste --aplicar=N   tira do banco os N militares marcados e o que depende deles
// A carga fictícia vai para o espelho, não para cá: `pnpm --filter api carga-exemplo --espelho`.
// Usa DATABASE_URL (sem ela, recusa: o banco local de desenvolvimento não precisa disso).
import { bancoPg } from '../src/banco/banco.ts';
import { passoDoScript, separarTeste } from '../src/laboratorio/separar.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}
let argumentos: ReturnType<typeof passoDoScript>;
try {
  argumentos = passoDoScript(process.argv.slice(2));
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const banco = bancoPg(url);
try {
  await separarTeste(banco, { passo: argumentos.passo, confirmar: argumentos.confirmar, escrever: (linha) => console.log(linha) });
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await banco.fechar();
}
