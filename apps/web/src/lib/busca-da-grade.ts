import { Data, Mes } from 'contratos';

/** Os parâmetros do endereço da Grade geral. */
export type BuscaDaGrade = { mes?: string; equipes?: string[]; busca?: string; militar?: string; dia?: string; ficha?: string };

/** `equipes` é uma lista de textos não vazios; um endereço antigo com só `equipe` (texto) vale como uma lista de uma. */
function equipesDaBusca(s: Record<string, unknown>): string[] | undefined {
  const lista = Array.isArray(s.equipes) ? s.equipes.filter((e): e is string => typeof e === 'string' && e !== '') : [];
  if (!lista.length && typeof s.equipe === 'string' && s.equipe) lista.push(s.equipe);
  return lista.length ? lista : undefined;
}

export function buscaDaGrade(s: Record<string, unknown>): BuscaDaGrade {
  return {
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
    equipes: equipesDaBusca(s),
    busca: typeof s.busca === 'string' && s.busca.trim() ? s.busca : undefined,
    militar: typeof s.militar === 'string' && s.militar ? s.militar : undefined,
    dia: typeof s.dia === 'string' && Data.safeParse(s.dia).success ? s.dia : undefined,
    /** o militar cuja ficha está aberta por cima da Grade (a janela da ficha da escala) */
    ficha: typeof s.ficha === 'string' && s.ficha ? s.ficha : undefined,
  };
}

/** O endereço antigo da Grade (em /) leva algum desses parâmetros. */
export const temBuscaDaGrade = (b: BuscaDaGrade) => Object.values(b).some((v) => v !== undefined);
