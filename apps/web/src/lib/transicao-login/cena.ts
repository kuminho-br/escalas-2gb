// O desenho de um quadro da transição do login, portado do script do mockup aprovado (docs/telas/transicao-login/mockup.html).
// Cada quadro depende só do tempo desde o clique, da resposta do servidor e do tamanho atual da tela: redimensionar não faz as peças saltarem.
// A mangueira e a junta são recortadas da própria imagem final; só a boca do anel é desenhada. Trocar a imagem exige refazer as medidas abaixo.
import { inicioDaAgua, inicioDoRecuo, TEMPOS, type Resposta } from './linha-do-tempo';
import { IH, IW, RAIO_DO_QUADRO, recorteDaFaixa } from './recorte';

type Ponto = [number, number];
type PontoComLargura = [number, number, number];
type Tabela = (x: number) => number;
type Recorte = { c: HTMLCanvasElement; x: number; y: number; w: number; h: number };
type Ctx = CanvasRenderingContext2D;

/* ---------- utilidades ---------- */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
function ss(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
const eOut3 = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
const eOut2 = (u: number) => 1 - (1 - clamp01(u)) * (1 - clamp01(u));
const eIn2 = (u: number) => clamp01(u) * clamp01(u);
const eIn3 = (u: number) => Math.pow(clamp01(u), 3);
function eIO3(u: number) {
  const v = clamp01(u);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}
/** Tabela de pontos (x, y) lida por interpolação; fora das pontas, continua a reta do último trecho. */
function tab(T: Ponto[]): Tabela {
  return (x) => {
    const n = T.length;
    let a = T[n - 2]!;
    let b = T[n - 1]!;
    if (x <= T[0]![0]) {
      a = T[0]!;
      b = T[1]!;
    } else if (x < T[n - 1]![0]) {
      let i = 1;
      while (x > T[i]![0]) i++;
      a = T[i - 1]!;
      b = T[i]!;
    }
    return a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
  };
}
function cv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}
/** Sorteio fixo: a mesma partícula tem sempre os mesmos números, então cada quadro depende só do tempo. */
function rnd(i: number, k: number) {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
const DOIS_PI = Math.PI * 2;

/* ---------- geometria medida na imagem final (coordenadas da imagem, 1536 x 1024; o tamanho e o recorte da faixa estão em recorte.ts) ---------- */
/** Centro do anel do engate. */
const FOCO = { x: 310, y: 741 };
/** Direção da mangueira junto ao engate. */
const EIXO = (() => {
  const x = 0.985;
  const y = -0.172;
  const l = Math.sqrt(x * x + y * y);
  return { x: x / l, y: y / l };
})();
/** A mangueira da esquerda continua além da borda; XL = onde começa a ponta arredondada. */
const XE = -300;
const XL = 284;
const ANEL = { x: 310, y: 741, rx: 83, ry: 109, rot: 0.04 };
/** À esquerda da borda, a imagem se repete espelhada. */
function espelho(x: number) {
  if (x >= 0) return x;
  const m = (-x - 1) % 300;
  return m < 150 ? m : 299 - m;
}
const topL = tab([[-400, 718], [0, 694], [50, 691], [100, 687], [150, 683], [200, 679], [230, 676], [260, 674], [300, 674]]);
const botL = tab([[-400, 939], [0, 875], [50, 867], [100, 858], [150, 848], [200, 838], [230, 832], [260, 825], [284, 819], [300, 817]]);
const PONTA: Ponto[] = [[289, 677], [294, 692], [297, 716], [298, 745], [296, 774], [291, 800], [286, 815]];
const topR = tab([[365, 664], [400, 661], [450, 657], [500, 651.5], [550, 647], [600, 644], [650, 641.5], [700, 640], [750, 639], [800, 638], [850, 636.5], [880, 635]]);
const botR = tab([[365, 780], [400, 766], [450, 745], [500, 726], [550, 711], [600, 698], [650, 688], [700, 676], [750, 666], [800, 660], [850, 654], [880, 649]]);
const CURVA: PontoComLargura[] = [[880, 642, 13], [900, 640, 14], [915, 636, 14], [925, 630, 14.5], [937, 618, 15], [950, 600, 15], [962, 584, 15], [975, 568, 15], [988, 553, 15], [1000, 541.5, 15], [1013, 531, 14.5]];
const TRECHO2: PontoComLargura[] = [[1036, 518.5, 14], [1042, 516.5, 14], [1067, 507.5, 13.5], [1092, 501, 13], [1117, 496, 12.5], [1123, 495, 12.5]];
const P_LUVA: Ponto[] = [[290, 700], [300, 692], [314, 694], [325, 702], [333, 718], [337, 745], [334, 770], [326, 787], [314, 797], [300, 801], [289, 793], [295, 745]];
const P_GARRA_C: Ponto[] = [[292, 679], [300, 671], [331, 671], [334, 688], [321, 693], [306, 699], [293, 698]];
const P_GARRA_B: Ponto[] = [[296, 794], [330, 788], [338, 796], [337, 813], [311, 821], [297, 819]];
/** Altura da mangueira vazia em relação à cheia. */
const ACHATADA = 0.56;
const achatE = (x: number) => ACHATADA + (1 - ACHATADA) * ss(30, 262, x);
const achatD = (x: number) => ACHATADA + (1 - ACHATADA) * (1 - ss(430, 650, x));
const LINHA = CURVA.concat(TRECHO2);
/** Centro e meia altura da mangueira em cada x (para a luz da água). */
function eixoMang(x: number): Ponto {
  if (x <= XL) return [(topL(x) + botL(x)) / 2, (botL(x) - topL(x)) / 2];
  if (x < 380) {
    const u = (x - XL) / (380 - XL);
    return [lerp((topL(XL) + botL(XL)) / 2, (topR(380) + botR(380)) / 2, u), lerp((botL(XL) - topL(XL)) / 2, (botR(380) - topR(380)) / 2, u)];
  }
  if (x <= 880) return [(topR(x) + botR(x)) / 2, (botR(x) - topR(x)) / 2];
  for (let i = 1; i < LINHA.length; i++) {
    const b = LINHA[i]!;
    if (x <= b[0]) {
      const a = LINHA[i - 1]!;
      const u = (x - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u) / 2];
    }
  }
  const fim = LINHA[LINHA.length - 1]!;
  return [fim[1], fim[2] / 2];
}

