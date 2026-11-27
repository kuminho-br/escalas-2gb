// Em que quadro a cena do login está, dado o tempo (em segundos) desde o clique em "Entrar" e a resposta do servidor. Sem tela.

/** A resposta do servidor e o instante em que chegou (segundos desde o clique); null enquanto não chegou. */
export type Resposta = { tipo: 'aprovada' | 'recusada'; em: number } | null;
export type Quadro = 'clique' | 'chegada' | 'batida' | 'espera' | 'agua' | 'afastamento' | 'boas-vindas' | 'recuo' | 'fim-do-erro';

/** Os tempos da cena. A batida é sempre aos 0,50 s; a água nunca antes de 0,90 s; o erro nunca antes de 0,85 s. */
export const TEMPOS = {
  /** o escuro fecha de vez: a partir daqui a tela por baixo da cena pode ser trocada */
  coberta: 0.4,
  /** as mangueiras começam a entrar */
  chegada: 0.1,
  batida: 0.5,
  /** as garras dão o quarto de volta */
  giroInicio: 0.52,
  trava: 0.7,
  aguaMinima: 0.9,
  erroMinimo: 0.85,
  /** a mangueira enche */
  pressurizacao: 1.05,
  /** a câmera começa a se afastar este tanto depois da água */
  afastamentoInicio: 0.42,
  /** e leva este tanto: as boas-vindas chegam 1,7 s depois da água */
  afastamento: 1.28,
  recuo: 0.5,
  /** "Entrando…" aparece, se o servidor ainda não respondeu */
  entrando: 1.6,
  /** as brasas ficam sobre a faixa depois do pouso (6.67: 4,2 s) */
  brasas: 4.2,
  /** e apagam nos últimos 1,6 s dessa duração */
  apaga: 1.6,
} as const;

/** Só vale a resposta que já chegou em `t`. */
const chegou = (t: number, resposta: Resposta) => (resposta && t >= resposta.em ? resposta : null);

/** Quando a água começa: na aprovação, mas nunca antes de 0,90 s. */
export function inicioDaAgua(resposta: Resposta): number | null {
  return resposta?.tipo === 'aprovada' ? Math.max(TEMPOS.aguaMinima, resposta.em) : null;
}

/** Quando as mangueiras começam a recuar: na recusa (ou na falha do servidor), mas nunca antes de 0,85 s. */
export function inicioDoRecuo(resposta: Resposta): number | null {
  return resposta?.tipo === 'recusada' ? Math.max(TEMPOS.erroMinimo, resposta.em) : null;
}

/** Quando as boas-vindas aparecem: 1,7 s depois da água. */
export function inicioDasBoasVindas(resposta: Resposta): number | null {
  const agua = inicioDaAgua(resposta);
  return agua === null ? null : agua + TEMPOS.afastamentoInicio + TEMPOS.afastamento;
}

export function quadroEm(t: number, resposta: Resposta): Quadro {
  const r = chegou(t, resposta);
  const agua = inicioDaAgua(r);
  if (agua !== null && t >= agua) {
    if (t >= agua + TEMPOS.afastamentoInicio + TEMPOS.afastamento) return 'boas-vindas';
    return t >= agua + TEMPOS.afastamentoInicio ? 'afastamento' : 'agua';
  }
  const recuo = inicioDoRecuo(r);
  if (recuo !== null && t >= recuo) return t >= recuo + TEMPOS.recuo ? 'fim-do-erro' : 'recuo';
  if (t < TEMPOS.chegada) return 'clique';
  if (t < TEMPOS.batida) return 'chegada';
  return t < TEMPOS.trava ? 'batida' : 'espera';
}

/** "Entrando…": 1,6 s depois do clique, enquanto o servidor não respondeu. */
export function mostraEntrando(t: number, resposta: Resposta): boolean {
  return t >= TEMPOS.entrando && chegou(t, resposta) === null;
}
