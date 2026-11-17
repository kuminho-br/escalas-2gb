import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Banco PGlite do desenvolvimento local (fora do Git, em apps/api/.dados). */
export const PASTA_DADOS_LOCAL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.dados', 'pglite');
