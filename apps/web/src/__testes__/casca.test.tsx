import { screen, waitFor, within } from '@testing-library/react';
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
    const caminho = screen.getByRole('navigation', { name: 'Unidade' });
    expect(within(caminho).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB']);
    expect(within(caminho).getAllByRole('listitem').at(-1)).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('img', { name: 'Brasão do Corpo de Bombeiros Militar de Pernambuco' })).toHaveAttribute('src', '/brasao-cbmpe.png');
    expect(screen.getByRole('link', { name: 'Grade geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Estrutura').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.getByText('A grade geral chega na próxima fase.')).toBeInTheDocument();
  });

  it('militar comum não vê os cadastros', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    abrir('/');
    expect(await screen.findByText('SD BM ANDRADE')).toBeInTheDocument();
    expect(screen.queryByText('Militares')).toBeNull();
    expect(screen.queryByText('Configurações')).toBeNull();
    expect(screen.getByRole('link', { name: 'Grade geral' })).toBeInTheDocument();
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
