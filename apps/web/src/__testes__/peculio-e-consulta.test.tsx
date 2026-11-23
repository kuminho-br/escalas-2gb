import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.26: o módulo "Pecúlio" (sem "do 2º GB") é de todo militar com conta, e a Consulta de militares é uma tela dele. Dados fictícios.
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const trilho = async () => within(await screen.findByRole('navigation', { name: 'Navegação principal' }));

describe('o Pecúlio e a Consulta de militares (6.26)', () => {
  it('o cartão se chama "Pecúlio", sem "do 2º GB"', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    expect(await screen.findByRole('heading', { level: 2, name: 'Pecúlio' })).toBeInTheDocument();
    expect(screen.queryByText(/Pecúlio do 2º GB/)).toBeNull();
  });

  it('quem não tem nível de acesso entra direto na Consulta e vê só ela no trilho', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: COMUM }, 'GET /api/consulta': { status: 200, corpo: [] } });
    const router = abrir('/consulta');
    const menu = await trilho();
    expect(menu.getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Consulta de militares']);
    expect(router.state.location.pathname).toBe('/consulta');
  });

  it('quem não tem nível não abre a lista do Pecúlio: volta ao início com o aviso', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: COMUM } });
    const router = abrir('/peculio');
    expect(await screen.findByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('quem tem nível de acesso vê a lista do Pecúlio e a Consulta, no mesmo trilho, e o endereço antigo da consulta continua valendo', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/consulta': { status: 200, corpo: [] } });
    abrir('/consulta');
    const menu = await trilho();
    expect(menu.getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Pecúlio', 'Consulta de militares']);
    expect(menu.getByRole('link', { name: 'Consulta de militares' })).toHaveAttribute('aria-current', 'page');
  });
});
