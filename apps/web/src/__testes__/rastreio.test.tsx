import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FichaMilitar } from 'contratos';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Rastreio } from '@/componentes/militares/Rastreio';
import { Secao } from '@/componentes/militares/Secao';

// Dados fictícios (D7). Hoje, nestes testes, é 24/11/2026.
type Periodo = FichaMilitar['rastreio'][number];
const periodo = (n: number, desde: string, ate: string | null, o: Partial<Periodo> = {}): Periodo => ({
  id: `r${n}`, unidadeId: 'u-1sb', unidadeSigla: '1ª SB', equipe: 'ALFA', jornada: 'pronto', quadro: 'QBMG', situacao: 'Ativa', desde, ate, alteradoPor: null, alteradoEm: null, ...o,
});
const ficha = (rastreio: Periodo[], podeAlterar = false): FichaMilitar =>
  ({
    id: 'm1', postoGradId: 'p1', rastreio,
    afastamentos: [{ id: 'a1', tipo: 'Férias', tipoAfastamentoId: 't1', inicio: '2026-12-16', fim: '2026-12-30', motivo: null, boletim: null }],
    podeEditar: { peculio: podeAlterar, escala: false, unidadeDeCima: null },
  }) as unknown as FichaMilitar;
const mostrar = (f: FichaMilitar) => render(<Rastreio ficha={f} unidadeId="u-1sb" />);
const abrir = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Histórico de rastreio/ }));
  return screen.getByRole('list', { name: 'Mudanças, da mais nova para a mais antiga' });
};

// do mockup da DESIGN: DGO (Adm), DGO com quadro, e a 1ª SB (Pronto, Alfa) desde 12/08/2026
const COMUM = [
  periodo(1, '2022-03-14', '2025-02-02', { unidadeSigla: 'DGO', equipe: null, jornada: 'adm', quadro: null }),
  periodo(2, '2025-02-03', '2026-08-11', { unidadeSigla: 'DGO', equipe: null, jornada: 'adm', quadro: 'QBMG', alteradoPor: { patente: 'CAP', nomeGuerra: 'LINS' }, alteradoEm: '2025-02-03T14:02:00' }),
  periodo(3, '2026-08-12', null, { alteradoPor: { patente: 'MAJ', nomeGuerra: 'BARRETO' }, alteradoEm: '2026-08-10T09:15:00' }),
];
/** N períodos colados, do mais velho ao mais novo (o último é o de hoje). */
const longos = (n: number) => Array.from({ length: n }, (_, i) => periodo(i + 1, `${2019 + i}-01-10`, i === n - 1 ? null : `${2020 + i}-01-09`, { equipe: i % 2 ? 'ALFA' : 'BRAVO' }));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-24T15:00:00Z') });
});
afterEach(() => vi.useRealTimers());

