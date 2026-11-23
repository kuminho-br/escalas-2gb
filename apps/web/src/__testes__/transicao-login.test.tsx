import { afterEach, describe, expect, it, vi } from 'vitest';
import { inicioDaAgua, inicioDoRecuo, mostraEntrando, quadroEm, type Resposta } from '@/lib/transicao-login/linha-do-tempo';
import { entradaDaVez, INTERVALO_DA_ANIMACAO_MS, lerUltimaInteira, marcarInteira } from '@/lib/transicao-login/regra';

const H = 60 * 60 * 1000;
const MIN = 60 * 1000;
const AGORA = 1_800_000_000_000;
const base = { agora: AGORA, ultimaInteira: null, menosMovimento: false, cenaPronta: true, destinoEhOInicio: true };

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
