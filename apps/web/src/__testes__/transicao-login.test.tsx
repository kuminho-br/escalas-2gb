import { afterEach, describe, expect, it, vi } from 'vitest';
import { inicioDaAgua, inicioDoRecuo, mostraEntrando, quadroEm, type Resposta } from '@/lib/transicao-login/linha-do-tempo';
import { entradaDaVez, gravarQuando, INTERVALO_DA_ANIMACAO_MS, lerQuando, lerUltimaInteira, marcarInteira } from '@/lib/transicao-login/regra';

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const AGORA = 1_800_000_000_000;
const base = { agora: AGORA, ultimaInteira: null, menosMovimento: false, cenaPronta: true, destinoEhOInicio: true, quando: '12h' as const };

describe('a regra das 12 h', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('o intervalo fica numa constante só: 12 h', () => {
    expect(INTERVALO_DA_ANIMACAO_MS).toBe(12 * H);
  });

  it('nunca tocou: inteira; há 11 h 59 min: curta; há 12 h e 1 min: inteira', () => {
    expect(entradaDaVez(base)).toBe('inteira');
    expect(entradaDaVez({ ...base, ultimaInteira: AGORA - (11 * H + 59 * MIN) })).toBe('curta');
    expect(entradaDaVez({ ...base, ultimaInteira: AGORA - (12 * H + MIN) })).toBe('inteira');
  });

  it('menos movimento, cena não pronta ou destino diferente do início: curta, mesmo sem nunca ter tocado', () => {
    expect(entradaDaVez({ ...base, menosMovimento: true })).toBe('curta');
    expect(entradaDaVez({ ...base, cenaPronta: false })).toBe('curta');
    expect(entradaDaVez({ ...base, destinoEhOInicio: false })).toBe('curta');
  });

  it('marca e lê a última vez na chave do navegador', () => {
    // o relógio de agora é o do teste: uma marca no futuro (6.17, item 11) não vale
    vi.spyOn(Date, 'now').mockReturnValue(AGORA);
    expect(lerUltimaInteira()).toBeNull();
    marcarInteira(AGORA);
    expect(localStorage.getItem('escalas2gb.login-animacao')).toBe(String(AGORA));
    expect(lerUltimaInteira()).toBe(AGORA);
  });

  it('valor estranho gravado na chave vale como nunca tocou', () => {
    localStorage.setItem('escalas2gb.login-animacao', 'ontem');
    expect(lerUltimaInteira()).toBeNull();
  });

  it('com o localStorage lançando erro, ler devolve null e marcar não lança (Review Focus 5)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(lerUltimaInteira()).toBeNull();
    expect(() => marcarInteira(AGORA)).not.toThrow();
  });
});

describe('a preferência de quando a animação toca (6.14)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('sempre: inteira mesmo tendo tocado há 1 minuto', () => {
    expect(entradaDaVez({ ...base, quando: 'sempre', ultimaInteira: AGORA - MIN })).toBe('inteira');
  });

  it('nunca: curta mesmo sem nunca ter tocado', () => {
    expect(entradaDaVez({ ...base, quando: 'nunca' })).toBe('curta');
  });

  it('12h: os casos de antes, sem mudança', () => {
    expect(entradaDaVez({ ...base, quando: '12h' })).toBe('inteira');
    expect(entradaDaVez({ ...base, quando: '12h', ultimaInteira: AGORA - MIN })).toBe('curta');
    expect(entradaDaVez({ ...base, quando: '12h', ultimaInteira: AGORA - (12 * H + MIN) })).toBe('inteira');
  });

  it('menos movimento, cena não pronta ou destino diferente do início continuam dando curta com "sempre"', () => {
    expect(entradaDaVez({ ...base, quando: 'sempre', menosMovimento: true })).toBe('curta');
    expect(entradaDaVez({ ...base, quando: 'sempre', cenaPronta: false })).toBe('curta');
    expect(entradaDaVez({ ...base, quando: 'sempre', destinoEhOInicio: false })).toBe('curta');
  });

  it('o padrão é 12h; grava e lê na chave do navegador; valor estranho vale como o padrão', () => {
    expect(lerQuando()).toBe('12h');
    gravarQuando('nunca');
    expect(localStorage.getItem('escalas2gb.login-animacao-quando')).toBe('nunca');
    expect(lerQuando()).toBe('nunca');
    localStorage.setItem('escalas2gb.login-animacao-quando', 'às vezes');
    expect(lerQuando()).toBe('12h');
  });

  it('com o localStorage lançando erro, lê o padrão e gravar não lança', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(lerQuando()).toBe('12h');
    expect(() => gravarQuando('sempre')).not.toThrow();
  });
});

