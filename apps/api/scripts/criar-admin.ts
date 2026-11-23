// Cria o administrador. Uso:
//   pnpm --filter api criar-admin -- --matricula 123456-7 --posto "CAP" --nome-guerra FULANO --email fulano@exemplo.com --lotacao "1ª SB"
// --lotacao é a sigla da unidade do militar do administrador (de qualquer tipo). Sem ela, o militar fica sem lotação (não aparece nas buscas, listas e escalas): quem tem
// nível de administrador dá a lotação depois, na ficha dele (Alterar situação).
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
    lotacao: { type: 'string' },
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
    matricula: a.matricula, postoSigla: a.posto, nomeGuerra: a['nome-guerra'], email: a.email, senha, hoje: hojeRecife(), lotacao: a.lotacao,
  });
  console.log(`Administrador criado (usuário ${r.usuarioId}).`);
  if (r.lotado) console.log(`Militar lotado em ${a.lotacao}.`);
  else if (a.lotacao) console.log('O militar já tinha lotação, e ela não foi mudada.');
  else console.log('Atenção: se o militar do administrador está sem lotação, dê a lotação na ficha dele (Alterar situação) para ele aparecer nas buscas, listas e escalas.');
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await banco.fechar();
}
