import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.26: o módulo "Pecúlio" (sem "do 2º GB") é de todo militar com conta, e a Consulta de militares é uma tela dele. Dados fictícios.
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const trilho = async () => within(await screen.findByRole('navigation', { name: 'Navegação principal' }));

describe('o Pecúlio e a Consulta de militares (6.26)', () => {
  it('o atalho se chama "Pecúlio Geral", sem "do 2º GB"', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    // 6.42: o cartão virou um atalho (link) na tela inicial
    const atalho = await screen.findByRole('link', { name: /^Pecúlio Geral/ });
    expect(atalho.querySelector('b')).toHaveTextContent(/^Pecúlio Geral$/);
    expect(screen.queryByText(/Pecúlio do 2º GB/)).toBeNull();
  });

  it('quem não tem nível de acesso entra direto na pesquisa e vê só ela no trilho (e o endereço antigo /consulta leva a ela)', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: COMUM }, 'GET /api/consulta': { status: 200, corpo: [] } });
    const router = abrir('/consulta');
    const menu = await trilho();
    expect(menu.getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Pesquisar militares']);
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/pesquisar'));
  });

  it('quem não tem nível não abre a lista do Pecúlio: volta ao início com o aviso', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: COMUM } });
    const router = abrir('/peculio');
    expect(await screen.findByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('revisão final: quem não tem nível também não abre a ficha aberta pelo Pecúlio, nem o endereço com maiúsculas', async () => {
    for (const caminho of ['/militares/m1?de=peculio', '/Peculio', '/PECULIO']) {
      simularApi({ '/api/eu': { status: 200, corpo: COMUM } });
      const router = abrir(caminho);
      expect(await screen.findByText('Essa área é de outro nível de acesso.'), caminho).toBeInTheDocument();
      await waitFor(() => expect(router.state.location.pathname, caminho).toBe('/'));
      cleanup();
    }
  });

  it('quem tem nível de acesso vê as três telas no mesmo trilho, e o endereço antigo da consulta continua valendo', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/consulta': { status: 200, corpo: [] } });
    abrir('/consulta');
    const menu = await trilho();
    expect(menu.getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Pecúlio da unidade', 'Pesquisar militares', 'Aniversários']);
    await waitFor(() => expect(menu.getByRole('link', { name: 'Pesquisar militares' })).toHaveAttribute('aria-current', 'page'));
  });
});