describe('a linha do tempo', () => {
  const aprovada = (em: number): Resposta => ({ tipo: 'aprovada', em });
  const recusada = (em: number): Resposta => ({ tipo: 'recusada', em });

  it('aprovada aos 0,2 s: a água começa aos 0,90 s', () => {
    expect(inicioDaAgua(aprovada(0.2))).toBeCloseTo(0.9);
    expect(quadroEm(0.89, aprovada(0.2))).not.toBe('agua');
    expect(quadroEm(0.9, aprovada(0.2))).toBe('agua');
  });

  it('aprovada aos 3 s: a água começa aos 3 s, e as boas-vindas aos 4,7 s', () => {
    expect(inicioDaAgua(aprovada(3))).toBe(3);
    expect(quadroEm(2.99, aprovada(3))).toBe('espera');
    expect(quadroEm(3.1, aprovada(3))).toBe('agua');
    expect(quadroEm(3.5, aprovada(3))).toBe('afastamento');
    expect(quadroEm(4.69, aprovada(3))).toBe('afastamento');
    expect(quadroEm(4.7, aprovada(3))).toBe('boas-vindas');
  });

  it('recusada aos 0,1 s: o recuo começa aos 0,85 s, e o fim do erro aos 1,35 s (Review Focus 3)', () => {
    expect(inicioDoRecuo(recusada(0.1))).toBeCloseTo(0.85);
    expect(quadroEm(0.6, recusada(0.1))).toBe('batida');
    expect(quadroEm(0.84, recusada(0.1))).toBe('espera');
    expect(quadroEm(0.85, recusada(0.1))).toBe('recuo');
    expect(quadroEm(1.34, recusada(0.1))).toBe('recuo');
    expect(quadroEm(1.35, recusada(0.1))).toBe('fim-do-erro');
  });

  it('recusada depois da trava: o recuo começa na hora da resposta', () => {
    expect(inicioDoRecuo(recusada(4))).toBe(4);
    expect(quadroEm(4.2, recusada(4))).toBe('recuo');
    expect(quadroEm(4.5, recusada(4))).toBe('fim-do-erro');
  });

  it('sem resposta: clique, chegada, batida aos 0,5 s, espera aos 0,8 s e aos 30 s', () => {
    expect(inicioDaAgua(null)).toBeNull();
    expect(inicioDoRecuo(null)).toBeNull();
    expect(quadroEm(0.05, null)).toBe('clique');
    expect(quadroEm(0.3, null)).toBe('chegada');
    expect(quadroEm(0.5, null)).toBe('batida');
    expect(quadroEm(0.8, null)).toBe('espera');
    expect(quadroEm(30, null)).toBe('espera');
  });

  it('a água só vale para a aprovada, e o recuo só para a recusada', () => {
    expect(inicioDaAgua(recusada(1))).toBeNull();
    expect(inicioDoRecuo(aprovada(1))).toBeNull();
  });

  it('"Entrando…": não em 1,5 s, sim em 1,7 s sem resposta, não depois da aprovação nem da recusa', () => {
    expect(mostraEntrando(1.5, null)).toBe(false);
    expect(mostraEntrando(1.7, null)).toBe(true);
    expect(mostraEntrando(3.2, aprovada(3))).toBe(false);
    expect(mostraEntrando(2.5, aprovada(3))).toBe(true);
    expect(mostraEntrando(3.2, recusada(3))).toBe(false);
  });
});

