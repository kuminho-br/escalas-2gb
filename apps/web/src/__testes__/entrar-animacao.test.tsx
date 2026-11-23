import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relogio } from '@/lib/transicao-login/armazem';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Neste arquivo a cena está sempre "pronta": a imagem carrega de mentira e o `canvas` aceita qualquer desenho (o jsdom não tem `canvas`).
// O relógio da cena é conduzido à mão: `avancar(s)` põe o tempo em `s` segundos desde o clique e roda um quadro.
const CHAVE = 'escalas2gb.login-animacao';
let agora = 0;
let pendente: ((agora: number) => void) | null = null;

function cenaDeMentira() {
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => this.onload?.());
    }
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const alvo: Record<string | symbol, unknown> = { canvas: this };
    const ctx: unknown = new Proxy(alvo, {
      get: (a, p) => (p in a ? a[p] : () => ctx),
      set: (a, p, v) => {
        a[p] = v;
        return true;
      },
    });
    return ctx as CanvasRenderingContext2D;
  } as never);
}
async function avancar(segundos: number) {
  agora = segundos * 1000;
  await act(async () => {
    const f = pendente;
    pendente = null;
    f?.(agora);
    await Promise.resolve();
  });
}
/** Deixa as respostas do servidor (de mentira) chegarem, sem mexer no relógio da cena. */
const assentar = () => act(async () => void (await new Promise((r) => setTimeout(r, 30))));

beforeEach(() => {
  agora = 0;
  pendente = null;
  localStorage.clear();
  cenaDeMentira();
  vi.spyOn(relogio, 'agora').mockImplementation(() => agora);
  vi.spyOn(relogio, 'quadro').mockImplementation((f) => {
    pendente = f;
    return 1;
  });
  vi.spyOn(relogio, 'cancelar').mockImplementation(() => {
    pendente = null;
  });
});
afterEach(async () => {
  // deixa a cena acabar, para um teste não começar com a do anterior
  for (let i = 0; i < 4 && pendente; i++) await avancar(1000 + i);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function preencherEEntrar() {
  await userEvent.type(await screen.findByLabelText('E-mail'), 'andrade@exemplo.test');
  await userEvent.type(screen.getByLabelText('Senha'), 'senha-qualquer-123');
  await assentar();
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}
function depoisDeEntrar(api: ReturnType<typeof simularApi>) {
  api.mockImplementation(async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const corpo = url.includes('/api/eu') ? EU_EXEMPLO : url.includes('/militares') ? [] : { user: {} };
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}
const cartaoEscondido = () => screen.getByRole('main').getAttribute('data-cena') === 'tocando';

describe('entrar com a animação', () => {
  it('com a animação, o cartão some no clique e a mensagem de erro só aparece depois do recuo (Review Focus 1)', async () => {
    simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': 'rede' });
    abrir('/entrar');
    await preencherEEntrar();
    await assentar();
    expect(cartaoEscondido()).toBe(true);
    // o servidor já falhou, mas o erro nunca vem antes de 0,85 s, e o recuo dura 0,5 s
    await avancar(0.6);
    await avancar(1.2);
    expect(screen.queryByText('Não foi possível falar com o servidor. Tente de novo.')).toBeNull();
    expect(cartaoEscondido()).toBe(true);
    await avancar(1.36);
    expect(await screen.findByText('Não foi possível falar com o servidor. Tente de novo.')).toBeInTheDocument();
    expect(cartaoEscondido()).toBe(false);
    expect(screen.getByLabelText('E-mail')).toHaveValue('andrade@exemplo.test');
    expect(screen.getByLabelText('Senha')).toHaveValue('senha-qualquer-123');
    expect(screen.getByLabelText('Senha')).toHaveFocus();
    // a animação que termina em erro não conta para as 12 h
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('o 403 do servidor mostra a mensagem dele depois do recuo (Review Focus 2)', async () => {
    const vencida = 'Sua senha provisória venceu. Peça uma senha nova ao auxiliar administrativo da sua seção.';
    simularApi({ '/api/eu': { status: 401 }, 'POST /api/auth/sign-in/email': { status: 403, corpo: { message: vencida } } });
    abrir('/entrar');
    await preencherEEntrar();
    await assentar();
    await avancar(0.9);
    expect(screen.queryByText(vencida)).toBeNull();
    await avancar(1.4);
    expect(await screen.findByRole('alert')).toHaveTextContent(vencida);
  });

  it('"Entrando…" aparece 1,6 s depois do clique, se o servidor ainda não respondeu', async () => {
    let soltar = () => {};
    const espera = new Promise<void>((r) => (soltar = r));
    simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': { status: 401, corpo: {}, espera } });
    abrir('/entrar');
    await preencherEEntrar();
    await avancar(1.5);
    expect(screen.getByRole('status')).toHaveTextContent('');
    await avancar(1.7);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando…');
    soltar();
    await assentar();
    await avancar(1.8);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('só marca as 12 h quando a animação inteira chega às boas-vindas, e a saudação recebe o foco', async () => {
    const api = simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/entrar');
    await screen.findByLabelText('E-mail');
    depoisDeEntrar(api);
    await preencherEEntrar();
    await assentar();
    // aprovada logo depois do clique: a tela de login só dá lugar à inicial quando a água começa (0,90 s) e a cena cobre tudo
    await avancar(0.6);
    await assentar();
    expect(router.state.location.pathname).toBe('/entrar');
    await avancar(0.95);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    const titulo = await screen.findByRole('heading', { level: 1 });
    // as boas-vindas chegam 1,7 s depois da água
    await avancar(1);
    await avancar(2.5);
    expect(localStorage.getItem(CHAVE)).toBeNull();
    expect(titulo).not.toHaveFocus();
    await avancar(2.65);
    expect(localStorage.getItem(CHAVE)).not.toBeNull();
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it('a segunda entrada dentro das 12 h é curta: não inicia a animação', async () => {
    localStorage.setItem(CHAVE, String(Date.now() - 60_000));
    const api = simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/entrar');
    await screen.findByLabelText('E-mail');
    depoisDeEntrar(api);
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(relogio.quadro).not.toHaveBeenCalled();
  });

  it('com "voltar", a entrada é curta e a pessoa cai na página em que estava (Review Focus 4)', async () => {
    const api = simularApi({ '/api/eu': { status: 401 } });
    const router = abrir(`/entrar?sessao=terminou&voltar=${encodeURIComponent('/militares?busca=x')}`);
    await screen.findByLabelText('E-mail');
    depoisDeEntrar(api);
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/militares'));
    expect(relogio.quadro).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('com menos movimento, não inicia a animação', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    const api = simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/entrar');
    await screen.findByLabelText('E-mail');
    depoisDeEntrar(api);
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(relogio.quadro).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});
