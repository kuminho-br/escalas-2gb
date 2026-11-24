import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navegador, pedir, saida } from '@/api/cliente';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

async function preencherEEntrar() {
  await userEvent.type(await screen.findByLabelText('E-mail'), 'andrade@exemplo.test');
  await userEvent.type(screen.getByLabelText('Senha'), 'senha-qualquer-123');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

function depoisDeEntrar(api: ReturnType<typeof simularApi>) {
  api.mockImplementation(async (entrada: RequestInfo | URL) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const corpo = url.includes('/api/eu') ? EU_EXEMPLO : url.includes('/grade/') ? { mes: '2026-11', dias: [], grupos: [] } : url.includes('/militares') ? [] : { user: {} };
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

describe('entrar depois de uma sessão que terminou', () => {
  it('mostra o aviso e, depois de entrar, volta para a página em que a pessoa estava (Review Focus 1)', async () => {
    const api = simularApi({ '/api/eu': { status: 401 } });
    const router = abrir(`/entrar?sessao=terminou&voltar=${encodeURIComponent('/militares?busca=x')}`);
    expect(await screen.findByText('Sua sessão terminou. Entre de novo.')).toBeInTheDocument();
    depoisDeEntrar(api);
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/militares'));
    expect(router.state.location.search).toMatchObject({ busca: 'x' });
  });

  it.each(['https://mal.test/x', '//mal.test/x', '/\\mal.test'])('um voltar que não é um caminho interno (%s) é ignorado e vai para a página inicial', async (voltar) => {
    const api = simularApi({ '/api/eu': { status: 401 } });
    const router = abrir(`/entrar?sessao=terminou&voltar=${encodeURIComponent(voltar)}`);
    await screen.findByText('Sua sessão terminou. Entre de novo.');
    depoisDeEntrar(api);
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('o aviso é um alerta, para o leitor de tela anunciar na hora', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    abrir('/entrar?sessao=terminou');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sua sessão terminou. Entre de novo.');
  });

  it('sem sessao=terminou (quem nunca entrou) não mostra o aviso (Review Focus 2)', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    abrir('/entrar');
    await screen.findByLabelText('E-mail');
    expect(screen.queryByText('Sua sessão terminou. Entre de novo.')).toBeNull();
  });
});

describe('entrar de novo depois de sair', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    saida.marcar(false);
  });

  it('uma sessão que termina depois de entrar de novo volta a mostrar o aviso (o "Sair" anterior não cala o aviso para sempre)', async () => {
    saida.marcar(true);
    const api = simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/entrar');
    depoisDeEntrar(api);
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    api.mockImplementation(async () => new Response(JSON.stringify({ erro: 'Sessão inválida.' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    expect(ir).toHaveBeenCalledWith(expect.stringContaining('sessao=terminou'));
  });
});

describe('entrar', () => {
  it('a tela tem o título do sistema, o brasão do 2º GB e o cartão "Entrar"', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    abrir('/entrar');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sistema de Gestão - 2º GB' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Brasão do 2º GB' })).toHaveAttribute('src', '/brasao-2gb.png');
    expect(screen.getByText('2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Entrar' })).toBeInTheDocument();
  });

  it('entrar mostra erro com senha errada', async () => {
    simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': { status: 401, corpo: { code: 'INVALID_EMAIL_OR_PASSWORD' } } });
    abrir('/entrar');
    await preencherEEntrar();
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
  });

  it('na entrada curta, o botão mostra "Entrando…" enquanto o servidor não responde, e o cartão continua na tela', async () => {
    let soltar = () => {};
    const espera = new Promise<void>((r) => (soltar = r));
    simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': { status: 401, corpo: {}, espera } });
    abrir('/entrar');
    await preencherEEntrar();
    expect(await screen.findByRole('button', { name: 'Entrando…' })).toBeDisabled();
    expect(screen.getByRole('main')).not.toHaveAttribute('data-cena', 'tocando');
    soltar();
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeEnabled();
    // no erro, o foco vai para o campo da senha. O foco é movido por um efeito (useEffect), que o React roda depois de pôr o botão "Entrar" na tela: conferir no mesmo instante
    // em que o botão aparece é uma corrida (falhava 1 vez em 6, mais com a máquina ocupada). A conferência é a mesma, só espera o efeito rodar.
    await waitFor(() => expect(screen.getByLabelText('Senha')).toHaveFocus());
  });

  it('entrar mostra erro de rede', async () => {
    simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': 'rede' });
    abrir('/entrar');
    await preencherEEntrar();
    expect(await screen.findByText('Não foi possível falar com o servidor. Tente de novo.')).toBeInTheDocument();
  });

  it('entrar com sucesso vai para a tela inicial', async () => {
    const api = simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': { status: 200, corpo: { user: {} } } });
    // começa pelo início: sem sessão, vai para /entrar e deixa "sem sessão" no cache
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    await screen.findByLabelText('E-mail');
    api.mockImplementation(async (entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const corpo = url.includes('/api/eu') ? EU_EXEMPLO : url.includes('/grade/') ? { mes: '2026-11', dias: [], grupos: [] } : { user: {} };
      return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByText('SD ANDRADE')).toBeInTheDocument();
  });
});

describe('entrar: esqueci a senha e senha provisória vencida', () => {
  it('Esqueci minha senha mostra a orientação', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    abrir('/entrar');
    expect(screen.queryByText('Peça uma senha nova ao auxiliar administrativo da sua seção.')).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Esqueci minha senha' }));
    expect(screen.getByText('Peça uma senha nova ao auxiliar administrativo da sua seção.')).toBeInTheDocument();
  });

  it('senha provisória vencida mostra a mensagem do servidor (Review Focus 5)', async () => {
    const vencida = 'Sua senha provisória venceu. Peça uma senha nova ao auxiliar administrativo da sua seção.';
    simularApi({ '/api/eu': { status: 401 }, 'POST /api/auth/sign-in/email': { status: 403, corpo: { message: vencida } } });
    abrir('/entrar');
    await preencherEEntrar();
    expect(await screen.findByRole('alert')).toHaveTextContent(vencida);
    expect(screen.queryByText('E-mail ou senha incorretos.')).toBeNull();
  });

  it('senha errada continua dizendo e-mail ou senha incorretos', async () => {
    simularApi({ '/api/eu': { status: 401 }, 'POST /api/auth/sign-in/email': { status: 401, corpo: { message: 'Invalid email or password' } } });
    abrir('/entrar');
    await preencherEEntrar();
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
  });
});
