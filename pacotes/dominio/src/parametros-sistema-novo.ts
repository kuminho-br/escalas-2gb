// Parâmetros que só existem no sistema novo. `PARAM_CATALOGO` (parametros.ts) é porte do protótipo e tem casos gravados
// (`resolverParametros_`), então não recebe chaves daqui.
import { PARAM_CATALOGO, type DefParametro } from './parametros.ts';

export const PARAM_SISTEMA_NOVO: DefParametro[] = [
  {
    chave: 'FLEXIBILIDADE_VOLUNTARIADO_HORAS', grupo: 'Voluntariado', rotulo: 'Flexibilidade do voluntariado (horas)', tipo: 'inteiro', padrao: 0, min: 0, max: 3,
    descricao: 'Horas que podem faltar no começo ou no fim do turno para o militar ainda contar como voluntário. Buraco no meio do turno não conta.',
  },
];

/** A definição de uma chave: primeiro o catálogo do protótipo, depois os parâmetros do sistema novo. */
export function defDoSistema(chave: string): DefParametro | null {
  return PARAM_CATALOGO.find((d) => d.chave === chave) ?? PARAM_SISTEMA_NOVO.find((d) => d.chave === chave) ?? null;
}