describe('o desenho de um quadro (achados da revisão final)', () => {
  // um contexto que aceita qualquer desenho e anota o que foi chamado e o que foi atribuído
  function contextoAnotado() {
    const chamadas: Record<string, number> = {};
    const atribuicoes: [string, unknown][] = [];
    const fazer = (canvas: object) => {
      const alvo: Record<string | symbol, unknown> = { canvas };
      const ctx: unknown = new Proxy(alvo, {
        get: (a, p) => (p in a ? a[p] : () => {
          chamadas[String(p)] = (chamadas[String(p)] ?? 0) + 1;
          return ctx;
        }),
        set: (a, p, v) => {
          a[p] = v;
          atribuicoes.push([String(p), v]);
          return true;
        },
      });
      return ctx as CanvasRenderingContext2D;
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      return fazer(this);
    } as never);
    return { ctx: fazer({ width: 1280, height: 800 }), chamadas, atribuicoes };
  }
  const quadro = async (t: number, resposta: Resposta) => {
    const { desenhar } = await import('@/lib/transicao-login/cena');
    const c = contextoAnotado();
    desenhar(c.ctx, { t, resposta, largura: 1280, altura: 800, faixa: null, imagem: {} as HTMLImageElement });
    return c;
  };
  afterEach(() => vi.restoreAllMocks());

  it('com o erro logo depois da batida, as faíscas e a onda de choque da batida continuam durante o recuo', async () => {
    // erro aos 0,85 s: 0,36 s depois da batida ainda há faíscas douradas em voo e o anel da onda, além das 22 faíscas vermelhas
    const { chamadas } = await quadro(0.86, { tipo: 'recusada', em: 0.1 });
    expect(chamadas.stroke).toBeGreaterThan(30);
  });

  it('a franja de cor da batida não usa sombra peça a peça (que pintaria por dentro delas)', async () => {
    const { atribuicoes } = await quadro(0.52, null);
    expect(atribuicoes.filter(([p, v]) => p === 'shadowOffsetX' && v !== 0)).toEqual([]);
    expect(atribuicoes.some(([p, v]) => p === 'globalCompositeOperation' && v === 'source-in')).toBe(true);
  });
});

