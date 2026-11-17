import type { Importador } from './tipos.ts';

/** Cadastros importáveis da planilha sandbox, pelo nome usado na rota. */
export const IMPORTADORES: Record<string, Importador<unknown>> = {};