describe('o texto ao lado do título só aparece com a seção recolhida (6.49)', () => {
  it('em qualquer seção: recolhida mostra o resumo no botão do título; aberta, o texto some e o aria-expanded segue', async () => {
    render(<Secao titulo="Habilitações" resumo="Categoria D" recolhidaDeInicio><p>Conteúdo</p></Secao>);
    const botao = screen.getByRole('button', { name: /Habilitações/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(within(botao).getByText('Categoria D')).toBeInTheDocument();
    await userEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Categoria D')).toBeNull();
    await userEvent.click(botao);
    expect(within(botao).getByText('Categoria D')).toBeInTheDocument();
  });
});

describe('o resumo do histórico, recolhido', () => {
  it('é a unidade e a jornada do período de hoje', () => {
    mostrar(ficha(COMUM));
    expect(within(screen.getByRole('button', { name: /Histórico de rastreio/ })).getByText('1ª SB · Pronto')).toBeInTheDocument();
  });

  it('sem período de hoje: "Sem lotação"; com um período marcado para depois: "Lotação a partir de dd/mm/aaaa"', () => {
    const { unmount } = mostrar(ficha([periodo(1, '2025-01-01', '2026-06-30')]));
    expect(within(screen.getByRole('button', { name: /Histórico de rastreio/ })).getByText('Sem lotação')).toBeInTheDocument();
    unmount();
    mostrar(ficha([periodo(1, '2025-01-01', '2026-06-30'), periodo(2, '2027-01-01', null)]));
    expect(within(screen.getByRole('button', { name: /Histórico de rastreio/ })).getByText('Lotação a partir de 01/01/2027')).toBeInTheDocument();
  });
});

describe('o quadro "Hoje"', () => {
  const quadro = () => within(screen.getByRole('region', { name: 'Situação de hoje' }));

  it('diz desde quando e mostra os cinco campos, cada um com o seu rótulo; a frase "Situação atual:" não existe mais', async () => {
    mostrar(ficha(COMUM));
    await abrir();
    expect(quadro().getByText('Hoje')).toBeInTheDocument();
    expect(quadro().getByText(/desde 12\/08\/2026/)).toBeInTheDocument();
    for (const [rotulo, valor] of [['Lotação', '1ª SB'], ['Equipe', 'ALFA'], ['Jornada', 'Pronto'], ['Quadro', 'QBMG'], ['Situação', 'Ativa']]) {
      expect(quadro().getByText(rotulo!, { selector: 'dt' }).nextElementSibling).toHaveTextContent(valor!);
    }
    expect(screen.queryByText(/Situação atual:/)).toBeNull();
  });

  it('o que falta vem como "Sem equipe" e "Sem quadro"', async () => {
    mostrar(ficha([periodo(1, '2026-01-01', null, { equipe: null, quadro: null })]));
    await abrir();
    expect(quadro().getByText('Equipe', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Sem equipe');
    expect(quadro().getByText('Quadro', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Sem quadro');
  });

  it('sem lotação hoje: só "Hoje, sem lotação" e nenhum rótulo (Review Focus 2); havendo um período marcado, diz a partir de quando', async () => {
    const { unmount } = mostrar(ficha([periodo(1, '2025-01-01', '2026-06-30')]));
    await abrir();
    expect(screen.getByRole('region', { name: 'Situação de hoje' })).toHaveTextContent('Hoje, sem lotação');
    expect(screen.getByRole('region', { name: 'Situação de hoje' })).not.toHaveTextContent('Lotação a partir');
    expect(screen.queryByText('Lotação', { selector: 'dt' })).toBeNull();
    unmount();
    localStorage.clear();
    mostrar(ficha([periodo(1, '2025-01-01', '2026-06-30'), periodo(2, '2027-01-01', null)]));
    await abrir();
    expect(screen.getByRole('region', { name: 'Situação de hoje' })).toHaveTextContent('Hoje, sem lotação · lotação a partir de 01/01/2027');
  });
});

describe('a linha do tempo', () => {
  it('é uma lista, da mais nova para a mais antiga, com um item por mudança; os afastamentos não aparecem', async () => {
    mostrar(ficha(COMUM));
    const lista = await abrir();
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(3);
    expect(itens.map((i) => i.querySelector('time')!.textContent)).toEqual(['12/08/2026', '03/02/2025', '14/03/2022']);
    expect(screen.queryByText(/Afastamento/)).toBeNull();
    expect(screen.queryByText('Férias')).toBeNull();
  });

  it('o primeiro registro diz a situação inteira e "Primeiro registro"; a mudança, uma linha por campo, "de X para Y" para o leitor de tela e a seta escondida', async () => {
    mostrar(ficha(COMUM));
    const lista = await abrir();
    const [atual, meio, inicio] = within(lista).getAllByRole('listitem');
    expect(within(inicio!).getByText('Primeiro registro')).toBeInTheDocument();
    expect(within(inicio!).getByText('DGO · ADM · Ativa')).toBeInTheDocument();
    expect(within(meio!).getByText('Quadro', { selector: 'dt' }).nextElementSibling).toHaveTextContent('de sem quadro');
    const equipe = within(atual!).getByText('Equipe', { selector: 'dt' }).nextElementSibling!;
    expect(equipe).toHaveTextContent('de sem equipe');
    expect(equipe).toHaveTextContent('para ALFA');
    expect(within(equipe as HTMLElement).getByText('→')).toHaveAttribute('aria-hidden', 'true');
    // a ordem fixa dos campos que mudaram: Lotação, Equipe, Jornada
    expect(within(atual!).getAllByText(/^(Lotação|Equipe|Jornada|Quadro|Situação)$/, { selector: 'dt' }).map((d) => d.textContent)).toEqual(['Lotação', 'Equipe', 'Jornada']);
  });

  it('quem fez: "por MAJ BARRETO em 10/08/2026 às 09:15", só quando a ficha traz o autor', async () => {
    mostrar(ficha(COMUM));
    const lista = await abrir();
    const [atual, , inicio] = within(lista).getAllByRole('listitem');
    expect(within(atual!).getByText('por MAJ BARRETO em 10/08/2026 às 09:15')).toBeInTheDocument();
    expect(within(inicio!).queryByText(/^por /)).toBeNull();
  });

  it('dois períodos iguais seguidos: "Sem mudança na situação"', async () => {
    mostrar(ficha([periodo(1, '2026-01-01', '2026-02-28'), periodo(2, '2026-03-01', null)]));
    const lista = await abrir();
    expect(within(lista).getByText('Sem mudança na situação')).toBeInTheDocument();
  });

  describe('as marcas (o ponto de cada item)', () => {
    const marca = (li: HTMLElement) => ({ tipo: li.getAttribute('data-tipo'), vale: li.getAttribute('data-vale') });

    it('vale agora, anterior e primeiro registro; só um "vale agora", dito ao leitor de tela', async () => {
      mostrar(ficha(COMUM));
      const lista = await abrir();
      const itens = within(lista).getAllByRole('listitem');
      expect(itens.map(marca)).toEqual([{ tipo: 'mudanca', vale: 'agora' }, { tipo: 'mudanca', vale: 'antes' }, { tipo: 'inicio', vale: 'antes' }]);
      expect(within(itens[0]!).getByText(/, vale agora/)).toBeInTheDocument();
      expect(screen.getAllByText(/vale agora/)).toHaveLength(1);
    });

    it('Review Focus 1: a mudança marcada para o futuro fica no alto com "Ainda não vale"; o vale-agora continua no período de hoje', async () => {
      mostrar(ficha([...COMUM.map((p) => (p.id === 'r3' ? { ...p, ate: '2026-12-31' } : p)), periodo(4, '2027-01-01', null, { equipe: 'BRAVO' })]));
      const lista = await abrir();
      const itens = within(lista).getAllByRole('listitem');
      expect(itens.map(marca).map((m) => m.vale)).toEqual(['marcada', 'agora', 'antes', 'antes']);
      expect(within(itens[0]!).getByText('Ainda não vale')).toBeInTheDocument();
      expect(within(itens[1]!).queryByText('Ainda não vale')).toBeNull();
    });

    it('o vão sem lotação é um item sem ponto, com a frase; o ano só quando atravessa a virada', async () => {
      mostrar(ficha([periodo(1, '2025-01-01', '2025-03-09'), periodo(2, '2025-03-20', '2026-12-20'), periodo(3, '2027-01-10', null)]));
      const lista = await abrir();
      const itens = within(lista).getAllByRole('listitem');
      expect(itens.map((i) => i.getAttribute('data-tipo'))).toEqual(['mudanca', 'vao', 'mudanca', 'vao', 'inicio']);
      expect(within(itens[1]!).getByText('Sem lotação de 21/12/2026 a 09/01/2027')).toBeInTheDocument();
      expect(within(itens[3]!).getByText('Sem lotação de 10/03 a 19/03/2025')).toBeInTheDocument();
      expect(itens[1]!.querySelector('[data-ponto]')).toBeNull();
    });

    it('o item antes de um vão que está à vista não desenha o trilho até ele ("para antes do vão")', async () => {
      mostrar(ficha([periodo(1, '2025-01-01', '2025-03-09'), periodo(2, '2025-03-20', null)]));
      const lista = await abrir();
      const [mais, , velho] = within(lista).getAllByRole('listitem');
      expect(mais!.getAttribute('data-trilho')).toBe('ate-o-vao');
      expect(velho!.getAttribute('data-trilho')).toBe('nenhum');
    });
  });

  describe('o histórico longo', () => {
    it('Review Focus 3: com 5 itens, não há botão; com 6, o botão diz "(6)" e só 5 estão à vista', async () => {
      const { unmount } = mostrar(ficha(longos(5)));
      let lista = await abrir();
      expect(within(lista).getAllByRole('listitem')).toHaveLength(5);
      expect(screen.queryByRole('button', { name: /Ver todo o histórico/ })).toBeNull();
      unmount();
      localStorage.clear();
      mostrar(ficha(longos(6)));
      lista = await abrir();
      expect(within(lista).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'))).toHaveLength(5);
      expect(screen.getByRole('button', { name: 'Ver todo o histórico (6)' })).toBeInTheDocument();
    });

    it('com 9: os 5 mais novos; o botão mostra todos, vira "Mostrar só os mais novos" e fica com o foco; clicar de novo volta aos 5', async () => {
      mostrar(ficha(longos(9)));
      const lista = await abrir();
      expect(within(lista).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'))).toHaveLength(5);
      await userEvent.click(screen.getByRole('button', { name: 'Ver todo o histórico (9)' }));
      expect(within(lista).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'))).toHaveLength(9);
      const voltar = screen.getByRole('button', { name: 'Mostrar só os mais novos' });
      expect(voltar).toHaveFocus();
      await userEvent.click(voltar);
      expect(within(lista).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'))).toHaveLength(5);
      expect(screen.getByRole('button', { name: 'Ver todo o histórico (9)' })).toHaveFocus();
    });

    it('os vãos contam entre os itens do corte (eventos e vãos juntos)', async () => {
      // 5 períodos com um vão entre os dois mais velhos: 6 itens, e o vão é o 5º... de baixo para cima
      const ps = [periodo(1, '2020-01-01', '2020-12-31'), periodo(2, '2021-03-01', '2021-12-31'), periodo(3, '2022-01-01', '2022-12-31'), periodo(4, '2023-01-01', '2023-12-31'), periodo(5, '2024-01-01', null)];
      mostrar(ficha(ps));
      const lista = await abrir();
      expect(within(lista).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'))).toHaveLength(5);
      expect(screen.getByRole('button', { name: 'Ver todo o histórico (6)' })).toBeInTheDocument();
    });

    it('Review Focus 4: o item mostrado antes de um vão escondido pelo corte não ganha o trilho "até o vão"', async () => {
      // novos → velhos: p7 p6 p5 p4 p3 | vão | p2 p1 (o vão é o 6º item, escondido)
      const ps = [periodo(1, '2018-01-01', '2018-12-31'), periodo(2, '2019-01-01', '2019-12-31'), periodo(3, '2020-06-01', '2020-12-31'), periodo(4, '2021-01-01', '2021-12-31'), periodo(5, '2022-01-01', '2022-12-31'), periodo(6, '2023-01-01', '2023-12-31'), periodo(7, '2024-01-01', null)];
      // sem vão no meio: o vão fica entre p2 e p3 (2020-01-01 a 2020-05-31)
      mostrar(ficha(ps));
      const lista = await abrir();
      const visiveis = within(lista).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'));
      expect(visiveis).toHaveLength(5);
      expect(visiveis.at(-1)!.getAttribute('data-trilho')).not.toBe('ate-o-vao');
      expect(screen.getByRole('button', { name: 'Ver todo o histórico (8)' })).toBeInTheDocument();
    });

    it('Review Focus 5: a ficha de outro militar começa recolhida nos 5, mesmo que a anterior tenha ficado expandida', async () => {
      const { rerender } = render(<Rastreio key="m1" ficha={ficha(longos(9))} unidadeId="u-1sb" />);
      const lista = await abrir();
      await userEvent.click(screen.getByRole('button', { name: 'Ver todo o histórico (9)' }));
      expect(within(lista).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'))).toHaveLength(9);
      rerender(<Rastreio key="m2" ficha={ficha(longos(9))} unidadeId="u-1sb" />);
      const nova = screen.getByRole('list', { name: 'Mudanças, da mais nova para a mais antiga' });
      expect(within(nova).getAllByRole('listitem').filter((i) => i.getAttribute('data-tipo'))).toHaveLength(5);
    });
  });

  it('sem nenhum período: a orientação para lançar a primeira lotação', async () => {
    mostrar(ficha([]));
    await userEvent.click(screen.getByRole('button', { name: /Histórico de rastreio/ }));
    expect(screen.getByText('Para lançar a primeira lotação, use "Alterar situação".')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /Mudanças/ })).toBeNull();
  });
});

describe('Alterar situação', () => {
  it('só aparece para quem pode (podeEditar.peculio), com a seção aberta', async () => {
    const { unmount } = mostrar(ficha(COMUM, false));
    await abrir();
    expect(screen.queryByRole('button', { name: 'Alterar situação' })).toBeNull();
    unmount();
    localStorage.clear();
    mostrar(ficha(COMUM, true));
    await abrir();
    expect(screen.getByRole('button', { name: 'Alterar situação' })).toBeInTheDocument();
  });
});