describe('as brasas novas, que esfriam até virar cinza, por 4,2 s (6.67, Task 2)', () => {
  type Cena = typeof import('@/lib/transicao-login/cena');
  const cena = (): Promise<Cena> => import('@/lib/transicao-login/cena');
  const contexto = () => {
    const arcos: [number, number, number][] = [];
    const fazer = (): CanvasRenderingContext2D => {
      const alvo: Record<string | symbol, unknown> = { canvas: { width: 1280, height: 800 } };
      const ctx: unknown = new Proxy(alvo, {
        get: (a, p) => (p === 'arc' ? (x: number, y: number, r: number) => (arcos.push([x, y, r]), ctx) : p in a ? a[p] : () => ctx),
        set: (a, p, v) => ((a[p] = v), true),
      });
      return ctx as CanvasRenderingContext2D;
    };
    // os recortes que a cena prepara usam `canvas` auxiliares: o jsdom não tem `getContext`, então eles também ganham o contexto anotado
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => fazer()) as never);
    return { ctx: fazer(), arcos };
  };
  afterEach(() => vi.restoreAllMocks());

  it('as quantidades do mockup: 59 brasas, 44 pontos de cinza, 52 no botão, 43 no quadro', async () => {
    const m = await cena();
    expect([m.N_BRASAS, m.N_CINZA, m.N_BRASAS_DO_BOTAO, m.N_BRASAS_DO_QUADRO, m.SEM_CINZA]).toEqual([59, 44, 52, 43, 0.25]);
  });

  it('uma em cada quatro brasas apaga ainda alaranjada: 17 das 59 (semente 0) e 8 das 43 (semente 300)', async () => {
    const { semCinza } = await cena();
    expect(Array.from({ length: 59 }, (_, i) => semCinza(i, 0)).filter(Boolean)).toHaveLength(17);
    expect(Array.from({ length: 43 }, (_, i) => semCinza(i, 300)).filter(Boolean)).toHaveLength(8);
  });

  it('três profundidades: as pequenas são mais lentas e apagadas, ao fundo; as grandes, mais rápidas e fortes, na frente', async () => {
    const { brasaEm, N_BRASAS } = await cena();
    const todas = Array.from({ length: N_BRASAS }, (_, i) => brasaEm(i, 3, 1280, 800, 1, 0, null));
    const porProfundidade = [...todas].sort((a, b) => a.prof - b.prof);
    for (let k = 1; k < porProfundidade.length; k++) {
      expect(porProfundidade[k]!.r).toBeGreaterThanOrEqual(porProfundidade[k - 1]!.r);
      expect(porProfundidade[k]!.vel).toBeGreaterThanOrEqual(porProfundidade[k - 1]!.vel);
    }
    for (const b of todas) {
      expect(b.vel).toBeCloseTo(26 + 118 * b.prof, 6);
      expect(b.r).toBeCloseTo(0.8 + 2.4 * b.prof * b.prof, 6);
    }
    expect(Math.min(...todas.map((b) => b.prof))).toBeLessThan(0.2);
    expect(Math.max(...todas.map((b) => b.prof))).toBeGreaterThan(0.8);
  });

  it('as que esfriam viram cinza na subida (esfriar de 0,42 a 0,9 da subida); as sem cinza nunca passam de uma luz alaranjada que só avermelha um pouco', async () => {
    const { brasaEm, semCinza, N_BRASAS } = await cena();
    for (let i = 0; i < N_BRASAS; i++) {
      for (let t = 0; t < 60; t += 0.37) {
        const b = brasaEm(i, t, 1280, 800, 1, 0, null);
        if (semCinza(i, 0)) {
          expect(b.cinza).toBe(0);
          expect(b.cor).toBeGreaterThanOrEqual(0.6);
        } else expect(b.cinza).toBeCloseTo(1 - b.cor, 9);
        if (b.u < 0.42) expect(b.cinza).toBe(0);
      }
    }
    // e há brasas que chegam a ficar totalmente cinza
    expect(Array.from({ length: 59 }, (_, i) => brasaEm(i, 5, 1280, 800, 1, 0, null)).some((b) => b.cinza > 0.98)).toBe(true);
  });

  it('o desenho de um quadro a meio: o número de círculos é o das brasas (duas luzes a quente, uma a frio) mais a cinza, conferido pela própria conta das brasas', async () => {
    const { brasas, brasaEm, cinzaEm, N_BRASAS, N_CINZA } = await cena();
    const { ctx, arcos } = contexto();
    const t = 7.3;
    brasas(ctx, t, 1280, 800, 1, null, 0, N_BRASAS);
    let esperado = 0;
    for (let i = 0; i < N_BRASAS; i++) {
      const b = brasaEm(i, t, 1280, 800, 1, 0, null);
      if (b.al <= 0.004) continue;
      if (b.cinza < 0.98) esperado += 2;
      if (b.cinza > 0.02) esperado += 1;
    }
    for (let i = 0; i < N_CINZA; i++) if (cinzaEm(i, t, 1280, 800, 1, 0, null).al > 0.004) esperado += 1;
    expect(arcos.length).toBe(esperado);
    expect(esperado).toBeGreaterThan(N_BRASAS);
  });

  it('sem força (amp 0) não desenha nada', async () => {
    const { brasas } = await cena();
    const { ctx, arcos } = contexto();
    brasas(ctx, 3, 1280, 800, 0, null, 0, 59);
    expect(arcos).toEqual([]);
  });

  it('depois do pouso: a força das brasas é 1 no começo e vai a 0 aos 4,2 s, apagando nos últimos 1,6 s; as constantes são uma só para os dois números', async () => {
    const { TEMPOS } = await import('@/lib/transicao-login/linha-do-tempo');
    expect([TEMPOS.brasas, TEMPOS.apaga]).toEqual([4.2, 1.6]);
    const { desenhar } = await cena();
    const { inicioDasBoasVindas } = await import('@/lib/transicao-login/linha-do-tempo');
    const aprovada = { tipo: 'aprovada', em: 0 } as const;
    const pouso = inicioDasBoasVindas(aprovada)!;
    const faixa = { left: 24, top: 80, width: 1232, height: 400, right: 1256, bottom: 480, x: 24, y: 80 } as DOMRect;
    const arcosEm = (th: number) => {
      const { ctx, arcos } = contexto();
      desenhar(ctx, { t: pouso + th, resposta: aprovada, largura: 1280, altura: 800, faixa, imagem: {} as HTMLImageElement });
      return arcos.length;
    };
    expect(arcosEm(0)).toBeGreaterThan(0);
    // ainda com força inteira antes dos últimos 1,6 s, e sem nada a partir dos 4,2 s
    expect(arcosEm(TEMPOS.brasas - TEMPOS.apaga - 0.01)).toBeGreaterThan(0);
    expect(arcosEm(TEMPOS.brasas)).toBe(0);
    expect(arcosEm(TEMPOS.brasas + 1)).toBe(0);
  });

  it('o botão Entrar solta 52 brasas no começo da cena', async () => {
    const { desenhar, N_BRASAS_DO_BOTAO } = await cena();
    const arcosEm = (botao: { x: number; y: number; w: number } | null) => {
      const { ctx, arcos } = contexto();
      desenhar(ctx, { t: 0.05, resposta: null, largura: 1280, altura: 800, faixa: null, imagem: {} as HTMLImageElement, botao });
      return arcos.length;
    };
    expect(arcosEm({ x: 900, y: 500, w: 300 }) - arcosEm(null)).toBe(N_BRASAS_DO_BOTAO);
  });
});

