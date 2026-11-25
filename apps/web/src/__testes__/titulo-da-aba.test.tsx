import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { tituloDaAba } from '@/lib/titulo-da-aba';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// N0.3 (achado R6): o nome da tela na aba do navegador. Nenhum nome de militar vai para o título.
const SISTEMA = 'Sistema de Gestão - 2º GB';

describe('o título da aba', () => {
  it('usa o nome do menu; na ficha, "Militar"; no login, "Entrar"; na tela inicial, só o sistema', () => {
    expect(tituloDaAba('/grade')).toBe(`Grade geral · ${SISTEMA}`);
    expect(tituloDaAba('/cotas')).toBe(`Cotas · ${SISTEMA}`);
    expect(tituloDaAba('/servicos')).toBe(`Turnos · ${SISTEMA}`);
    expect(tituloDaAba('/militares')).toBe(`Militares · ${SISTEMA}`);
    expect(tituloDaAba('/militares/abc')).toBe(`Militar · ${SISTEMA}`);
    expect(tituloDaAba('/entrar')).toBe(`Entrar · ${SISTEMA}`);
    expect(tituloDaAba('/peculio')).toBe(`Pecúlio da unidade · ${SISTEMA}`);
    expect(tituloDaAba('/peculio/aniversarios')).toBe(`Aniversários · ${SISTEMA}`);
    expect(tituloDaAba('/peculio/militar/abc')).toBe(`Militar · ${SISTEMA}`);
    expect(tituloDaAba('/minha-ficha')).toBe(`Minha ficha · ${SISTEMA}`);
    expect(tituloDaAba('/configuracoes')).toBe(`Configurações · ${SISTEMA}`);
    // a pesquisa e a ficha dentro do Pecúlio: o nome da tela, e nunca o do militar (os endereços antigos da consulta valem o mesmo)
    expect(tituloDaAba('/peculio/pesquisar')).toBe(`Pesquisar militares · ${SISTEMA}`);
    expect(tituloDaAba('/consulta')).toBe(`Pesquisar militares · ${SISTEMA}`);
    expect(tituloDaAba('/consulta/abc')).toBe(`Pesquisar militares · ${SISTEMA}`);
    expect(tituloDaAba('/')).toBe(SISTEMA);
  });

  it('um endereço sem nome no menu fica só com o sistema', () => {
    expect(tituloDaAba('/nao-existe')).toBe(SISTEMA);
  });

  it('navegar de /grade para /cotas muda o título da aba', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/grade');
    await waitFor(() => expect(document.title).toBe(`Grade geral · ${SISTEMA}`));
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Cotas' }));
    await waitFor(() => expect(document.title).toBe(`Cotas · ${SISTEMA}`));
  });
});