/* ---------- recortes da imagem (feitos uma vez por imagem) ---------- */
type Recortes = {
  entorno: HTMLCanvasElement;
  mangE: Recorte; mangD: Recorte; mangEv: HTMLCanvasElement; mangDv: HTMLCanvasElement; tmpE: HTMLCanvasElement; tmpD: HTMLCanvasElement;
  anel: Recorte; luva: Recorte; garraC: Recorte; garraB: Recorte; luz: HTMLCanvasElement;
  /** auxiliares da franja de cor da batida, do tamanho da tela só enquanto ela dura */
  franja: HTMLCanvasElement; silhueta: HTMLCanvasElement;
};
const ctxDe = (c: HTMLCanvasElement): Ctx => c.getContext('2d')!;

function tracar(g: Ctx, polys: Ponto[][]) {
  g.beginPath();
  for (const p of polys) {
    const n = p.length;
    const meio = (i: number): Ponto => {
      const a = p[i % n]!;
      const b = p[(i + 1) % n]!;
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    };
    const s = meio(0);
    g.moveTo(s[0], s[1]);
    for (let i = 1; i <= n; i++) {
      const c = p[i % n]!;
      const e = meio(i);
      g.quadraticCurveTo(c[0], c[1], e[0], e[1]);
    }
    g.closePath();
  }
}
function inchar(p: Ponto[], k: number): Ponto[] {
  let cx = 0;
  let cy = 0;
  for (const q of p) {
    cx += q[0];
    cy += q[1];
  }
  cx /= p.length;
  cy /= p.length;
  return p.map((q) => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k]);
}
function suavizar(g: Ctx) {
  try {
    if ('filter' in g) g.filter = 'blur(0.7px)';
  } catch {
    // navegador sem filtro no canvas: o recorte fica com a borda seca
  }
}
function recorte(img: HTMLImageElement, polys: Ponto[][], x: number, y: number, w: number, h: number): Recorte {
  const c = cv(w, h);
  const g = ctxDe(c);
  g.drawImage(img, x, y, w, h, 0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  g.translate(-x, -y);
  suavizar(g);
  tracar(g, polys);
  g.fill();
  return { c, x, y, w, h };
}
function lados(pts: PontoComLargura[]) {
  const up: Ponto[] = [];
  const dn: Ponto[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= l;
    ty /= l;
    const p = pts[i]!;
    const w = p[2] / 2;
    up.push([p[0] + ty * w, p[1] - tx * w]);
    dn.push([p[0] - ty * w, p[1] + tx * w]);
  }
  return { up, dn };
}
/** Contorno da mangueira da esquerda, da coluna x0 até a ponta; m = folga em pixels. */
function contornoE(g: Ctx, x0: number, m: number) {
  g.moveTo(x0, topL(x0) - m);
  for (let x = x0 + 4; x < XL; x += 4) g.lineTo(x, topL(x) - m);
  g.lineTo(XL, topL(XL) - m);
  for (const p of PONTA) g.lineTo(p[0] + m, p[1]);
  g.lineTo(XL, botL(XL) + m);
  for (let x = XL - 4; x > x0; x -= 4) g.lineTo(x, botL(x) + m);
  g.lineTo(x0, botL(x0) + m);
  g.closePath();
}
/** Frente e fundo do anel. */
function elipseAnel(g: Ctx, f: number) {
  g.beginPath();
  g.ellipse(ANEL.x - 3, ANEL.y, (ANEL.rx - 2) * f, ANEL.ry * f, ANEL.rot, 0, DOIS_PI);
  g.ellipse(ANEL.x + 4, ANEL.y, (ANEL.rx - 3) * f, ANEL.ry * f, ANEL.rot, 0, DOIS_PI);
}
function fazMangEsq(img: HTMLImageElement): Recorte {
  const X0 = XE;
  const Y0 = 640;
  const W = 304 - XE;
  const H = 320;
  const c = cv(W, H);
  const g = ctxDe(c);
  for (let x = X0; x < 0; x++) {
    const sx = espelho(x);
    const s0 = topL(sx) - 3;
    const s1 = botL(sx) + 3;
    const d0 = topL(x) - 3;
    const d1 = botL(x) + 3;
    g.drawImage(img, sx, s0, 1, s1 - s0, x - X0, d0 - Y0, 1, d1 - d0);
  }
  g.drawImage(img, 0, Y0, 304, H, -X0, 0, 304, H);
  g.globalCompositeOperation = 'destination-in';
  g.translate(-X0, -Y0);
  suavizar(g);
  g.beginPath();
  contornoE(g, X0, 1);
  g.fill();
  return { c, x: X0, y: Y0, w: W, h: H };
}
function fazMangDir(img: HTMLImageElement): Recorte {
  const X0 = 360;
  const Y0 = 480;
  const W = 772;
  const H = 320;
  const c = cv(W, H);
  const g = ctxDe(c);
  const l1 = lados(CURVA);
  const l2 = lados(TRECHO2);
  g.drawImage(img, X0, Y0, W, H, 0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  g.translate(-X0, -Y0);
  suavizar(g);
  g.beginPath();
  g.moveTo(365, topR(365) - 1);
  for (let x = 381; x < 880; x += 16) g.lineTo(x, topR(x) - 1);
  g.lineTo(880, topR(880) - 1);
  for (let i = 1; i < l1.up.length; i++) g.lineTo(l1.up[i]![0], l1.up[i]![1]);
  for (let i = l1.dn.length - 1; i >= 1; i--) g.lineTo(l1.dn[i]![0], l1.dn[i]![1]);
  g.lineTo(880, botR(880) + 1);
  for (let x = 864; x > 365; x -= 16) g.lineTo(x, botR(x) + 1);
  g.lineTo(365, botR(365) + 1);
  g.closePath();
  g.moveTo(l2.up[0]![0], l2.up[0]![1]);
  for (let i = 1; i < l2.up.length; i++) g.lineTo(l2.up[i]![0], l2.up[i]![1]);
  for (let i = l2.dn.length - 1; i >= 0; i--) g.lineTo(l2.dn[i]![0], l2.dn[i]![1]);
  g.closePath();
  g.fill();
  return { c, x: X0, y: Y0, w: W, h: H };
}
/** O anel dourado da imagem, sem o que está na frente dele (mangueira da esquerda, luva e garras). */
function fazAnel(img: HTMLImageElement): Recorte {
  const X0 = 218;
  const Y0 = 620;
  const W = 190;
  const H = 250;
  const c = cv(W, H);
  const g = ctxDe(c);
  g.drawImage(img, X0, Y0, W, H, 0, 0, W, H);
  g.translate(-X0, -Y0);
  suavizar(g);
  g.globalCompositeOperation = 'destination-in';
  elipseAnel(g, 1.012);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  contornoE(g, 200, 2);
  g.fill();
  tracar(g, [inchar(P_LUVA, 1.07), inchar(P_GARRA_C, 1.12), inchar(P_GARRA_B, 1.12)]);
  g.fill();
  return { c, x: X0, y: Y0, w: W, h: H };
}
/** Redesenha a mangueira com cada coluna na altura f(x): 0,5 = vazia, 1 = cheia. A base fica no chão. */
function inflar(spr: Recorte, topF: Tabela, botF: Tabela, x1: number, x2: number, f: (x: number) => number, out: HTMLCanvasElement) {
  const g = ctxDe(out);
  const a = x1 - spr.x;
  const b = x2 - spr.x;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, out.width, out.height);
  if (a > 0) g.drawImage(spr.c, 0, 0, a, spr.h, 0, 0, a, spr.h);
  if (b < spr.w) g.drawImage(spr.c, b, 0, spr.w - b, spr.h, b, 0, spr.w - b, spr.h);
  for (let x = x1; x < x2; x++) {
    const k = f(x);
    const t = topF(x) - spr.y - 3;
    const bt = botF(x) - spr.y + 3;
    const h = bt - t;
    g.drawImage(spr.c, x - spr.x, t, 1, h, x - spr.x, bt - k * h, 1, k * h);
  }
}
/** Continuação da cena à esquerda da foto: a própria foto espelhada. Onde a mangueira espelhada sobraria por cima da da animação, entra o fundo escuro. */
function fazEntorno(img: HTMLImageElement): HTMLCanvasElement {
  const c = cv(901, IH);
  const g = ctxDe(c);
  for (let x = -900; x < 0; x++) {
    const sx = espelho(x);
    g.drawImage(img, sx, 0, 1, IH, x + 900, 0, 1, IH);
    const a = topL(sx) - 8;
    const b = topL(Math.max(x, XE)) + 6;
    if (b > a) g.drawImage(img, sx, 636, 1, 30, x + 900, a, 1, b - a);
  }
  g.drawImage(img, 0, 0, 1, IH, 900, 0, 1, IH);
  return c;
}
const RECORTES = new WeakMap<HTMLImageElement, Recortes>();
/** Os recortes da imagem, feitos na primeira vez e guardados. Chamar quando a imagem carrega deixa o primeiro quadro leve. */
export function prepararRecortes(img: HTMLImageElement): Recortes {
  const prontos = RECORTES.get(img);
  if (prontos) return prontos;
  const mangE = fazMangEsq(img);
  const mangD = fazMangDir(img);
  const mangEv = cv(mangE.w, mangE.h);
  inflar(mangE, topL, botL, XE, XL, achatE, mangEv);
  const mangDv = cv(mangD.w, mangD.h);
  inflar(mangD, topR, botR, 365, 880, achatD, mangDv);
  const R: Recortes = {
    entorno: fazEntorno(img),
    mangE, mangD, mangEv, mangDv, tmpE: cv(mangE.w, mangE.h), tmpD: cv(mangD.w, mangD.h),
    anel: fazAnel(img),
    luva: recorte(img, [P_LUVA], 284, 686, 60, 122),
    garraC: recorte(img, [P_GARRA_C], 286, 664, 54, 42),
    garraB: recorte(img, [P_GARRA_B], 290, 782, 54, 46),
    luz: cv(190, 250),
    franja: cv(1, 1),
    silhueta: cv(1, 1),
  };
  RECORTES.set(img, R);
  return R;
}

/* ---------- o estado da cena num instante (função pura do tempo) ---------- */
type Estado = {
  t: number; escuro: number; dL: number; dR: number; vL: number; vR: number; tw: number; ti: number; carga: number; linhas: number; espera: number;
  ta: number; frente: number; tranco: number; zp: number; fotoA: number; th: number; terr: number; amb: number; pecas: boolean;
};
function ida(t: number, D0: number) {
  const T = TEMPOS;
  let dL = 0;
  let dR = 0;
  let b = 0;
  if (t < T.batida) {
    dL = lerp(D0, 0, eIn3((t - T.chegada) / (T.batida - T.chegada)));
    dR = lerp(D0, 0, eIn3((t - T.chegada - 0.03) / (T.batida - T.chegada - 0.03)));
  } else if (t < T.batida + 0.14) b = 5 * Math.sin((Math.PI * (t - T.batida)) / 0.14); // batem e recuam um pouco
  return { dL: dL + b, dR: dR + b, tw: eOut3((t - T.giroInicio) / (T.trava - T.giroInicio)) };
}
function posFrente(v: number) {
  if (v < 0.36) return lerp(XE - 60, 300, eIn2(v / 0.36));
  if (v < 0.46) return lerp(300, 400, (v - 0.36) / 0.1);
  return lerp(400, 1160, eOut2((v - 0.46) / 0.54));
}
function estado(t: number, resposta: Resposta, D0: number): Estado {
  const T = TEMPOS;
  const s: Estado = {
    t, escuro: ss(0, 0.4, t), dL: D0, dR: D0, vL: 0, vR: 0, tw: 0, ti: t >= T.batida ? t - T.batida : -1, carga: 0, linhas: 0, espera: 0,
    ta: -1, frente: -1e9, tranco: 0, zp: 0, fotoA: 0, th: -1, terr: -1, amb: ss(0.05, 0.6, t), pecas: true,
  };
  const r = resposta && t >= resposta.em ? resposta : null;
  const te = inicioDoRecuo(r);
  if (te !== null && t >= te) {
    // senha errada ou servidor fora: clarão vermelho, as garras destravam e as mangueiras recuam (0,5 s); depois a tela clareia
    const f0 = ida(te, D0);
    const rec = (t - te - 0.14) / (T.recuo - 0.14);
    s.terr = t - te;
    s.tw = f0.tw * (1 - eIO3((t - te - 0.03) / 0.11));
    s.dL = lerp(Math.max(0, f0.dL), D0, eIn3(rec));
    s.dR = lerp(Math.max(0, f0.dR), D0, eIn3(rec));
    s.escuro = ss(0, 0.4, te) * (1 - ss(te + T.recuo, te + T.recuo + 0.3, t));
    s.amb = 1 - ss(te + 0.2, te + T.recuo, t);
    s.pecas = rec < 1;
    return s;
  }
  const f = ida(t, D0);
  const g = ida(t - 0.02, D0);
  s.dL = f.dL;
  s.dR = f.dR;
  s.vL = g.dL - f.dL;
  s.vR = g.dR - f.dR;
  s.tw = f.tw;
  s.linhas = ss(T.chegada + 0.04, T.chegada + 0.16, t) * (1 - ss(T.batida - 0.05, T.batida + 0.03, t));
  if (t < T.batida) s.carga = ss(T.batida - 0.16, T.batida, t);
  const tp = inicioDaAgua(r);
  if (tp === null) {
    // travado, esperando o servidor: o anel pulsa
    if (t > T.trava + 0.2) s.espera = ss(T.trava + 0.2, T.trava + 0.6, t);
    return s;
  }
  if (t < tp) return s;
  const v = (t - tp) / T.pressurizacao;
  const z0 = tp + T.afastamentoInicio;
  const z1 = z0 + T.afastamento;
  s.ta = t - tp;
  s.frente = posFrente(v);
  s.tranco = Math.sin(Math.PI * clamp01((v - 0.34) / 0.16));
  if (t >= z0) {
    const zl = clamp01((t - z0) / T.afastamento);
    s.zp = eIO3(zl);
    s.fotoA = ss(0.15, 0.7, zl);
  }
  if (t >= z1) {
    s.th = t - z1;
    s.amb = 1 - ss(T.brasas - T.apaga, T.brasas, s.th);
  }
  return s;
}

/* ---------- palco e câmera ---------- */
type Palco = {
  W: number; H: number; s0: number; fy: number; D0: number;
  /** a faixa de boas-vindas na tela e a escala da imagem dentro dela; null sem a faixa */
  pouso: { bx: number; by: number; bw: number; bh: number; s1: number; q: Ponto; P: Ponto } | null;
};
type Retangulo = { left: number; top: number; width: number; height: number };
/** Onde a imagem pousa: a escala dela dentro da faixa e o ponto da tela em que fica o canto (0,0) da imagem. A conta é a do quadro (recorte.ts). */
export function pousoNaFaixa(faixa: Retangulo): { s1: number; t1: Ponto } {
  const r = recorteDaFaixa(faixa.width, faixa.height);
  return { s1: r.escala, t1: [faixa.left - r.x0 * r.escala, faixa.top - r.y0 * r.escala] };
}
/** No celular (tela estreita) a câmera começa um pouco mais longe e a junta fica mais embaixo, como no mockup. */
function medir(W: number, H: number, faixa: DOMRect | null): Palco {
  const cel = W < 768;
  const s0 = cel ? (0.86 * W) / 390 : (1.2 * W) / 1280;
  const fy = cel ? 0.68 : 0.55;
  const t0: Ponto = [W / 2 - FOCO.x * s0, fy * H - FOCO.y * s0];
  let pouso: Palco['pouso'] = null;
  if (faixa && faixa.width > 0 && faixa.height > 0) {
    const { s1, t1 } = pousoNaFaixa(faixa);
    const d = s0 - s1 || 1e-6;
    const q: Ponto = [(t1[0] - t0[0]) / d, (t1[1] - t0[1]) / d];
    pouso = { bx: faixa.left, by: faixa.top, bw: faixa.width, bh: faixa.height, s1, q, P: [s0 * q[0] + t0[0], s0 * q[1] + t0[1]] };
  }
  return { W, H, s0, fy, D0: W / 2 / s0 + 330, pouso };
}
function camera(L: Palco, p: number) {
  if (!L.pouso || p <= 0) return { s: L.s0, tx: L.W / 2 - FOCO.x * L.s0, ty: L.fy * L.H - FOCO.y * L.s0 };
  const s = L.s0 * Math.pow(L.pouso.s1 / L.s0, p);
  return { s, tx: L.pouso.P[0] - s * L.pouso.q[0], ty: L.pouso.P[1] - s * L.pouso.q[1] };
}

/* ---------- as peças ---------- */
function peca(ctx: Ctx, sgn: number, d: number, k: number) {
  ctx.translate(sgn * EIXO.x * d, sgn * EIXO.y * d);
  ctx.translate(FOCO.x, FOCO.y);
  ctx.scale(k, k);
  ctx.translate(-FOCO.x, -FOCO.y);
}
function el(g: Ctx, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, ANEL.rot, 0, DOIS_PI);
  g.fill();
}
/** A boca do anel (latão, vedação preta e o furo), que aparece enquanto a mangueira da esquerda ainda não entrou. */
function bocaAnel(g: Ctx) {
  let gr = g.createLinearGradient(240, 640, 380, 850);
  gr.addColorStop(0, '#c39545');
  gr.addColorStop(0.4, '#a37226');
  gr.addColorStop(0.75, '#7a4f14');
  gr.addColorStop(1, '#3d2507');
  g.fillStyle = gr;
  el(g, ANEL.x, ANEL.y, ANEL.rx - 1, ANEL.ry - 1);
  gr = g.createLinearGradient(250, 660, 350, 830);
  gr.addColorStop(0, '#7d5417');
  gr.addColorStop(0.5, '#9a6c22');
  gr.addColorStop(1, '#b88a38');
  g.fillStyle = gr;
  el(g, 303, 741, 58, 93);
  g.fillStyle = '#0f0b0a'; // vedação preta
  el(g, 299, 742, 48, 83);
  g.fillStyle = '#2a201c';
  el(g, 299, 742, 44, 77);
  g.fillStyle = '#0f0b0a';
  el(g, 299, 742, 40, 71);
  gr = g.createLinearGradient(280, 680, 320, 810);
  gr.addColorStop(0, '#1b0f08');
  gr.addColorStop(0.6, '#3a2109');
  gr.addColorStop(1, '#7a4d12');
  g.fillStyle = gr;
  el(g, 298, 742, 35, 64);
  g.fillStyle = 'rgba(8,4,3,.84)';
  el(g, 301, 739, 28, 55);
}
function mangueira(ctx: Ctx, spr: Recorte, vazia: HTMLCanvasElement, tmp: HTMLCanvasElement, topF: Tabela, botF: Tabela, x1: number, x2: number, achat: (x: number) => number, u: number, cheiaEm: number) {
  if (u <= x1 - 5) {
    ctx.drawImage(vazia, spr.x, spr.y);
    return;
  }
  if (u >= cheiaEm) {
    ctx.drawImage(spr.c, spr.x, spr.y);
    return;
  }
  inflar(spr, topF, botF, x1, x2, (x) => {
    const a = achat(x);
    const w = 1 - ss(u - 150, u, x);
    const o = x < u - 70 ? 0.05 * Math.sin(Math.PI * clamp01((u - 70 - x) / 140)) : 0;
    return a + (1 - a) * w + o * w;
  }, tmp);
  ctx.drawImage(tmp, spr.x, spr.y);
}
function pecaDireita(ctx: Ctx, R: Recortes, L: Palco, s: Estado, d: number, alfa: number, kj: number) {
  const k = 1 - 0.26 * Math.min(1, d / L.D0);
  ctx.save();
  ctx.globalAlpha = alfa;
  peca(ctx, 1, d, k);
  mangueira(ctx, R.mangD, R.mangDv, R.tmpD, topR, botR, 365, 880, achatD, s.frente, 1062);
  ctx.translate(FOCO.x, FOCO.y);
  ctx.scale(kj, kj);
  ctx.translate(-FOCO.x, -FOCO.y);
  bocaAnel(ctx);
  ctx.drawImage(R.anel.c, R.anel.x, R.anel.y);
  ctx.restore();
}
function pecaEsquerda(ctx: Ctx, R: Recortes, L: Palco, s: Estado, d: number, alfa: number, kj: number) {
  const k = 1 + 0.16 * Math.min(1, d / L.D0);
  const th = (Math.PI / 2) * (1 - s.tw);
  const sn = Math.sin(th);
  const cs = 1 - Math.cos(th);
  ctx.save();
  ctx.globalAlpha = alfa;
  peca(ctx, -1, d, k);
  if (th > 0.5) ctx.drawImage(R.garraB.c, R.garraB.x - 32 * sn, R.garraB.y - 60 * cs); // a garra de baixo vem por trás, no giro de 1/4 de volta
  mangueira(ctx, R.mangE, R.mangEv, R.tmpE, topL, botL, XE, XL, achatE, s.frente, 482);
  ctx.translate(FOCO.x, FOCO.y);
  ctx.scale(kj, kj);
  ctx.translate(-FOCO.x, -FOCO.y);
  ctx.drawImage(R.luva.c, R.luva.x, R.luva.y);
  if (th <= 0.5) ctx.drawImage(R.garraB.c, R.garraB.x - 32 * sn, R.garraB.y - 60 * cs);
  ctx.drawImage(R.garraC.c, R.garraC.x + 32 * sn, R.garraC.y + 60 * cs);
  ctx.restore();
}
/** As duas peças, com o rastro da chegada. */
function pecas(ctx: Ctx, R: Recortes, L: Palco, s: Estado, kj: number) {
  if (s.vR > 3) for (let i = 4; i >= 1; i--) pecaDireita(ctx, R, L, s, s.dR + s.vR * i * 0.2, 0.14, 1);
  pecaDireita(ctx, R, L, s, s.dR, 1, kj);
  if (s.vL > 3) for (let i = 4; i >= 1; i--) pecaEsquerda(ctx, R, L, s, s.dL + s.vL * i * 0.2, 0.14, 1);
  pecaEsquerda(ctx, R, L, s, s.dL, 1, kj);
}
/** Luz pintada só sobre o metal do engate. */
function luzEngate(ctx: Ctx, R: Recortes, cor: string, alfa: number, pos: number | null) {
  const g = ctxDe(R.luz);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, 190, 250);
  g.drawImage(R.anel.c, 0, 0);
  g.drawImage(R.luva.c, R.luva.x - 218, R.luva.y - 620);
  g.drawImage(R.garraC.c, R.garraC.x - 218, R.garraC.y - 620);
  g.drawImage(R.garraB.c, R.garraB.x - 218, R.garraB.y - 620);
  g.globalCompositeOperation = 'source-in';
  if (pos === null) g.fillStyle = `rgba(${cor},${alfa})`;
  else {
    const x = lerp(-90, 280, pos);
    const gr = g.createLinearGradient(x - 56, 0, x + 56, 50);
    gr.addColorStop(0, `rgba(${cor},0)`);
    gr.addColorStop(0.5, `rgba(${cor},${alfa})`);
    gr.addColorStop(1, `rgba(${cor},0)`);
    g.fillStyle = gr;
  }
  g.fillRect(0, 0, 190, 250);
  ctx.drawImage(R.luz, 218, 620);
}
function brilhoRedondo(ctx: Ctx, x: number, y: number, r: number, cor: string, a: number) {
  if (a <= 0.004) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${cor},${a})`);
  gr.addColorStop(0.4, `rgba(${cor},${a * 0.38})`);
  gr.addColorStop(1, `rgba(${cor},0)`);
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

/* ---------- efeitos ---------- */
const OURO = '255,226,170';
const BRANCO = '255,246,228';
const AGUA = '205,232,255';
const VERM = '255,70,50';
function raios(ctx: Ctx, a: number, rot: number) {
  if (a <= 0.004) return;
  for (let i = 0; i < 9; i++) {
    const ang = rot + (i * DOIS_PI) / 9 + (rnd(i, 7) - 0.5) * 0.3;
    const len = 200 + 150 * rnd(i, 8);
    const m = 0.045 + 0.05 * rnd(i, 9);
    const gr = ctx.createRadialGradient(FOCO.x, FOCO.y, 24, FOCO.x, FOCO.y, len);
    gr.addColorStop(0, `rgba(${OURO},${a})`);
    gr.addColorStop(1, `rgba(${OURO},0)`);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(FOCO.x, FOCO.y);
    ctx.lineTo(FOCO.x + len * 0.8 * Math.cos(ang - m), FOCO.y + len * Math.sin(ang - m));
    ctx.lineTo(FOCO.x + len * 0.8 * Math.cos(ang + m), FOCO.y + len * Math.sin(ang + m));
    ctx.closePath();
    ctx.fill();
  }
}
/** A onda de choque: dois anéis finos em volta da junta. */
function onda(ctx: Ctx, ti: number) {
  let u = ti / 0.46;
  if (u <= 0 || u >= 1) return;
  let r = 46 + 215 * eOut3(u);
  ctx.strokeStyle = `rgba(${OURO},${0.42 * (1 - u) * (1 - u)})`;
  ctx.lineWidth = 9 * (1 - u) + 1;
  ctx.beginPath();
  ctx.ellipse(FOCO.x, FOCO.y, r * 0.77, r, ANEL.rot, 0, DOIS_PI);
  ctx.stroke();
  u = (ti - 0.06) / 0.4;
  if (u > 0 && u < 1) {
    r = 40 + 150 * eOut3(u);
    ctx.strokeStyle = `rgba(${BRANCO},${0.3 * (1 - u) * (1 - u)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(FOCO.x, FOCO.y, r * 0.77, r, ANEL.rot, 0, DOIS_PI);
    ctx.stroke();
  }
}
function faiscas(ctx: Ctx, ti: number, n: number, cor: string | null, forca: number) {
  const k = 3.4;
  const gv = 460;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const vida = 0.32 + 0.5 * rnd(i, 12);
    const tau = ti - 0.03 * rnd(i, 13);
    if (tau <= 0 || tau >= vida) continue;
    const ang = rnd(i, 10) * DOIS_PI;
    const v = forca * (0.35 + 0.65 * rnd(i, 11));
    const u = tau / vida;
    const antes = Math.max(0, tau - 0.035);
    const d = (v / k) * (1 - Math.exp(-k * tau));
    const d0 = (v / k) * (1 - Math.exp(-k * antes));
    const x = FOCO.x + Math.cos(ang) * d * 0.8;
    const y = FOCO.y + Math.sin(ang) * d + 0.5 * gv * tau * tau;
    const x0 = FOCO.x + Math.cos(ang) * d0 * 0.8;
    const y0 = FOCO.y + Math.sin(ang) * d0 + 0.5 * gv * antes * antes;
    ctx.strokeStyle = `rgba(${cor ?? (u < 0.25 ? BRANCO : u < 0.6 ? '255,206,120' : '255,140,50')},${Math.pow(1 - u, 1.4) * 0.95})`;
    ctx.lineWidth = 2 * (1 - u) + 0.6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}
