// O pequeno armazém da transição do login: a tela de login manda (`iniciar`, `aprovar`, `recusar`) e a camada do `canvas`, montada fora
// das rotas, desenha. O relógio da cena anda aqui, e não no componente, para a cena continuar enquanto o site troca /entrar por /.
import { useSyncExternalStore } from 'react';
import { prepararRecortes } from './cena';
import { inicioDaAgua, inicioDasBoasVindas, inicioDoRecuo, mostraEntrando, quadroEm, TEMPOS, type Resposta } from './linha-do-tempo';
import { marcarInteira } from './regra';

/** O relógio da cena, num objeto para os testes poderem conduzir o tempo. */
export const relogio = {
  agora: (): number => performance.now(),
  quadro: (f: (agora: number) => void): number => requestAnimationFrame(f),
  cancelar: (id: number): void => cancelAnimationFrame(id),
};

/**
 * O que as telas precisam saber: `cobrindo` (a cena cobre a tela toda), `afastando` (a câmera se afasta e a tela inicial aparece em volta),
 * `pousou` (a cena virou a faixa de boas-vindas; a saudação entra) e `parada`.
 */
export type Transicao = { fase: 'parada' | 'cobrindo' | 'afastando' | 'pousou'; entrando: boolean; cartoes: boolean };
/** O que a camada desenha num quadro; null = limpar e esconder o `canvas`. */
export type QuadroDaCamada = { t: number; resposta: Resposta; imagem: HTMLImageElement; botao: { x: number; y: number; w: number } | null; some: number } | null;

const PARADA: Transicao = { fase: 'parada', entrando: false, cartoes: true };
const SUMICO = 0.3;
export const MARCA_DA_FAIXA = 'data-faixa-boas-vindas';

let imagem: HTMLImageElement | null = null;
let pronta = false;
let estado: Transicao = PARADA;
let t0: number | null = null;
let resposta: Resposta = null;
let botao: { x: number; y: number; w: number } | null = null;
/** sem a faixa na tela na hora do afastamento, a camada some a partir daqui (em segundos da cena) */
let sumirDesde: number | null = null;
let marcada = false;
let pedido = 0;
let aoFimDoErro: (() => void)[] = [];
let aoCobrir: (() => void)[] = [];
let pintor: ((q: QuadroDaCamada) => void) | null = null;
const ouvintes = new Set<() => void>();

