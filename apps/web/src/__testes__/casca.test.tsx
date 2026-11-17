import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

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
