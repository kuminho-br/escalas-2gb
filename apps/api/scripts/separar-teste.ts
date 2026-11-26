// Tira do banco REAL os militares fictícios (matrícula 990…) e tudo o que depende deles (6.58). Uso:
//   pnpm --filter api separar-teste:teste             só lista o que é de teste (nada é apagado)
//   pnpm --filter api separar-teste:teste --aplicar   tira do banco, depois de conferir a lista
// A carga fictícia vai para o espelho, não para cá: `pnpm --filter api carga-exemplo --espelho`.
// Usa DATABASE_URL (sem ela, recusa: o banco local de desenvolvimento não precisa disso).
import { bancoPg } from '../src/banco/banco.ts';
import { separarTeste } from '../src/laboratorio/separar.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}
const aplicar = process.argv.includes('--aplicar');
const banco = bancoPg(url);
try {
  await separarTeste(banco, { aplicar, escrever: (linha) => console.log(linha) });
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await banco.fechar();
}
