import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardarEstadoDoMenu, lerEstadoDoMenu } from '@/lib/estado-do-menu';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// O menu lateral em três estados (6.70, Task 6): largo, recolhido e escondido, guardado por pessoa. Dados fictícios (D7).
const menu = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const entrar = async (caminho = '/grade') => {
  simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO } });
  const router = abrir(caminho);
  await screen.findByText('SD ANDRADE');
  return router;
};
const telaEstreita = (estreita: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: estreita && q.includes('1439'), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
afterEach(() => vi.restoreAllMocks());

describe('o que o estado guardado diz', () => {
  it('sem nada guardado, ou com lixo, abre largo', () => {
    expect(lerEstadoDoMenu('u1')).toBe('largo');
    localStorage.setItem('menu-lateral:u1', 'sumido');
    expect(lerEstadoDoMenu('u1')).toBe('largo');
  });

  it('cada pessoa tem o seu estado no mesmo navegador', () => {
    guardarEstadoDoMenu('u1', 'recolhido');
    guardarEstadoDoMenu('u2', 'escondido');
    expect(lerEstadoDoMenu('u1')).toBe('recolhido');
    expect(lerEstadoDoMenu('u2')).toBe('escondido');
    expect(lerEstadoDoMenu('u3')).toBe('largo');
  });

  it('com o armazenamento lançando erro, lê "largo" e guardar não quebra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(lerEstadoDoMenu('u1')).toBe('largo');
    expect(() => guardarEstadoDoMenu('u1', 'recolhido')).not.toThrow();
  });
});

