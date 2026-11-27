// "Recomeçar" o Laboratório (6.59): o espelho volta ao estado da carga de teste. O espelho é refeito do zero numa transação só (apaga o schema, aplica de novo as migrações,
// refaz o papel e a carga): o que as migrações semeiam (unidades, postos, tipos) volta junto, e se qualquer passo falhar o espelho fica como estava. As sessões no
// Laboratório (no real) continuam valendo, porque os cinco perfis voltam com os mesmos ids. Nada do `public` é tocado.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Banco } from '../banco/banco.ts';
import { PASTA_MIGRACOES } from '../banco/migrar.ts';
import { SCHEMA_ESPELHO } from './constantes.ts';
import { cargaDoEspelhoEm, prepararPapelDoEspelho } from './espelho.ts';

export async function recomecarEspelho(banco: Banco, mes: string, pasta = PASTA_MIGRACOES): Promise<{ militares: number; perfis: number }> {
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
  return banco.transacao(async (tx) => {
    await tx.exec(`drop schema if exists ${SCHEMA_ESPELHO} cascade; create schema ${SCHEMA_ESPELHO}`);
    await tx.exec(`create table ${SCHEMA_ESPELHO}.migracao_aplicada (nome text primary key, aplicada_em timestamptz not null default now())`);
    for (const nome of arquivos) {
      await tx.exec(`set local search_path to ${SCHEMA_ESPELHO}, public`);
      await tx.exec(readFileSync(join(pasta, nome), 'utf8'));
      await tx.query(`insert into ${SCHEMA_ESPELHO}.migracao_aplicada (nome) values ($1)`, [nome]);
    }
    await tx.exec('reset search_path');
    await prepararPapelDoEspelho(tx);
    const r = await cargaDoEspelhoEm(tx, mes);
    // a transação volta a ser do dono: quem chama segue como o banco real
    await tx.exec('reset role');
    return r;
  });
}
