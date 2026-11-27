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
    expect(await screen.findByRole('heading', { level: 1, name: 'Bom dia, SD ANDRADE' })).toBeInTheDocument();
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

  it('6.67: o título da saudação e a linha da data ficam dentro de um elemento só, que a animação mede para as brasas ficarem mais fracas ali', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
    abrir('/');
    const titulo = await screen.findByRole('heading', { level: 1 });
    const area = titulo.closest('[data-saudacao-da-faixa]');
    expect(area).not.toBeNull();
    expect(area!.querySelector('p.data')).not.toBeNull();
    // e a área está dentro do quadro da faixa
    expect(area!.closest('[data-faixa-boas-vindas]')).not.toBeNull();
  });

  // 6.42: a cena num quadro com margens que encolhe ao rolar (docs/telas/refatoracao/tela-inicial/index.html)
  describe('o quadro da cena', () => {
    const quadro = async () => {
      simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
      abrir('/');
      const titulo = await screen.findByRole('heading', { level: 1 });
      return titulo.closest<HTMLElement>('[data-faixa-boas-vindas]')!;
    };
    const rolar = (y: number) => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    };
    afterEach(() => {
      rolar(0);
      vi.unstubAllGlobals();
    });

    it('tem cantos arredondados, e a imagem cobre o quadro com o recorte da animação (centro, 66% na vertical)', async () => {
      const faixa = await quadro();
      expect(faixa.className).toMatch(/rounded-superficie/);
      // antes de o script medir, o quadro já nasce com a altura cheia (sem salto na primeira pintura)
      expect(faixa.className.split(' ')).toEqual(expect.arrayContaining(['h-[250px]', 'md:h-[400px]']));
      expect(faixa.className).not.toMatch(/aspect-/);
      const img = faixa.querySelector('img')!;
      expect(img.className).toMatch(/object-cover/);
      expect(img.style.objectPosition).toBe('center 66%');
    });

    it('sem rolagem tem a altura cheia (400 px no computador); ao rolar encolhe até 64 px e não passa disso; voltar ao topo devolve o tamanho', async () => {
      const faixa = await quadro();
      await waitFor(() => expect(faixa.style.height).toBe('400px'));
      rolar(118);
      await waitFor(() => expect(faixa.style.height).toBe('282px'));
      rolar(5000);
      await waitFor(() => expect(faixa.style.height).toBe('64px'));
      expect(faixa.style.getPropertyValue('--e')).toBe('1');
      rolar(0);
      await waitFor(() => expect(faixa.style.height).toBe('400px'));
    });

    it('com menos movimento, o quadro não tem tamanho intermediário: muda do cheio para a barra', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
      const faixa = await quadro();
      rolar(100);
      await waitFor(() => expect(faixa.style.height).toBe('400px'));
      rolar(180);
      await waitFor(() => expect(faixa.style.height).toBe('64px'));
    });

    it('o que a pessoa rola não muda de tamanho: um espaçador compensa o que o quadro encolheu', async () => {
      const faixa = await quadro();
      rolar(5000);
      await waitFor(() => expect(faixa.style.height).toBe('64px'));
      const espaco = document.querySelector<HTMLElement>('[data-espaco-da-cena]')!;
      expect(espaco.style.height).toBe('336px');
    });
  });

  // 6.42: os cartões grandes viram uma fila de atalhos, cada um com o nome do módulo e uma linha de situação montada com o que a tela já sabe
  it('mostra um atalho por módulo visível, num nav "Módulos", com a situação da unidade e do mês; a Visualização leva a Minha escala (7.5)', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-19T13:30:00Z') });
    simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    const nav = screen.getByRole('navigation', { name: 'Módulos' });
    expect(within(nav).getByRole('link', { name: /Confecção de escalas/ })).toHaveAttribute('href', '/grade');
    // a unidade não entra na frase: já está no Topo, e o artigo erraria o gênero ("da 2º GB")
    expect(within(nav).getByRole('link', { name: /Confecção de escalas/ })).toHaveTextContent('Escalas de novembro');
    expect(within(nav).getByRole('link', { name: /Confecção de escalas/ })).not.toHaveTextContent('1ª SB');
    expect(within(nav).getByRole('link', { name: /Pecúlio Geral/ })).toHaveAttribute('href', '/peculio');
    expect(within(nav).getByRole('link', { name: /Pecúlio Geral/ })).toHaveTextContent('Contatos e cadastros');
    expect(within(nav).getByRole('link', { name: /Estrutura/ })).toHaveAttribute('href', '/estrutura');
    // a pesquisa não é um atalho: é uma tela do Pecúlio Geral
    expect(within(nav).queryByRole('link', { name: /^Pesquisar militares/ })).toBeNull();
    expect(within(nav).getByRole('link', { name: /Minha ficha/ })).toHaveAttribute('href', '/minha-ficha');
    const visualizacao = screen.getByText('Visualização de escalas').closest('li')!;
    expect(within(visualizacao).getByRole('link')).toHaveAttribute('href', '/minha-escala');
    expect(within(visualizacao).getByText('Sua escala e o seu voluntariado')).toBeInTheDocument();
    // saíram os cartões grandes: nenhum h2 de módulo, nenhum "Abrir"
    expect(within(nav).queryByRole('heading')).toBeNull();
    expect(within(nav).queryByText('Abrir')).toBeNull();
  });

  it('o militar comum vê quatro atalhos de módulo, mais o cartão do Laboratório: Pecúlio Geral (que leva direto à pesquisa), Visualização, Minha ficha e Configurações (Review Focus 5)', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comum } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    const nav = screen.getByRole('navigation', { name: 'Módulos' });
    expect(within(nav).getAllByRole('listitem').map((li) => li.querySelector('b')?.textContent)).toEqual(['Pecúlio Geral', 'Visualização de escalas', 'Minha ficha', 'Configurações', 'Laboratório']);
    const peculio = within(nav).getByRole('link', { name: /Pecúlio Geral/ });
    expect(peculio).toHaveAttribute('href', '/peculio/pesquisar');
    expect(peculio).toHaveTextContent('Pesquisar militares');
    expect(screen.queryByText('Confecção de escalas')).toBeNull();
  });

  it('numa unidade só de consulta, o atalho da Confecção diz que é só para ver', async () => {
    const unidade = { id: 'u-2sb', sigla: '2ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '2ª SB'], nivel: 4, tipo: 'secao', maeId: null };
    simularApi({ '/api/eu': { status: 200, corpo: { ...comum, unidades: [unidade], unidadesSoConsulta: [unidade] } } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: /Confecção de escalas/ })).toHaveTextContent(/Escalas de \w+, só para ver/);
  });

  it('não há aniversariantes nem "O que falta no mês" na tela inicial', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: comPapel } });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/aniversariante/i)).toBeNull();
    expect(screen.queryByText(/o que falta no mês/i)).toBeNull();
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
