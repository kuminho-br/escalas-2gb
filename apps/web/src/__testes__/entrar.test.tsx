import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

async function preencherEEntrar() {
  await userEvent.type(await screen.findByLabelText('E-mail'), 'andrade@exemplo.test');
  await userEvent.type(screen.getByLabelText('Senha'), 'senha-qualquer-123');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

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

  it('entrar mostra erro de rede', async () => {
    simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': 'rede' });
    abrir('/entrar');
    await preencherEEntrar();
    expect(await screen.findByText('Não foi possível falar com o servidor. Tente de novo.')).toBeInTheDocument();
  });

  it('entrar com sucesso vai para a grade geral', async () => {
    const api = simularApi({ '/api/eu': { status: 401 }, '/api/auth/sign-in/email': { status: 200, corpo: { user: {} } } });
    // começa pela grade: sem sessão, vai para /entrar e deixa "sem sessão" no cache
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    await screen.findByLabelText('E-mail');
    api.mockImplementation(async (entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const corpo = url.includes('/api/eu') ? EU_EXEMPLO : { user: {} };
      return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    await preencherEEntrar();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { name: 'Grade geral' })).toBeInTheDocument();
  });
});
