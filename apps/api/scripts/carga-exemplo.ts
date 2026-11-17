import { bancoPg } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar } from '../src/banco/migrar.ts';
import { cargaExemplo } from '../src/carga/exemplo.ts';
import { hojeRecife, inicioDoMes } from '../src/datas.ts';
import { PASTA_DADOS_LOCAL } from '../src/banco/local.ts';

const url = process.env.DATABASE_URL;
const banco = url ? bancoPg(url) : await bancoPglite(PASTA_DADOS_LOCAL);
try {
  if (!url) await migrar(banco);
  const r = await cargaExemplo(banco, process.env.AMBIENTE, inicioDoMes(hojeRecife()));
  console.log(`Militares de exemplo: ${r.militares}`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await banco.fechar();
}
