// Aplica as migrações pendentes. Elas valem para o real (schema public) e para o espelho do Laboratório (schema laboratorio), no mesmo passo:
// a primeira execução depois da 6.58 também cria o espelho e o papel de banco dele. Usa DATABASE_URL.
import { bancoPg } from '../src/banco/banco.ts';
import { migrar } from '../src/banco/migrar.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL.');
  process.exit(1);
}
const banco = bancoPg(url);
try {
  const aplicadas = await migrar(banco);
  console.log(aplicadas.length ? `Aplicadas: ${aplicadas.join(', ')}` : 'Nada a aplicar.');
} finally {
  await banco.fechar();
}
