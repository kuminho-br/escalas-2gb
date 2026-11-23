import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saudacao } from '@/lib/saudacao';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

describe('saudação', () => {
  // Recife é UTC-3, sem horário de verão
  const em = (utc: string) => saudacao(new Date(`2026-11-21T${utc}Z`));

  it('Bom dia até 11h59, Boa tarde até 17h59, Boa noite depois, no horário de Recife', () => {
    expect(em('14:59:00')).toBe('Bom dia');
    expect(em('15:00:00')).toBe('Boa tarde');
    expect(em('20:59:00')).toBe('Boa tarde');
    expect(em('21:00:00')).toBe('Boa noite');
    expect(em('02:59:00')).toBe('Boa noite');
    expect(em('03:00:00')).toBe('Bom dia');
  });

  it('usa o dia de Recife, e não o do computador: 01h UTC ainda é a noite anterior', () => {
    expect(em('01:00:00')).toBe('Boa noite');
  });
});

describe('tela inicial', () => {
  afterEach(() => vi.useRealTimers());
  const comPapel = EU_EXEMPLO;
  const comum = { ...EU_EXEMPLO, papeis: [] };

  it('mostra a saudação com posto, nome de guerra e a data por extenso', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-19T13:30:00Z') });
    simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
    abrir('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Bom dia, SD BM ANDRADE' })).toBeInTheDocument();
    expect(screen.getByText('Quinta-feira, 19 de novembro de 2026')).toBeInTheDocument();
  });

  it('a faixa tem a marca do pouso e usa /boas-vindas.jpg', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
    abrir('/');
    const titulo = await screen.findByRole('heading', { level: 1 });
    const faixa = titulo.closest('[data-faixa-boas-vindas]');
    expect(faixa).not.toBeNull();
    expect(faixa!.querySelector('img')).toHaveAttribute('src', '/boas-vindas.jpg');
    // sem a animação, a saudação e os cartões aparecem direto
    expect(titulo.closest('[data-chegada]')).toBeNull();
  });

  it('mostra um cartão por módulo visível; Visualização sem link e com "Em breve"', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: /Confecção de escalas/ })).toHaveAttribute('href', '/grade');
    expect(screen.getByRole('link', { name: /Pecúlio do 2º GB/ })).toHaveAttribute('href', '/peculio');
    expect(screen.getByRole('link', { name: /Minha ficha/ })).toHaveAttribute('href', '/minha-ficha');
    const visualizacao = screen.getByText('Visualização de escalas').closest('li')!;
    expect(within(visualizacao).queryByRole('link')).toBeNull();
    expect(within(visualizacao).getByText('Em breve')).toBeInTheDocument();
  });

  it('o militar comum vê dois cartões: Visualização e Minha ficha', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comum } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    expect(within(screen.getByRole('main')).getAllByRole('listitem').map((li) => li.querySelector('h2')?.textContent)).toEqual(['Visualização de escalas', 'Minha ficha']);
    expect(screen.queryByText('Confecção de escalas')).toBeNull();
  });

  it('com ?aviso=outro-papel, mostra o aviso', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comum } });
    abrir('/?aviso=outro-papel');
    expect(await screen.findByRole('status')).toHaveTextContent('Essa área é de outro nível de acesso.');
  });

  it('sem o aviso, não mostra nada de aviso', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comum } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('Essa área é de outro nível de acesso.')).toBeNull();
  });

  it('um cartão leva ao módulo', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
    const router = abrir('/');
    (await screen.findByRole('link', { name: /Minha ficha/ })).click();
    await waitFor(() => expect(router.state.location.pathname).toBe('/minha-ficha'));
  });
});