describe('as brasas sobre o quadro e mais fracas sobre a saudação (6.67, Task 3)', () => {
  type Cena = typeof import('@/lib/transicao-login/cena');
  const cena = (): Promise<Cena> => import('@/lib/transicao-login/cena');
  /** Um contexto que anota, em ordem, as translações, os recortes e os círculos (com o alfa do último preenchimento). */
  const contexto = () => {
    const eventos: { tipo: 'translate' | 'clip' | 'arc'; x?: number; y?: number; r?: number; alfa?: number }[] = [];
    let ultimaCor = '';
    const fazer = (): CanvasRenderingContext2D => {
      const alvo: Record<string | symbol, unknown> = { canvas: { width: 1280, height: 800 } };
      const ctx: unknown = new Proxy(alvo, {
        get: (a, p) => {
          if (p === 'translate') return (x: number, y: number) => (eventos.push({ tipo: 'translate', x, y }), ctx);
          if (p === 'clip') return () => (eventos.push({ tipo: 'clip' }), ctx);
          if (p === 'arc') return (x: number, y: number, r: number) => (eventos.push({ tipo: 'arc', x, y, r, alfa: Number(/,([\d.e-]+)\)$/.exec(ultimaCor)?.[1] ?? 1) }), ctx);
          return p in a ? a[p] : () => ctx;
        },
        set: (a, p, v) => {
          if (p === 'fillStyle' && typeof v === 'string') ultimaCor = v;
          a[p] = v;
          return true;
        },
      });
      return ctx as CanvasRenderingContext2D;
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => fazer()) as never);
    return { ctx: fazer(), eventos };
  };
  afterEach(() => vi.restoreAllMocks());
  const APROVADA = { tipo: 'aprovada', em: 0 } as const;
  const retangulo = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

  it('dentro(): 1 no meio do retângulo, 0 a mais de 24 px dele, entre 0 e 1 na borda; sem retângulo (null), 0 (Review Focus 4)', async () => {
    const { dentro } = await cena();
    const f = { x: 100, y: 100, w: 300, h: 80 };
    expect(dentro(250, 140, f)).toBe(1);
    expect(dentro(100 - 25, 140, f)).toBe(0);
    expect(dentro(400 + 25, 140, f)).toBe(0);
    expect(dentro(250, 100 - 25, f)).toBe(0);
    expect(dentro(250, 180 + 25, f)).toBe(0);
    const borda = dentro(100 - 12, 140, f);
    expect(borda).toBeGreaterThan(0);
    expect(borda).toBeLessThan(1);
    expect(dentro(250, 140, null)).toBe(0);
  });

  it('uma brasa sobre a saudação sai com um terço da força de outra igual fora dela; sem retângulo, com a força inteira', async () => {
    const { brasaEm } = await cena();
    const tudo = { x: -1e4, y: -1e4, w: 2e4, h: 2e4 };
    for (const i of [0, 7, 21, 40]) {
      const livre = brasaEm(i, 5.5, 1280, 800, 1, 0, null);
      const sobre = brasaEm(i, 5.5, 1280, 800, 1, 0, tudo);
      expect(livre.al).toBeGreaterThan(0);
      expect(sobre.al / livre.al).toBeCloseTo(1 - 0.68, 6);
    }
  });

  it('Review Focus 3: a saudação em duas linhas (retângulo mais alto) continua toda coberta pela área fraca', async () => {
    const { dentro } = await cena();
    const umaLinha = { x: 28, y: 60, w: 500, h: 70 };
    const duasLinhas = { x: 28, y: 60, w: 500, h: 118 };
    // o ponto da segunda linha só está coberto quando o retângulo medido a inclui
    expect(dentro(200, 160, umaLinha)).toBe(0);
    expect(dentro(200, 160, duasLinhas)).toBe(1);
  });

  it('a força do campo do quadro chega em 0,6 s: 0 no pouso, 1 em 0,6 s', async () => {
    const { forcaDoQuadro } = await cena();
    expect(forcaDoQuadro(0)).toBe(0);
    expect(forcaDoQuadro(0.6)).toBe(1);
    expect(forcaDoQuadro(0.3)).toBeCloseTo(0.5, 6);
    expect(forcaDoQuadro(3)).toBe(1);
  });

  it('depois do pouso, as 43 brasas do quadro são desenhadas com a origem no canto do quadro, dentro do recorte dele: nenhuma no pouso, e já no quadro aos 0,6 s', async () => {
    const { desenhar, N_BRASAS_DO_QUADRO } = await cena();
    const { inicioDasBoasVindas } = await import('@/lib/transicao-login/linha-do-tempo');
    const pouso = inicioDasBoasVindas(APROVADA)!;
    const faixa = retangulo(24, 80, 1232, 400);
    const quadroEm = (th: number) => {
      const { ctx, eventos } = contexto();
      desenhar(ctx, { t: pouso + th, resposta: APROVADA, largura: 1280, altura: 800, faixa, imagem: {} as HTMLImageElement, saudacao: null });
      const i = eventos.findIndex((e) => e.tipo === 'translate' && e.x === 24 && e.y === 80);
      return { eventos, i };
    };
    // no pouso (th = 0) a força do quadro é 0: não há campo do quadro
    expect(quadroEm(0).i).toBe(-1);
    const { eventos, i } = quadroEm(0.6);
    expect(i).toBeGreaterThan(-1);
    // o recorte do quadro vem antes do campo do quadro
    expect(eventos.slice(0, i).some((e) => e.tipo === 'clip')).toBe(true);
    const doQuadro = eventos.slice(i).filter((e) => e.tipo === 'arc');
    expect(doQuadro.length).toBeGreaterThan(N_BRASAS_DO_QUADRO / 2);
    // em pixels do quadro (1232 x 400), com a folga das oscilações das brasas: fica no quadro
    for (const a of doQuadro) {
      expect(a.y!).toBeGreaterThan(-60);
      expect(a.y!).toBeLessThan(400 + 60);
      expect(a.x!).toBeGreaterThan(-0.05 * 1232 - 60);
      expect(a.x!).toBeLessThan(1.05 * 1232 + 60);
    }
  });

  it('Review Focus 5: redimensionar a janela depois do pouso: o campo do quadro segue o quadro novo', async () => {
    const { desenhar } = await cena();
    const { inicioDasBoasVindas } = await import('@/lib/transicao-login/linha-do-tempo');
    const t = inicioDasBoasVindas(APROVADA)! + 1;
    const origem = (faixa: DOMRect) => {
      const { ctx, eventos } = contexto();
      desenhar(ctx, { t, resposta: APROVADA, largura: 1280, altura: 800, faixa, imagem: {} as HTMLImageElement, saudacao: null });
      return eventos.filter((e) => e.tipo === 'translate').map((e) => [e.x, e.y]);
    };
    expect(origem(retangulo(24, 80, 1232, 400))).toContainEqual([24, 80]);
    expect(origem(retangulo(12, 70, 700, 250))).toContainEqual([12, 70]);
  });

  it('a saudação medida enfraquece as brasas ali (em pixels da tela e em pixels do quadro), e sem ela as brasas ficam com a força inteira (Review Focus 4)', async () => {
    const { desenhar } = await cena();
    const { inicioDasBoasVindas } = await import('@/lib/transicao-login/linha-do-tempo');
    const t = inicioDasBoasVindas(APROVADA)! + 1;
    const faixa = retangulo(24, 80, 1232, 400);
    const soma = (saudacao: DOMRect | null) => {
      const { ctx, eventos } = contexto();
      desenhar(ctx, { t, resposta: APROVADA, largura: 1280, altura: 800, faixa, imagem: {} as HTMLImageElement, saudacao });
      return eventos.filter((e) => e.tipo === 'arc').reduce((n, e) => n + (e.alfa ?? 0), 0);
    };
    const sem = soma(null);
    // uma saudação que cobre a tela toda: tudo a um terço da força
    const toda = soma(retangulo(-1000, -1000, 4000, 4000));
    expect(sem).toBeGreaterThan(0);
    expect(toda).toBeLessThan(sem * 0.5);
  });
});