/** Brilho da espera: o anel pulsa e seis pontos de luz giram em volta. */
function espera(ctx: Ctx, s: Estado) {
  const p = 0.5 + 0.5 * Math.sin(s.t * 5.2);
  const a = s.espera;
  ctx.strokeStyle = `rgba(${OURO},${a * (0.1 + 0.14 * p)})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(FOCO.x, FOCO.y, ANEL.rx + 10, ANEL.ry + 10, ANEL.rot, 0, DOIS_PI);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const ang = s.t * 2.3 + (i * DOIS_PI) / 6;
    brilhoRedondo(ctx, FOCO.x + (ANEL.rx + 12) * Math.cos(ang), FOCO.y + (ANEL.ry + 12) * Math.sin(ang), 13, BRANCO, a * (0.55 - 0.07 * i));
  }
}
/** A água: uma luz fria corre por dentro da mangueira, com respingos. */
function agua(ctx: Ctx, s: Estado) {
  const P = TEMPOS.pressurizacao;
  const x = s.frente;
  const a = 1 - ss(0.75, 1, s.ta / P);
  const n = 34;
  if (x > XE && x < 1150 && a > 0) {
    for (let i = 0; i < 4; i++) {
      const e = eixoMang(x - i * 34);
      brilhoRedondo(ctx, x - i * 30, e[0], Math.min(78, Math.max(20, e[1] * 1.15)), AGUA, a * (0.34 - 0.075 * i));
    }
  }
  for (let i = 0; i < n; i++) {
    const v = 0.05 + (0.9 * (i + rnd(i, 20))) / n;
    const tau = s.ta - v * P;
    if (tau <= 0 || tau >= 0.5) continue;
    const xb = posFrente(v);
    if (xb < -40 || xb > 1130) continue;
    const eb = eixoMang(xb);
    const u = tau / 0.5;
    const px = xb + (-50 + 90 * rnd(i, 21)) * tau;
    const py = eb[0] - eb[1] * 0.8 + (-130 - 150 * rnd(i, 22)) * tau + 0.5 * 560 * tau * tau;
    ctx.fillStyle = `rgba(${AGUA},${0.75 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(px, py, (1.2 + 1.6 * rnd(i, 23)) * (1 - 0.4 * u), 0, DOIS_PI);
    ctx.fill();
  }
}
/**
 * Brasas e cinza do ambiente, versão 2 (6.67; em pixels da tela; servem para a animação e para o quadro da tela inicial). 59 brasas em três profundidades (as pequenas, mais lentas e
 * apagadas, ao fundo; as grandes, mais rápidas e fortes, na frente) e 44 pontos de cinza. Três em cada quatro brasas esfriam na subida (alaranjada, vermelha, cinza opaca sem
 * brilho) e apagam antes de sair do quadro; uma em cada quatro (`SEM_CINZA`) apaga ainda alaranjada, só avermelhando um pouco. `fraca` é o retângulo da saudação: ali ficam a um terço da força.
 */
export const N_BRASAS = 59;
export const N_CINZA = 44;
export const N_BRASAS_DO_BOTAO = 52;
/** Depois do pouso, mais estas só dentro do quadro: o campo da tela inteira deixa um terço delas no quadro. */
export const N_BRASAS_DO_QUADRO = 43;
export const SEM_CINZA = 0.25;
/** O retângulo em que as brasas ficam fracas (a saudação), em pixels da tela. */
export type Fraca = { x: number; y: number; w: number; h: number } | null;

/** A brasa `i` (com esta semente) é das que apagam ainda alaranjadas, sem virar cinza? */
export function semCinza(i: number, semente: number): boolean {
  return rnd(i + semente, 5) < SEM_CINZA;
}
/** Quanto o ponto está dentro do retângulo fraco: 1 no meio, 0 a mais de 24 px dele, e suave na borda. Sem retângulo, 0. */
export function dentro(x: number, y: number, f: Fraca): number {
  const m = 24;
  if (!f) return 0;
  return ss(f.x - m, f.x, x) * (1 - ss(f.x + f.w, f.x + f.w + m, x)) * ss(f.y - m, f.y, y) * (1 - ss(f.y + f.h, f.y + f.h + m, y));
}
/** Onde está a brasa `i` no instante `t`, de que cor e com que força (já com o terço da força sobre a saudação). */
export function brasaEm(i: number, t: number, W: number, H: number, amp: number, semente: number, fraca: Fraca) {
  const k = semente;
  const a = rnd(i + k, 1);
  const b = rnd(i + k, 2);
  const c = rnd(i + k, 3);
  const d = rnd(i + k, 4);
  const prof = d; // 0 = ao fundo (pequena, lenta, apagada); 1 = na frente
  const vel = 26 + 118 * prof;
  const ciclo = (H + 80) / vel;
  const u = ((t + a * ciclo * 7) / ciclo) % 1;
  const y = H + 30 - u * (H + 80);
  const x = (a * 1.1 - 0.05) * W + (14 + 16 * prof) * Math.sin(t * (0.7 + c) + b * DOIS_PI) + u * 46 * (c - 0.35);
  const r = 0.8 + 2.4 * prof * prof;
  const esf = ss(0.42, 0.9, u); // quanto já esfriou na subida: 0 saindo do chão, 1 perto do topo
  // uma em quatro apaga alaranjada, só avermelhando um pouco; as outras vão de alaranjada a vermelha e viram cinza
  const cinza = semCinza(i, k) ? 0 : esf;
  const cor = semCinza(i, k) ? 1 - 0.4 * esf : 1 - esf;
  let al = amp * (0.25 + 0.75 * prof) * (0.6 + 0.4 * Math.sin(t * (6 + 8 * d) + a * 40)) * Math.sqrt(Math.sin(Math.PI * Math.min(1, u * 1.12)));
  al *= 1 - 0.68 * dentro(x, y, fraca);
  return { x, y, u, r, prof, vel, cinza, cor, al };
}
/** O ponto de cinza `i` (cai devagar) no instante `t`. */
export function cinzaEm(i: number, t: number, W: number, H: number, amp: number, semente: number, fraca: Fraca) {
  const k = semente;
  const a = rnd(i + k, 31);
  const b = rnd(i + k, 32);
  const c = rnd(i + k, 33);
  const vel = 14 + 26 * b;
  const ciclo = (H + 40) / vel;
  const u = ((t + a * ciclo * 5) / ciclo) % 1;
  const y = -20 + u * (H + 40);
  const x = a * W + 34 * Math.sin(t * (0.4 + 0.5 * c) + b * DOIS_PI);
  const al = amp * 0.26 * Math.sin(Math.PI * u) * (1 - 0.68 * dentro(x, y, fraca));
  return { x, y, r: 0.8 + 1.1 * c, al };
}
export function brasas(g: Ctx, t: number, W: number, H: number, amp: number, fraca: Fraca = null, semente = 0, n = N_BRASAS) {
  if (amp <= 0.004) return;
  for (let i = 0; i < n; i++) {
    const b = brasaEm(i, t, W, H, amp, semente, fraca);
    if (b.al <= 0.004) continue;
    if (b.cinza < 0.98) {
      // quente: luz somada, de alaranjada a vermelha
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(255,150,60,${b.al * 0.16 * (1 - b.cinza)})`;
      g.beginPath();
      g.arc(b.x, b.y, b.r * 3.4, 0, DOIS_PI);
      g.fill();
      g.fillStyle = `rgba(255,${Math.round(lerp(96, 196, b.cor))},${Math.round(lerp(40, 110, b.cor))},${b.al * (1 - b.cinza)})`;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, DOIS_PI);
      g.fill();
    }
    if (b.cinza > 0.02) {
      // fria: cinza opaca, sem brilho, que vai sumindo
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(172,166,160,${b.al * b.cinza * 0.8})`;
      g.beginPath();
      g.arc(b.x, b.y, b.r * 0.9, 0, DOIS_PI);
      g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < N_CINZA; i++) {
    const p = cinzaEm(i, t, W, H, amp, semente, fraca);
    if (p.al <= 0.004) continue;
    g.fillStyle = `rgba(190,180,172,${p.al})`;
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, DOIS_PI);
    g.fill();
  }
}
/** O cartão se desfaz: brasas sobem do botão Entrar (52). */
function estouroBotao(ctx: Ctx, t: number, bt: { x: number; y: number; w: number }) {
  const n = N_BRASAS_DO_BOTAO;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const vida = 0.45 + 0.5 * rnd(i, 41);
    if (t >= vida) continue;
    const u = t / vida;
    const ang = -Math.PI / 2 + (rnd(i, 42) - 0.5) * 2.6;
    const v = 70 + 190 * rnd(i, 43);
    const x = bt.x + (rnd(i, 44) - 0.5) * bt.w + Math.cos(ang) * v * t;
    const y = bt.y + Math.sin(ang) * v * t - 40 * t * t;
    ctx.fillStyle = `rgba(255,186,96,${0.9 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + 1.8 * rnd(i, 45) * (1 - u), 0, DOIS_PI);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function linhasVel(ctx: Ctx, L: Palco, s: Estado, fy: number) {
  ctx.lineCap = 'round';
  for (let i = 0; i < 20; i++) {
    const dir = i % 2 ? 1 : -1;
    const y = fy + (rnd(i, 51) - 0.5) * 430;
    const len = 80 + 190 * rnd(i, 52);
    const p = (s.t * (2.4 + 2.2 * rnd(i, 53)) + rnd(i, 54)) % 1;
    const x = dir > 0 ? lerp(-len, L.W / 2 - 40, p) : lerp(L.W + len, L.W / 2 + 40, p);
    ctx.strokeStyle = `rgba(255,236,214,${s.linhas * 0.2 * Math.sin(Math.PI * p)})`;
    ctx.lineWidth = 1 + 1.4 * rnd(i, 55);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dir * len, y + dir * len * 0.17);
    ctx.stroke();
  }
}
/** O tremor é de poucos pixels e dura cerca de 0,3 s. */
function tremor(s: Estado) {
  let x = 0;
  let y = 0;
  if (s.ti >= 0 && s.ti < 0.5) {
    const a = 6 * Math.exp(-s.ti / 0.11);
    x += a * Math.sin(s.ti * 96);
    y += a * 0.7 * Math.cos(s.ti * 73);
  }
  if (s.terr >= 0 && s.terr < 0.4) x += 5 * Math.exp(-s.terr / 0.1) * Math.sin(s.terr * 118);
  y += Math.sin(s.tranco * Math.PI) * 1.6;
  return { x, y };
}

/* ---------- o quadro ---------- */
export type OpcoesDaCena = {
  /** segundos desde o clique em "Entrar" */
  t: number;
  resposta: Resposta;
  /** o tamanho da tela, em pixels de CSS; o `canvas` pode ter mais pixels (a densidade sai da largura dele) */
  largura: number;
  altura: number;
  /** onde a faixa de boas-vindas está na tela; null enquanto ela não existe */
  faixa: DOMRect | null;
  imagem: HTMLImageElement;
  /** o centro e a largura do botão "Entrar" no clique, de onde sobem as primeiras brasas */
  botao?: { x: number; y: number; w: number } | null;
};

/** O recorte com a silhueta do quadro: cantos arredondados (num navegador sem `roundRect`, cantos vivos). */
function recortarQuadro(ctx: Ctx, x: number, y: number, w: number, h: number, raio: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, Math.max(0, Math.min(raio, w / 2, h / 2)));
  else ctx.rect(x, y, w, h);
  ctx.clip();
}

/** Depois do pouso: só as brasas sobre a faixa (4 s), o lampejo e o risco de luz que a cruza. */
function desenharPouso(ctx: Ctx, PR: number, L: Palco, s: Estado) {
  const f = L.pouso;
  if (!f) return;
  ctx.setTransform(PR, 0, 0, PR, 0, 0);
  ctx.save();
  recortarQuadro(ctx, f.bx, f.by, f.bw, f.bh, RAIO_DO_QUADRO);
  const lampejo = 0.34 * (1 - ss(0, 0.4, s.th));
  if (lampejo > 0.004) {
    ctx.fillStyle = `rgba(255,236,208,${lampejo})`;
    ctx.fillRect(f.bx, f.by, f.bw, f.bh);
  }
  const o = clamp01(s.th / 0.75);
  const risco = Math.sin(Math.PI * o) * 0.9;
  if (risco > 0.004) {
    const w = 0.42 * f.bw;
    const x = f.bx + w * lerp(-1.1, 2.3, eOut2(o));
    const gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(255,236,205,0)');
    gr.addColorStop(0.5, `rgba(255,236,205,${0.42 * risco})`);
    gr.addColorStop(1, 'rgba(255,236,205,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x, f.by, w, f.bh);
  }
  brasas(ctx, s.t, L.W, L.H, s.amb);
  ctx.restore();
}

/**
 * Desenha o quadro do instante `t` no `canvas` que cobre a tela. Até a água, o fundo escuro cobre tudo; no afastamento da câmera, o desenho
 * encolhe até a faixa de boas-vindas (o resto do `canvas` fica transparente e mostra a tela inicial); depois do pouso, ficam só as brasas.
 */
export function desenhar(ctx: Ctx, o: OpcoesDaCena): void {
  const PR = ctx.canvas.width / o.largura;
  const R = prepararRecortes(o.imagem);
  const L = medir(o.largura, o.altura, o.faixa);
  const s = estado(o.t, o.resposta, L.D0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (o.t < 0) return;
  if (s.th >= 0) {
    // os auxiliares da franja já não servem: devolvem a memória
    if (R.franja.width > 1) R.franja.width = R.franja.height = R.silhueta.width = R.silhueta.height = 1;
    desenharPouso(ctx, PR, L, s);
    return;
  }
  const cam = camera(L, s.zp);
  const kj = 1 + 0.03 * s.tranco;
  const tr = tremor(s);
  const fy = cam.s * FOCO.y + cam.ty;
  const luzGeral = 1 - s.zp;
  ctx.save();
  ctx.setTransform(PR, 0, 0, PR, 0, 0);
  if (L.pouso && s.zp > 0) {
    // o quadro encolhe até a faixa, e os cantos vão se arredondando até o raio do quadro
    const f = L.pouso;
    const lam = (L.s0 - cam.s) / (L.s0 - f.s1 || 1e-6);
    recortarQuadro(ctx, lam * f.bx, lam * f.by, L.W - lam * (L.W - f.bw), L.H - lam * (L.H - f.bh), lam * RAIO_DO_QUADRO);
  }
  // a tela escurece até fechar (0,40 s), com o centro avermelhado; depois disso a tela por baixo pode ser trocada sem aparecer
  const cx = 0.5 * L.W;
  const cy = 0.58 * L.H;
  const fundo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(Math.max(cx, L.W - cx), Math.max(cy, L.H - cy)));
  fundo.addColorStop(0, '#2b0d0b');
  fundo.addColorStop(0.46, '#150605');
  fundo.addColorStop(1, '#070202');
  ctx.globalAlpha = s.escuro;
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.globalAlpha = 1;
  if (s.linhas > 0) linhasVel(ctx, L, s, fy);
  // a foto e a continuação dela à esquerda aparecem em volta da mangueira no afastamento
  if (s.fotoA > 0) {
    ctx.setTransform(PR * cam.s, 0, 0, PR * cam.s, PR * cam.tx, PR * cam.ty);
    ctx.globalAlpha = s.fotoA;
    ctx.drawImage(R.entorno, -900, 0);
    ctx.drawImage(o.imagem, 0, 0, IW, IH);
    ctx.globalAlpha = 1;
  }
  if (s.pecas) {
    ctx.setTransform(PR * cam.s, 0, 0, PR * cam.s, PR * (cam.tx + tr.x), PR * (cam.ty + tr.y));
    // franja de cor no instante da batida: o conjunto das peças ganha uma borda vermelha de um lado e azul do outro. As peças vão para um
    // `canvas` auxiliar e a silhueta dele, tingida, é colada deslocada por baixo (sombra peça a peça pintaria por dentro delas)
    const franja = s.ti >= 0 && s.ti < 0.3 ? 4.5 * Math.exp(-s.ti / 0.07) : 0;
    if (franja > 0.35) {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      for (const c of [R.franja, R.silhueta]) {
        if (c.width !== cw || c.height !== ch) {
          c.width = cw;
          c.height = ch;
        }
      }
      const g = ctxDe(R.franja);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      g.setTransform(PR * cam.s, 0, 0, PR * cam.s, PR * (cam.tx + tr.x), PR * (cam.ty + tr.y));
      pecas(g, R, L, s, kj);
      const sil = ctxDe(R.silhueta);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const [cor, lado] of [['rgba(255,70,40,.5)', 1], ['rgba(70,200,255,.4)', -1]] as const) {
        sil.setTransform(1, 0, 0, 1, 0, 0);
        sil.globalCompositeOperation = 'source-over';
        sil.clearRect(0, 0, cw, ch);
        sil.drawImage(R.franja, 0, 0);
        sil.globalCompositeOperation = 'source-in';
        sil.fillStyle = cor;
        sil.fillRect(0, 0, cw, ch);
        ctx.drawImage(R.silhueta, lado * franja * PR, 0);
      }
      ctx.drawImage(R.franja, 0, 0);
      ctx.setTransform(PR * cam.s, 0, 0, PR * cam.s, PR * (cam.tx + tr.x), PR * (cam.ty + tr.y));
    } else pecas(ctx, R, L, s, kj);
    // luzes
    ctx.globalCompositeOperation = 'lighter';
    if (s.carga > 0) brilhoRedondo(ctx, FOCO.x - 10, FOCO.y, 36 + 70 * s.carga, BRANCO, 0.5 * s.carga);
    if (s.ti >= 0) {
      const a = Math.exp(-s.ti / 0.1);
      if (s.ti < 0.6) {
        brilhoRedondo(ctx, FOCO.x, FOCO.y, 430, BRANCO, 0.5 * a);
        luzEngate(ctx, R, BRANCO, 0.28 * Math.exp(-s.ti / 0.2), null);
      }
      raios(ctx, (0.2 * Math.exp(-s.ti / 0.32) + 0.035 * s.espera) * luzGeral, 0.35 * s.ti);
      onda(ctx, s.ti);
      if (s.ti < 0.9) faiscas(ctx, s.ti, 64, null, 620);
      brilhoRedondo(ctx, FOCO.x, FOCO.y, 190, OURO, 0.09 * luzGeral * ss(0.1, 0.5, s.ti)); // o engate travado fica com um brilho leve
    }
    if (s.espera > 0) {
      espera(ctx, s);
      luzEngate(ctx, R, BRANCO, 0.5 * s.espera, ((s.t * 0.7) % 1.6) - 0.2);
    }
    if (s.ta >= 0) agua(ctx, s);
    if (s.terr >= 0) {
      const a = Math.exp(-s.terr / 0.16);
      brilhoRedondo(ctx, FOCO.x, FOCO.y, 300, VERM, 0.4 * a);
      luzEngate(ctx, R, VERM, 0.6 * a, null);
      if (s.terr < 0.7) faiscas(ctx, s.terr, 22, VERM, 380);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // por cima de tudo, em pixels da tela
  ctx.setTransform(PR, 0, 0, PR, 0, 0);
  brasas(ctx, s.t, L.W, L.H, s.amb);
  if (s.t < 1 && o.botao) estouroBotao(ctx, s.t, o.botao);
  ctx.restore();
}
