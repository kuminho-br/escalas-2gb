import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

async function clicarSair() {
  await userEvent.click(await screen.findByRole('button', { name: /SD BM ANDRADE/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
}

describe('sair', () => {
  it('sair com sucesso vai para entrar', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, '/api/auth/sign-out': { status: 200, corpo: { success: true } } });
    const router = abrir('/');
    await clicarSair();
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
  });

  it('sair sem conexao avisa e continua na tela', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, '/api/auth/sign-out': 'rede' });
    const router = abrir('/');
    await clicarSair();
    expect(await screen.findByText('Não foi possível sair. Verifique a conexão e tente de novo.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('casca', () => {
  it('sem sessao vai para entrar', async () => {
    simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('casca mostra o militar', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    expect(await screen.findByText('SD BM ANDRADE')).toBeInTheDocument();
    expect(screen.getByText('CBMPE › DGO › DInter/1 › 2º GB › 1ª SB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grade geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Escala do mês').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.getByText('A grade aparece aqui quando houver uma escala cadastrada.')).toBeInTheDocument();
  });
});
