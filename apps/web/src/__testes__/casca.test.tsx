import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navegador, pedir, saida } from '@/api/cliente';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

async function clicarSair() {
  await userEvent.click(await screen.findByRole('button', { name: /SD BM ANDRADE/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }));
}

describe('sair', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    saida.marcar(false);
  });

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

  // [foco 2] o pedido que ainda estava no ar quando a pessoa saiu volta 401: o "Sair" já leva para entrar, e não é uma sessão que terminou
  it('depois de "Sair", um pedido que volta 401 não leva para entrar com o aviso de sessão terminada', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      '/api/auth/sign-out': { status: 200, corpo: { success: true } },
      'GET /api/qualquer': { status: 401, corpo: { erro: 'Sessão inválida.' } },
    });
    const router = abrir('/');
    await clicarSair();
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(ir).not.toHaveBeenCalled();
  });

  it('se o "Sair" falha, a sessão continua valendo: um 401 depois disso é sessão que terminou, com o aviso', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, '/api/auth/sign-out': 'rede', 'GET /api/qualquer': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    abrir('/');
    await clicarSair();
    await screen.findByText('Não foi possível sair. Verifique a conexão e tente de novo.');
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    expect(ir).toHaveBeenCalledWith(expect.stringContaining('sessao=terminou'));
  });
});

describe('sessão que terminou no meio do uso', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('uma consulta com 401 leva para entrar, com o aviso e o caminho de volta', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/militares?busca=x');
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/unidades/u-1sb/militares': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    abrir('/militares');
    await waitFor(() => expect(ir).toHaveBeenCalledWith('/entrar?sessao=terminou&voltar=%2Fmilitares%3Fbusca%3Dx'));
  });

  it('uma gravação (PATCH) com 401 também leva para entrar, e o erro de sempre continua (Review Focus 1)', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/militares/m1');
    simularApi({ 'PATCH /api/militares/m1': { status: 401, corpo: { erro: 'Sessão inválida.' } } });
    await expect(pedir('PATCH', '/api/militares/m1', { nomeGuerra: 'X' })).rejects.toMatchObject({ status: 401, message: 'Sessão inválida.' });
    expect(ir).toHaveBeenCalledWith('/entrar?sessao=terminou&voltar=%2Fmilitares%2Fm1');
  });

  it('quem nunca entrou (/api/eu com 401) vai para entrar sem o aviso (Review Focus 2)', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    simularApi({ '/api/eu': { status: 401 } });
    const router = abrir('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(ir).not.toHaveBeenCalled();
  });

  it('já na tela de entrar, um 401 não manda de novo para entrar', async () => {
    const ir = vi.spyOn(navegador, 'ir').mockImplementation(() => {});
    window.history.replaceState({}, '', '/entrar');
    simularApi({ 'GET /api/qualquer': { status: 401, corpo: { erro: 'Sem sessão.' } } });
    await expect(pedir('GET', '/api/qualquer')).rejects.toMatchObject({ status: 401 });
    expect(ir).not.toHaveBeenCalled();
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
    const caminho = screen.getByRole('navigation', { name: 'Unidade' });
    expect(within(caminho).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    expect(within(caminho).getAllByRole('listitem').at(-1)).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('img', { name: 'Brasão do Corpo de Bombeiros Militar de Pernambuco' })).toHaveAttribute('src', '/brasao-cbmpe.png');
    expect(screen.getByRole('link', { name: 'Grade geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Estrutura').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Grade geral', level: 1 })).toBeInTheDocument();
  });

  it('militar comum não vê os cadastros', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    abrir('/');
    expect(await screen.findByText('SD BM ANDRADE')).toBeInTheDocument();
    expect(screen.queryByText('Militares')).toBeNull();
    expect(screen.queryByText('Configurações')).toBeNull();
    expect(screen.getByRole('link', { name: 'Grade geral' })).toBeInTheDocument();
  });

  it('banco desatualizado mostra a mensagem do servidor', async () => {
    const MSG = 'O banco de dados está desatualizado. Peça ao administrador para aplicar as migrações pendentes.';
    simularApi({ '/api/eu': { status: 503, corpo: { erro: MSG } } });
    abrir('/');
    expect(await screen.findByText(MSG)).toBeInTheDocument();
  });
});

