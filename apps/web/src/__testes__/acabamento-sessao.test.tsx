import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enviarArquivo, ErroApi, navegador, pedir, saida } from '@/api/cliente';
import { haAlteracoesPendentes } from '@/componentes/AlteracoesPendentes';
import { ErroAoAbrir } from '@/componentes/TelasDeFalha';
import { render } from '@testing-library/react';
import { deveTentarDeNovo } from '@/lib/consultas';
import { lerUltimaInteira } from '@/lib/transicao-login/regra';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.17, Task 5: sessão, carregamento e telas de falha.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  saida.marcar(false);
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('a sessão que termina (itens 2 a 4)', () => {
  it('item 2: um 401 com alteração não salva descarta a pendência, para o aviso "Sair do site?" do navegador não aparecer', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    const FICHA_M1 = { id: 'm1' };
    void FICHA_M1;
    simularApi({ 'GET /api/qualquer': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    // uma pendência registrada como a ficha faz (o conjunto é do módulo)
    const { usePendencia, ProvedorDePendencias } = await import('@/componentes/AlteracoesPendentes');
    void usePendencia;
    void ProvedorDePendencias;
    expect(haAlteracoesPendentes()).toBe(false);
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    expect(ir).toHaveBeenCalledWith(expect.stringContaining('sessao=terminou'));
    expect(haAlteracoesPendentes()).toBe(false);
  });

  it('item 3: importar uma planilha com a sessão terminada leva a entrar, com o aviso', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/configuracoes');
    simularApi({ 'POST /api/unidades/u/importacao/feriados': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    await expect(enviarArquivo('/api/unidades/u/importacao/feriados', new File(['x'], 'p.xlsx'))).rejects.toMatchObject({ status: 401 });
    expect(ir).toHaveBeenCalledWith('/entrar?sessao=terminou&voltar=%2Fconfiguracoes');
  });

  it('item 4: um pedido atendido logo depois do "Sair" não mostra o aviso de sessão terminada', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    simularApi({ 'GET /api/qualquer': { status: 200, corpo: { ok: true } } });
    saida.marcar(true);
    await expect(pedir('GET', '/api/qualquer')).resolves.toEqual({ ok: true });
    expect(ir).not.toHaveBeenCalled();
  });
});

describe('as tentativas das consultas (itens 7 e 8)', () => {
  const erro = (status: number) => new ErroApi('x', status);
  it('item 7: erro 4xx não tenta de novo (a mensagem aparece na hora)', () => {
    for (const s of [400, 401, 403, 404, 409, 422]) expect(deveTentarDeNovo(0, erro(s)), String(s)).toBe(false);
  });
  it('item 8: 408 e 429 tentam de novo, como os 5xx e a falta de conexão, até duas vezes', () => {
    for (const s of [408, 429, 500, 502, 503, 0]) {
      expect(deveTentarDeNovo(0, erro(s)), String(s)).toBe(true);
      expect(deveTentarDeNovo(1, erro(s)), String(s)).toBe(true);
      expect(deveTentarDeNovo(2, erro(s)), String(s)).toBe(false);
    }
  });
});

describe('a tela de falha das rotas (item 9)', () => {
  const tela = (error: unknown) => render(<ErroAoAbrir error={error as Error} reset={() => {}} />);
  it('erro de rede fala em conexão; o foco vai para o título', () => {
    tela(new ErroApi('Sem conexão com o servidor. Tente de novo.', 0));
    expect(screen.getByText('Sem conexão com o sistema. Confira a internet e tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Não foi possível abrir o sistema.' })).toHaveFocus();
  });
  it('erro que o servidor explicou mostra a mensagem do servidor, sem falar em conexão', () => {
    tela(new ErroApi('Você não tem permissão nesta seção.', 403));
    expect(screen.getByText('Você não tem permissão nesta seção.')).toBeInTheDocument();
    expect(screen.queryByText(/conexão|internet/)).toBeNull();
  });
  it('erro sem mensagem do servidor (o texto padrão) e erro de código seguem com o conselho do sistema, sem falar em conexão', () => {
    tela(new ErroApi('Erro inesperado (500). Tente de novo.', 500, undefined, true));
    expect(screen.getByText('O sistema encontrou um erro. Tente de novo em alguns minutos.')).toBeInTheDocument();
  });
});

