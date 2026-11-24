import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const PROVISORIA = { ...EU_EXEMPLO, trocarSenha: true };

describe('Crie a sua senha', () => {
  it('quem entrou com a senha provisória é levado à tela antes de qualquer outra', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: PROVISORIA } });
    const router = abrir('/militares');
    await screen.findByRole('heading', { name: 'Crie a sua senha' });
    expect(router.state.location.pathname).toBe('/criar-senha');
  });

  it('as duas senhas precisam ser iguais e ter 10 caracteres', async () => {
    const f = simularApi({ '/api/eu': { status: 200, corpo: PROVISORIA } });
    abrir('/criar-senha');
    await userEvent.type(await screen.findByLabelText('Nova senha'), 'curta');
    await userEvent.type(screen.getByLabelText('Repita a nova senha'), 'curta');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect(await screen.findByText('Use pelo menos 10 caracteres.', { selector: 'p.text-apoio' })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Nova senha'));
    await userEvent.type(screen.getByLabelText('Nova senha'), 'senha-nova-12345');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect(await screen.findByText('As duas senhas precisam ser iguais.')).toBeInTheDocument();
    expect(f.mock.calls.some(([e]) => String(e).endsWith('/api/eu/senha'))).toBe(false);
  });

  it('tem "Sair", para quem não quer criar a senha agora (6.16)', async () => {
    const f = simularApi({ '/api/eu': { status: 200, corpo: PROVISORIA }, '/api/auth/sign-out': { status: 200, corpo: { success: true } } });
    const router = abrir('/criar-senha');
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(f.mock.calls.some(([e]) => String(e).endsWith('/api/auth/sign-out'))).toBe(true);
  });

  it('salvar leva para o início', async () => {
    let trocou = false;
    const f = simularApi({ '/api/eu': { status: 200, corpo: PROVISORIA }, 'POST /api/eu/senha': { status: 204 } });
    f.mockImplementation(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.endsWith('/api/eu/senha')) {
        trocou = true;
        return new Response(null, { status: 204 });
      }
      const corpo = url.endsWith('/api/eu') ? { ...EU_EXEMPLO, trocarSenha: !trocou } : url.includes('/grade/') ? { mes: '2026-11', dias: [], grupos: [] } : [];
      return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const router = abrir('/criar-senha');
    await userEvent.type(await screen.findByLabelText('Nova senha'), 'senha-nova-12345');
    await userEvent.type(screen.getByLabelText('Repita a nova senha'), 'senha-nova-12345');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(corpoEnviado(f, 'POST /api/eu/senha')).toEqual({ novaSenha: 'senha-nova-12345' });
  });

  it('quem já tem senha definitiva não fica nesta tela', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    const router = abrir('/criar-senha');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