describe('o menu largo (o estado de quem nunca escolheu)', () => {
  it('traz os itens da lista fixa, na ordem e nos grupos dela; sem Estrutura, Histórico nem Ajuda', async () => {
    await entrar();
    const grupos = within(menu()).getAllByRole('list').map((l) => within(l).getAllByRole('listitem').map((i) => i.textContent));
    expect(grupos).toEqual([['Grade geral', 'Escala do mês', 'Efetivo por dia'], ['Voluntariado', 'Cotas'], ['Militares', 'Turnos', 'Escalas', 'Feriados'], ['Configurações da escala']]);
    for (const fora of ['Estrutura', 'Histórico', 'Ajuda']) expect(within(menu()).queryByText(fora)).toBeNull();
  });

  it('largura de 240 px; no alto o brasão e a unidade, e logo abaixo "Recolher" e "Esconder", antes dos itens', async () => {
    await entrar();
    expect(menu().parentElement?.className).toContain('md:grid-cols-[240px_1fr]');
    expect(menu().className).toContain('md:w-60');
    const casa = within(menu()).getByRole('link', { name: 'Ir para o início' });
    expect(within(casa).getByRole('img', { name: 'Brasão do 2º Grupamento de Bombeiros' })).toHaveAttribute('src', '/brasao-2gb.png');
    expect(casa).toHaveTextContent('1ª SB');
    expect(casa).toHaveTextContent('Sistema de Gestão - 2º GB');
    const recolher = within(menu()).getByRole('button', { name: 'Recolher' });
    const esconder = within(menu()).getByRole('button', { name: 'Esconder' });
    const primeiroItem = within(menu()).getByRole('link', { name: 'Grade geral' });
    expect(casa.compareDocumentPosition(recolher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(recolher.compareDocumentPosition(esconder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(esconder.compareDocumentPosition(primeiroItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o item ativo tem fundo branco e texto vinho; os botões têm foco visível e só existem no computador', async () => {
    await entrar();
    const ativo = within(menu()).getByRole('link', { name: 'Grade geral' });
    expect(ativo).toHaveAttribute('aria-current', 'page');
    expect(ativo.className).toContain('bg-white');
    expect(ativo.className).toContain('text-vinho');
    // o texto branco do item comum não pode vir junto: no fundo branco ele sumiria
    expect(ativo.className).not.toContain('text-white');
    expect(within(menu()).getByRole('link', { name: 'Escala do mês' }).className).toContain('text-white/90');
    const recolher = within(menu()).getByRole('button', { name: 'Recolher' });
    expect(recolher.className).toContain('focus-visible:outline-white');
    // no celular não há o que recolher: o menu abre de lado e fecha no "x"
    expect(recolher.parentElement?.className).toContain('max-md:hidden');
  });
});

describe('recolher e abrir', () => {
  it('"Recolher" deixa o trilho de 84 px e o botão vira "Abrir"; "Abrir" volta ao largo', async () => {
    await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Recolher' }));
    expect(menu().parentElement?.className).toContain('md:grid-cols-[84px_1fr]');
    expect(menu().className).toContain('md:w-[84px]');
    expect(within(menu()).queryByRole('button', { name: 'Recolher' })).toBeNull();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Abrir' }));
    expect(menu().className).toContain('md:w-60');
  });

  it('os itens continuam com o nome quando o menu está recolhido', async () => {
    await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Recolher' }));
    expect(within(menu()).getByRole('link', { name: 'Escala do mês' })).toHaveAttribute('href', '/escala-do-mes');
  });
});

describe('esconder e trazer de volta', () => {
  it('"Esconder" tira o menu do computador e põe o botão "Menu" no alto; o botão devolve o estado de antes', async () => {
    await entrar();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Esconder' }));
    expect(menu().className).toContain('md:hidden');
    expect(menu().parentElement?.className).not.toContain('md:grid-cols-');
    const flutuante = screen.getByRole('button', { name: 'Menu' });
    expect(flutuante.className).toContain('fixed');
    expect(flutuante.className).toContain('top-[calc(var(--faixa)+0.5rem)]');
    // 6.75: o cabeçalho do Topo é z-40 (a lista do degrau passa por cima da Grade); o botão flutuante precisa ficar acima dele, senão o cabeçalho o cobre
    const z = (el: Element) => Number(/(?:^|\s)z-(\d+)(?:\s|$)/.exec(el.className)?.[1]);
    expect(z(flutuante)).toBeGreaterThan(z(document.querySelector('header')!));
    // o cabeçalho abre espaço à esquerda: o botão não cobre a unidade
    expect(screen.getAllByRole('banner')[0]!.className).toContain('md:pl-31');
    await userEvent.click(flutuante);
    expect(menu().className).toContain('md:w-60');
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });

  it('escondido a partir do menu recolhido, "Menu" volta ao recolhido', async () => {
    await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Recolher' }));
    await userEvent.click(within(menu()).getByRole('button', { name: 'Esconder' }));
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(menu().className).toContain('md:w-[84px]');
  });

  it('o botão "Menu" leva o foco para o menu que voltou', async () => {
    await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Esconder' }));
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await waitFor(() => expect(within(menu()).getByRole('link', { name: 'Grade geral' })).toHaveFocus());
  });
});

describe('o estado fica guardado por pessoa', () => {
  it('sobrevive à troca de tela e à recarga', async () => {
    const router = await entrar();
    await userEvent.click(within(menu()).getByRole('button', { name: 'Recolher' }));
    expect(localStorage.getItem('menu-lateral:u1')).toBe('recolhido');
    await userEvent.click(within(menu()).getByRole('link', { name: 'Escala do mês' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/escala-do-mes'));
    expect(menu().className).toContain('md:w-[84px]');
  });

  it('quem volta ao site abre como deixou; outra pessoa no mesmo navegador abre largo', async () => {
    guardarEstadoDoMenu('u1', 'escondido');
    await entrar();
    expect(menu().className).toContain('md:hidden');
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('com o armazenamento lançando erro, abre largo e os botões funcionam', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    await entrar();
    expect(menu().className).toContain('md:w-60');
    await userEvent.click(within(menu()).getByRole('button', { name: 'Recolher' }));
    expect(menu().className).toContain('md:w-[84px]');
  });
});

describe('o painel do dia abre em tela mais estreita que 1440 px', () => {
  const COM_PAINEL = '/grade?mes=2026-12&militar=m1&dia=2026-12-10';

  it('o menu largo recolhe sozinho e, ao fechar o painel, volta; nada fica guardado por causa disso', async () => {
    telaEstreita(true);
    const router = await entrar(COM_PAINEL);
    expect(menu().className).toContain('md:w-[84px]');
    expect(localStorage.getItem('menu-lateral:u1')).toBeNull();
    await router.navigate({ to: '/grade', search: { mes: '2026-12' } as never });
    await waitFor(() => expect(menu().className).toContain('md:w-60'));
  });

  it('em tela larga (1440 px ou mais) o menu fica como está', async () => {
    telaEstreita(false);
    await entrar(COM_PAINEL);
    expect(menu().className).toContain('md:w-60');
  });

  it('escondido continua escondido, com o painel aberto ou não', async () => {
    telaEstreita(true);
    guardarEstadoDoMenu('u1', 'escondido');
    await entrar(COM_PAINEL);
    expect(menu().className).toContain('md:hidden');
  });
});

describe('o celular', () => {
  it('o menu abre de lado com a mesma lista e fecha no "x"', async () => {
    await entrar();
    expect(menu().className).toContain('-translate-x-full');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(menu().className).not.toContain('-translate-x-full');
    expect(within(menu()).getAllByRole('link').map((l) => l.textContent)).toEqual(expect.arrayContaining(['Grade geral', 'Escala do mês', 'Efetivo por dia', 'Voluntariado', 'Cotas', 'Militares', 'Turnos', 'Escalas', 'Feriados', 'Configurações da escala']));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(menu().className).toContain('-translate-x-full');
  });

  it('o menu aberto e o fundo escuro ficam por cima da folha do painel do dia (z-40), que também é do celular', async () => {
    await entrar();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const classe = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/);
    expect(classe(menu())).toContain('z-50');
    // o fundo escuro, acima da folha e abaixo do menu
    expect(classe(document.querySelector('div.fixed.inset-0[aria-hidden]'))).toContain('z-45');
    // no computador o menu volta ao nível de sempre
    expect(classe(menu())).toContain('md:z-40');
  });
});