describe('trilho', () => {
  const NOMES = ['Grade geral', 'Escala do mês', 'Efetivo por dia', 'Voluntariado', 'Cotas', 'Militares', 'Serviços', 'Escalas', 'Feriados', 'Configurações', 'Estrutura', 'Histórico', 'Ajuda'];
  const menu = () => screen.getByRole('navigation', { name: 'Navegação principal' });

  it('no computador o menu é um trilho de 84 px', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    expect(menu().parentElement?.className).toContain('md:grid-cols-[84px_1fr]');
    expect(menu().className).toContain('md:w-[84px]');
  });

  it('cada item do trilho mantém o nome', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [{ papel: 'administrador', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] } } });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    for (const nome of NOMES) expect(within(menu()).getByText(nome)).toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Militares' })).toHaveAttribute('href', '/militares');
    expect(within(menu()).getByRole('link', { name: 'Escala do mês' })).toHaveAttribute('href', '/escala-do-mes');
    expect(within(menu()).getByRole('link', { name: 'Efetivo por dia' })).toHaveAttribute('href', '/efetivo-por-dia');
    expect(within(menu()).getByText('Estrutura').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(within(menu()).queryByRole('link', { name: 'Estrutura' })).toBeNull();
  });

  it('o menu do celular abre e fecha', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    expect(menu().className).toContain('-translate-x-full');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(menu().className).toContain('translate-x-0');
    expect(menu().className).not.toContain('-translate-x-full');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(menu().className).toContain('-translate-x-full');
  });

  it('abrir o menu do celular leva o foco ao primeiro item', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(within(menu()).getByRole('link', { name: 'Grade geral' })).toHaveFocus();
  });

  it('Esc fecha o menu do celular e devolve o foco ao botão que o abriu', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    const abrirMenu = screen.getByRole('button', { name: 'Abrir menu' });
    await userEvent.click(abrirMenu);
    expect(menu().className).not.toContain('-translate-x-full');
    await userEvent.keyboard('{Escape}');
    expect(menu().className).toContain('-translate-x-full');
    expect(abrirMenu).toHaveFocus();
  });

  it('o botão "Fechar menu" também devolve o foco, e clicar fora continua fechando', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    const abrirMenu = screen.getByRole('button', { name: 'Abrir menu' });
    await userEvent.click(abrirMenu);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(menu().className).toContain('-translate-x-full');
    expect(abrirMenu).toHaveFocus();
    // clicar fora (no fundo escurecido)
    await userEvent.click(abrirMenu);
    const fundo = document.querySelector<HTMLElement>('.fixed.inset-0[aria-hidden]')!;
    await userEvent.click(fundo);
    expect(menu().className).toContain('-translate-x-full');
  });

  it('no celular o caminho mostra a seção atual', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/');
    await screen.findByText('SD BM ANDRADE');
    expect(document.querySelector('[data-caminho-curto]')).toHaveTextContent('1ª SB');
  });
});

describe('revisão 3: falhas ao abrir o sistema', () => {
  it('endereço que não existe mostra a página em português, com o caminho de volta', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
    abrir('/nao-existe');
    expect(await screen.findByText('Esta página não existe.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Not Found')).toBeNull();
  });

  it('erro ao carregar o sistema mostra o texto em português e "Tentar de novo"', async () => {
    simularApi({ '/api/eu': { status: 500, corpo: { erro: 'Servidor fora do ar.' } } });
    abrir('/');
    expect(await screen.findByText('Não foi possível abrir o sistema.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });
});
