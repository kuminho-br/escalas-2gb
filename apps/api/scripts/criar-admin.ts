// Cria o administrador. Uso:
//   pnpm --filter api criar-admin -- --matricula 123456-7 --posto "CAP" --nome-guerra FULANO --email fulano@exemplo.com
// A senha vem de SENHA_ADMIN ou é pedida no terminal. Usa DATABASE_URL (sem ela, o PGlite local).
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { bancoPg } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { PASTA_DADOS_LOCAL } from '../src/banco/local.ts';
import { migrar } from '../src/banco/migrar.ts';
import { hojeRecife } from '../src/datas.ts';
import { criarAdmin } from '../src/usuarios/criar-admin.ts';

const { values: a } = parseArgs({
  options: {
    matricula: { type: 'string' },
    posto: { type: 'string' },
    'nome-guerra': { type: 'string' },
    email: { type: 'string' },
  },
});
if (!a.matricula || !a.posto || !a['nome-guerra'] || !a.email) {
  console.error('Informe --matricula, --posto, --nome-guerra e --email.');
  process.exit(1);
}

let senha = process.env.SENHA_ADMIN;
if (!senha) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  senha = await rl.question('Senha (mínimo 10 caracteres): ');
  rl.close();
}
if (senha.length < 10) {
  console.error('A senha precisa ter pelo menos 10 caracteres.');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
const banco = url ? bancoPg(url) : await bancoPglite(PASTA_DADOS_LOCAL);
try {
  if (!url) await migrar(banco);
  const r = await criarAdmin(banco, {
    matricula: a.matricula, postoSigla: a.posto, nomeGuerra: a['nome-guerra'], email: a.email, senha, hoje: hojeRecife(),
  });
  console.log(`Administrador criado (usuário ${r.usuarioId}).`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await banco.fechar();
}
