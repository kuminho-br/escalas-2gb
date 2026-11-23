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
