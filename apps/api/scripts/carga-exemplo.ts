import { bancoPg } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar } from '../src/banco/migrar.ts';
import { cargaExemplo, motivoParaRecusarExemplo } from '../src/carga/exemplo.ts';
import { cargaDoEspelho, SCHEMA_ESPELHO } from '../src/laboratorio/espelho.ts';
import { hojeRecife, inicioDoMes } from '../src/datas.ts';
import { PASTA_DADOS_LOCAL } from '../src/banco/local.ts';

// Sem opção, a carga vai para o real (só em banco de desenvolvimento). Com --espelho, vai para o espelho do Laboratório (os militares fictícios e os
// cinco usuários de teste), o único lugar em que a carga fictícia pode entrar no ambiente de teste.
const noEspelho = process.argv.includes('--espelho');
const recusa = motivoParaRecusarExemplo(process.env, noEspelho ? SCHEMA_ESPELHO : 'public');
if (recusa) {
  console.error(recusa);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
const banco = url ? bancoPg(url) : await bancoPglite(PASTA_DADOS_LOCAL);
try {
  if (!url) await migrar(banco);
  const mes = inicioDoMes(hojeRecife());
  if (noEspelho) {
    const r = await cargaDoEspelho(banco, mes);
    console.log(`Espelho: ${r.militares} militares de exemplo e ${r.perfis} usuários de teste.`);
  } else {
    const r = await cargaExemplo(banco, process.env.AMBIENTE, mes);
    console.log(`Militares de exemplo: ${r.militares}`);
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await banco.fechar();
}