function publicar(novo: Transicao) {
  if (novo.fase === estado.fase && novo.entrando === estado.entrando && novo.cartoes === estado.cartoes) return;
  estado = novo;
  for (const f of ouvintes) f();
}
const temCanvas = () => {
  try {
    return Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
};

/** Carrega a imagem da cena e faz os recortes dela; chamado quando a tela de login abre. Sem `canvas` ou sem a imagem, a cena nunca fica pronta. */
export function preparar(): void {
  if (imagem || typeof Image === 'undefined') return;
  const img = new Image();
  imagem = img;
  img.onload = () => {
    try {
      if (!temCanvas()) return;
      prepararRecortes(img);
      pronta = true;
    } catch {
      pronta = false;
    }
  };
  img.onerror = () => {
    // deixa tentar de novo na próxima vez que o login abrir
    if (imagem === img) imagem = null;
  };
  img.src = '/boas-vindas.jpg';
}

export function cenaPronta(): boolean {
  return pronta && imagem !== null;
}

function resolverErro() {
  const fila = aoFimDoErro;
  aoFimDoErro = [];
  for (const f of fila) f();
}
function resolverCobertura() {
  const fila = aoCobrir;
  aoCobrir = [];
  for (const f of fila) f();
}
function terminar() {
  if (pedido) relogio.cancelar(pedido);
  pedido = 0;
  t0 = null;
  resposta = null;
  sumirDesde = null;
  resolverErro();
  resolverCobertura();
  try {
    pintor?.(null);
  } catch {
    // idem
  }
  publicar(PARADA);
}
function tique() {
  pedido = 0;
  if (t0 === null || !imagem) return;
  const t = (relogio.agora() - t0) / 1000;
  const quadro = quadroEm(t, resposta);
  const chegando = quadro === 'afastamento' || quadro === 'boas-vindas';
  if (chegando && sumirDesde === null && !document.querySelector(`[${MARCA_DA_FAIXA}]`)) sumirDesde = t;

  // com o escuro fechado, a tela de login já pode dar lugar à inicial, por baixo da cena
  if (t >= TEMPOS.coberta) resolverCobertura();

  let fim = false;
  if (sumirDesde !== null) {
    // a pessoa foi para outra página (ou vai criar a senha): a camada some e a tela fica livre
    publicar(PARADA);
    fim = t >= sumirDesde + SUMICO;
  } else if (quadro === 'boas-vindas') {
    if (!marcada) {
      marcada = true;
      marcarInteira(Date.now());
    }
    publicar({ fase: 'pousou', entrando: false, cartoes: true });
    fim = t >= inicioDasBoasVindas(resposta)! + TEMPOS.brasas;
  } else if (quadro === 'afastamento') {
    const z0 = inicioDaAgua(resposta)! + TEMPOS.afastamentoInicio;
    publicar({ fase: 'afastando', entrando: false, cartoes: t >= z0 + 0.55 * TEMPOS.afastamento });
  } else if (quadro === 'fim-do-erro') {
    // o cartão volta (as telas deixam de estar travadas antes de a promessa se cumprir); o escuro ainda clareia por um instante
    publicar(PARADA);
    resolverErro();
    fim = t >= inicioDoRecuo(resposta)! + TEMPOS.recuo + SUMICO;
  } else publicar({ fase: 'cobrindo', entrando: mostraEntrando(t, resposta), cartoes: false });

  if (fim) {
    terminar();
    return;
  }
  try {
    pintor?.({ t, resposta, imagem, botao, some: sumirDesde === null ? 1 : Math.max(0, 1 - (t - sumirDesde) / SUMICO) });
  } catch {
    // um quadro que não deu para desenhar não pode prender a tela: a linha do tempo segue, e as promessas se cumprem na hora delas
  }
  pedido = relogio.quadro(tique);
}

/** Começa a cena, no clique em "Entrar". `doBotao` é o retângulo do botão, de onde sobem as primeiras brasas. */
export function iniciar(doBotao?: DOMRect | null): void {
  if (!cenaPronta()) return;
  if (pedido) relogio.cancelar(pedido);
  resolverErro();
  resolverCobertura();
  t0 = relogio.agora();
  resposta = null;
  sumirDesde = null;
  marcada = false;
  botao = doBotao ? { x: doBotao.left + doBotao.width / 2, y: doBotao.top + doBotao.height / 2, w: doBotao.width } : null;
  publicar({ fase: 'cobrindo', entrando: false, cartoes: false });
  pedido = relogio.quadro(tique);
}

/**
 * Cumpre-se quando o escuro cobre a tela toda (0,40 s depois do clique), ou na hora, sem cena tocando. Só então a tela de login deve dar
 * lugar à inicial, para a troca não aparecer por baixo da cena.
 */
export function cobrir(): Promise<void> {
  if (t0 === null || (relogio.agora() - t0) / 1000 >= TEMPOS.coberta) return Promise.resolve();
  return new Promise((resolve) => aoCobrir.push(resolve));
}

/**
 * O servidor aprovou e a tela inicial já está montada por baixo da cena: a água começa (nunca antes de 0,90 s) e a cena segue até as
 * boas-vindas. Enquanto isto não é chamado, a cena espera na junta travada.
 */
export function aprovar(): void {
  if (t0 === null || resposta) return;
  resposta = { tipo: 'aprovada', em: (relogio.agora() - t0) / 1000 };
}

/** O servidor recusou ou não respondeu: as mangueiras recuam. A promessa se cumpre quando o recuo acaba (ou na hora, sem cena tocando). */
export function recusar(): Promise<void> {
  if (t0 === null || resposta?.tipo === 'aprovada') {
    // a cena não está tocando, ou já tinha sido aprovada (a falha veio depois): desfaz o que houver e segue
    if (t0 !== null) terminar();
    return Promise.resolve();
  }
  if (!resposta) resposta = { tipo: 'recusada', em: (relogio.agora() - t0) / 1000 };
  return new Promise((resolve) => aoFimDoErro.push(resolve));
}

/** A camada registra aqui a função que desenha um quadro; null ao desmontar. */
export function registrarPintor(f: ((q: QuadroDaCamada) => void) | null): void {
  pintor = f;
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
};
const instantaneo = () => estado;
/** O estado da transição, para as telas reagirem (o cartão do login some, a saudação entra). */
export function useTransicao(): Transicao {
  return useSyncExternalStore(assinar, instantaneo, instantaneo);
}
