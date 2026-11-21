import { importadorConfiguracoes } from './configuracoes.ts';
import { importadorCotas } from './cotas.ts';
import { importadorFeriados } from './feriados.ts';
import { importadorGuarnicoes } from './guarnicoes.ts';
import { importadorMilitares } from './militares.ts';
import { importadorPeculio } from './peculio.ts';
import { importadorServicosEscalas } from './servicos-escalas.ts';
import type { Importador } from './tipos.ts';

/** Cadastros importáveis da planilha sandbox, pelo nome usado na rota. */
export const IMPORTADORES: Record<string, Importador<unknown>> = {
  configuracoes: importadorConfiguracoes as Importador<unknown>,
  cotas: importadorCotas as Importador<unknown>,
  feriados: importadorFeriados as Importador<unknown>,
  guarnicoes: importadorGuarnicoes as Importador<unknown>,
  militares: importadorMilitares as Importador<unknown>,
  peculio: importadorPeculio as Importador<unknown>,
  'servicos-escalas': importadorServicosEscalas as Importador<unknown>,
};