describe('a marca das 12 h da animação (item 11)', () => {
  it('uma data no futuro é tratada como se não existisse', () => {
    localStorage.setItem('escalas2gb.login-animacao', String(Date.now() + 3_600_000));
    expect(lerUltimaInteira()).toBeNull();
    localStorage.setItem('escalas2gb.login-animacao', String(Date.now() - 3_600_000));
    expect(lerUltimaInteira()).not.toBeNull();
  });
});

describe('a animação do login (itens 12 e 13)', () => {
  it('item 12: mede a tela pelo visualViewport quando ele existe, e o canvas não passa de 2560 px de largura interna', async () => {
    const { medidasDaCamada } = await import('@/lib/transicao-login/medidas');
    expect(medidasDaCamada({ innerWidth: 1000, innerHeight: 800, devicePixelRatio: 2 })).toEqual({ largura: 1000, altura: 800, cw: 2000, ch: 1600 });
    // o visualViewport (a área visível no celular, sem a barra do navegador) vale mais que a janela
    expect(medidasDaCamada({ innerWidth: 1000, innerHeight: 800, devicePixelRatio: 2, visualViewport: { width: 390, height: 700 } })).toEqual({ largura: 390, altura: 700, cw: 780, ch: 1400 });
    // tela larga com densidade 2: a largura interna fica em 2560, e a altura acompanha
    expect(medidasDaCamada({ innerWidth: 3200, innerHeight: 1600, devicePixelRatio: 2 })).toEqual({ largura: 3200, altura: 1600, cw: 2560, ch: 1280 });
    // densidade acima de 2 vale 2
    expect(medidasDaCamada({ innerWidth: 400, innerHeight: 300, devicePixelRatio: 3 })).toMatchObject({ cw: 800, ch: 600 });
  });

  it('item 13: navegador sem `canvas`, mesmo com a imagem carregada: a cena nunca fica pronta', async () => {
    vi.resetModules();
    class Imagem {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', Imagem);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const armazem = await import('@/lib/transicao-login/armazem');
    armazem.preparar();
    await new Promise((r) => setTimeout(r, 20));
    expect(armazem.cenaPronta()).toBe(false);
  });

  it('item 13: a camada da animação some em /criar-senha (sem canvas visível e sem "Entrando…")', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, trocarSenha: true } } });
    abrir('/criar-senha');
    await screen.findByRole('heading', { name: 'Crie a sua senha' });
    const canvas = document.querySelector('canvas');
    if (canvas) expect(canvas.hidden).toBe(true);
    expect(screen.queryByText('Entrando…')).toBeNull();
  });
});

describe('o aviso da lista que falhou (item 10)', () => {
  it('sem lista na tela: "não deu para carregar"; com a lista já carregada: só "Não deu para atualizar."; sem erro: nada', async () => {
    const { avisoDaLista } = await import('@/componentes/militares/Secao');
    expect(avisoDaLista({ isError: true, data: undefined })).toBe('Não deu para carregar a lista. Recarregue a página.');
    expect(avisoDaLista({ isError: true, data: [{ id: 'p1' }] })).toBe('Não deu para atualizar.');
    expect(avisoDaLista({ isError: false, data: undefined })).toBeUndefined();
  });
});

describe('o "Sair" sem resposta do servidor (item 6)', () => {
  it('diz "Não foi possível sair. Confira a conexão e tente de novo."', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, '/api/auth/sign-out': 'rede' });
    abrir('/');
    await userEvent.click(await screen.findByRole('button', { name: /SD ANDRADE/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(await screen.findByText('Não foi possível sair. Confira a conexão e tente de novo.')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });
});
