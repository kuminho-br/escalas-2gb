import type { FaixaDeDisponibilidade, MilitarDoVoluntariado, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { mesPorExtenso, somarMeses } from 'contratos';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { diasDoMes } from 'dominio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MENSAGEM_PENDENTE } from '@/componentes/AlteracoesPendentes';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi, trava } from './apoio';

// Cenário fictício: 5 militares, 2 já lançados; o mês de lançamento é o mês seguinte ao atual.
const MES = somarMeses(mesAtual(), 1);
const militar = (id: string, nomeGuerra: string, extra: Partial<MilitarDoVoluntariado> = {}): MilitarDoVoluntariado => ({
  militarId: id, posto: 'SD BM', nomeGuerra, matricula: `99002${id.slice(1)}-1`, equipe: 'Alfa', jornada: 'pronto', voluntarioJes: true, lancado: false, horas: 0, dias: 0, ...extra,
});
const LISTA: VoluntariadoDoMes = {
  mes: MES,
  militares: [
    militar('m3', 'ANDRADE', { voluntarioJes: false }),
    militar('m1', 'CABRAL', { lancado: true, horas: 48, dias: 9 }),
    militar('m4', 'DANTAS'),
    militar('m2', 'ESTEVES', { lancado: true, horas: 16, dias: 4 }),
    militar('m5', 'FALCAO'),
  ],
};
const DEPOIS_DO_ANDRADE: VoluntariadoDoMes = { ...LISTA, militares: LISTA.militares.map((m) => (m.militarId === 'm3' ? { ...m, lancado: true, horas: 12, dias: 1 } : m)) };
// os blocos do dia da 1ª SB de hoje: 00–08, 08–16, 16–20 e 20–24 (cortes de PE Seguro, Bioma e CPRH)
const BLOCOS = [{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '20:00' }, { inicio: '20:00', fim: '24:00' }];
const doMilitar = (id: string, extra: Partial<VoluntariadoDoMilitar> = {}): VoluntariadoDoMilitar => ({ militarId: id, mes: MES, faixas: [], doMesAnterior: [], blocos: BLOCOS, folgas: null, ...extra });
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const faixa = (data: string, inicio: string, fim: string): FaixaDeDisponibilidade => ({ data, inicio, fim });

function api(extra: Parameters<typeof simularApi>[0] = {}, lista: VoluntariadoDoMes = LISTA) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [`GET /api/unidades/u-1sb/voluntariado/${MES}`]: { status: 200, corpo: lista },
    [`GET /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m3') },
    [`GET /api/militares/m4/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m4') },
    [`GET /api/militares/m1/voluntariado/${MES}`]: { status: 200, corpo: doMilitar('m1', { faixas: [faixa(dia(5), '08:00', '20:00')] }) },
    ...extra,
  });
}
const calendario = () => screen.getByRole('group', { name: 'Calendário do voluntariado' });
// o bloco de um dia: o nome acessível diz o dia e o horário ("Dia 5, 08h às 16h")
const bloco = (n: number, de: string, ate: string) => within(calendario()).getByRole('button', { name: `Dia ${n}, ${de} às ${ate}` });
const salvar = () => screen.getByRole('button', { name: 'Salvar e ir para o próximo' });
const doMilitarComo = (id: string, extra: Partial<VoluntariadoDoMilitar>) => ({ [`GET /api/militares/${id}/voluntariado/${MES}`]: { status: 200, corpo: doMilitar(id, extra) } });

describe('voluntariado: lista e cabeçalho', () => {
  it('o trilho leva a "Voluntariado", que abre no mês seguinte', async () => {
    const f = api();
    const router = abrir('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Voluntariado' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/voluntariado'));
    expect(await screen.findByRole('heading', { name: 'Voluntariado' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mês')).toHaveValue(MES);
    await waitFor(() => expect(chamadasA(f, `GET /api/unidades/u-1sb/voluntariado/${MES}`)).toBe(1));
  });

  it('a lista separa "Já lançados" (com os dias) de "Faltam lançar", e o primeiro que falta já vem aberto', async () => {
    api();
    abrir('/voluntariado');
    const lancados = await screen.findByRole('region', { name: 'Já lançados' });
    expect(within(lancados).getByText('CABRAL').closest('li')).toHaveTextContent('9 dias');
    expect(within(lancados).getByText('ESTEVES').closest('li')).toHaveTextContent('4 dias');
    const faltam = screen.getByRole('region', { name: 'Faltam lançar' });
    expect(within(faltam).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('ANDRADE'), expect.stringContaining('DANTAS'), expect.stringContaining('FALCAO')]);
    expect(within(faltam).getByText('ANDRADE').closest('li')).toHaveTextContent('lançando');
    expect(await screen.findByRole('heading', { name: 'SD BM ANDRADE' })).toBeInTheDocument();
  });

  it('o cabeçalho diz a equipe e avisa de quem não é voluntário JES (a legenda A/B saiu: os blocos mostram o horário)', async () => {
    api();
    abrir('/voluntariado');
    expect(await screen.findByText(/Equipe Alfa\./)).toHaveTextContent('Não é voluntário JES: os horários valem só para diárias.');
    expect(screen.queryByText('A 08h às 20h')).toBeNull();
    expect(screen.queryByText('B 20h às 08h')).toBeNull();
  });

  it('a busca filtra a lista por nome ou matrícula', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('region', { name: 'Faltam lançar' });
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), 'dant');
    const faltam = screen.getByRole('region', { name: 'Faltam lançar' });
    expect(within(faltam).queryByText('ANDRADE')).toBeNull();
    expect(within(faltam).getByText('DANTAS')).toBeInTheDocument();
  });
});

describe('voluntariado: calendário e salvar', () => {
  it('"Salvar e ir para o próximo" manda o mês do militar e abre o próximo que falta lançar', async () => {
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
    const router = abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '08:00', '16:00')] }));
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    expect((router.state.location.search as { militar?: string }).militar).toBe('m4');
    const lancados = screen.getByRole('region', { name: 'Já lançados' });
    expect(within(lancados).getByText('ANDRADE').closest('li')).toHaveTextContent('1 dia');
  });

  it('sem militares na seção no mês, a tela diz isso', async () => {
    api({}, { mes: MES, militares: [] });
    abrir('/voluntariado');
    expect(await screen.findByText('Nenhum militar lotado na seção neste mês.')).toBeInTheDocument();
  });
});

describe('voluntariado: blocos por horário (computador)', () => {
  it('o número do dia tem cara de botão: borda, fundo branco, cantos e sombra de tecla, com a dica "Marcar o dia inteiro"', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const tecla = within(calendario()).getByRole('button', { name: /^Dia 5: / });
    expect(tecla).toHaveClass('border', 'bg-superficie', 'rounded-md', 'shadow-[0_1px_0_var(--color-input)]');
    expect(tecla).toHaveAttribute('title', 'Marcar o dia inteiro');
  });

  it('a tecla é igual em qualquer estado: marcar o dia só troca a dica, e a aparência não muda', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const dia5 = () => within(calendario()).getByRole('button', { name: /^Dia 5: / });
    const antes = dia5().className;
    await userEvent.click(dia5());
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
    expect(dia5().className).toBe(antes);
    expect(dia5()).toHaveAttribute('title', 'Desmarcar o dia inteiro');
    expect(dia5().className).toBe(within(calendario()).getByRole('button', { name: /^Dia 6: / }).className);
  });

  it('o botão do número do dia não estica na largura da célula: o destaque do mouse cobre só o número (a "barra cinza" do dia 24)', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(within(calendario()).getByRole('button', { name: /^Dia 24: / })).toHaveClass('justify-self-start');
  });

  it('cada dia mostra os blocos do dia com o horário no nome: 00h às 08h, 08h às 16h, 16h às 20h e 20h às 24h', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(bloco(5, '00h', '08h')).toBeInTheDocument();
    expect(bloco(5, '08h', '16h')).toBeInTheDocument();
    expect(bloco(5, '16h', '20h')).toBeInTheDocument();
    expect(bloco(5, '20h', '24h')).toBeInTheDocument();
  });

  it('no computador, a régua do topo saiu e o guia "Como marcar" mostra os blocos com os horários', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(document.querySelector('[data-rotulos-dos-cortes]')).toBeNull();
    const guia = screen.getByRole('region', { name: 'Como marcar' });
    const horas = [...guia.querySelectorAll('[data-hora-do-guia]')].map((e) => e.textContent);
    expect(horas).toEqual(['00h', '08h', '16h', '20h', '00h']);
    expect(within(guia).getByText('Clicar no número marca o dia inteiro.')).toBeInTheDocument();
    expect(within(guia).getByText('Clicar num bloco marca só esse horário.')).toBeInTheDocument();
    expect(within(guia).getByText(/Arraste com o mouse/)).toBeInTheDocument();
  });

  it('"Entendi" fecha o guia, o navegador lembra, e "Como marcar" abre de novo', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('region', { name: 'Como marcar' })).not.toBeInTheDocument();
    cleanup();
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(screen.queryByRole('region', { name: 'Como marcar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Como marcar' }));
    expect(screen.getByRole('region', { name: 'Como marcar' })).toBeInTheDocument();
  });

  it('sem armazenamento (modo privado), o guia aparece e "Entendi" fecha na sessão sem quebrar a tela (Review Focus 1)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sem armazenamento');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sem armazenamento');
    });
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(screen.getByRole('region', { name: 'Como marcar' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('region', { name: 'Como marcar' })).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('sem armazenamento, depois do "Entendi" o guia não volta ao passar para o próximo militar (achado da revisão final)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sem armazenamento');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sem armazenamento');
    });
    try {
      api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
      abrir('/voluntariado');
      await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
      await userEvent.click(screen.getByRole('button', { name: 'Entendi' }));
      await userEvent.click(salvar());
      await screen.findByRole('heading', { name: 'SD BM DANTAS' });
      expect(screen.queryByRole('region', { name: 'Como marcar' })).not.toBeInTheDocument();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('o guia acompanha os blocos do gestor: três blocos ou um bloco só (Review Focus 2)', async () => {
    const tres = [{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '24:00' }];
    api(doMilitarComo('m3', { blocos: tres }));
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const horasDe = () => [...screen.getByRole('region', { name: 'Como marcar' }).querySelectorAll('[data-hora-do-guia]')].map((e) => e.textContent);
    expect(horasDe()).toEqual(['00h', '08h', '16h', '00h']);
    cleanup();
    api(doMilitarComo('m3', { blocos: [{ inicio: '00:00', fim: '24:00' }] }));
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(horasDe()).toEqual(['00h', '00h']);
  });

  it('o desenho do guia não é clicável: não entra no calendário nem muda o rodapé', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const guia = screen.getByRole('region', { name: 'Como marcar' });
    expect(within(calendario()).queryByRole('region', { name: 'Como marcar' })).not.toBeInTheDocument();
    const desenho = guia.querySelector('[data-desenho-do-guia]') as HTMLElement;
    expect(desenho).toHaveAttribute('aria-hidden', 'true');
    expect(within(desenho).queryAllByRole('button')).toHaveLength(0);
    fireEvent.click(desenho.querySelector('span') as HTMLElement);
    expect(screen.getByText('Nenhum horário marcado.')).toBeInTheDocument();
  });

  it('clicar num bloco marca só ele; o rodapé conta as horas e os dias', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(screen.getByText('Nenhum horário marcado.')).toBeInTheDocument();
    await userEvent.click(bloco(5, '08h', '16h'));
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
    expect(bloco(5, '16h', '20h')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('8 horas em 1 dia.')).toBeInTheDocument();
  });

  it('dois blocos encostados (08–16 e 16–20) viram "12 horas" e são enviados como uma faixa só', async () => {
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(bloco(5, '16h', '20h'));
    expect(screen.getByText('12 horas em 1 dia.')).toBeInTheDocument();
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '08:00', '20:00')] }));
  });

  it('um bloco coberto só em parte aparece como parcial; clicar nele marca o bloco inteiro (Review Focus 4)', async () => {
    api(doMilitarComo('m3', { faixas: [faixa(dia(9), '08:00', '10:00')] }));
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(bloco(9, '08h', '16h')).toHaveAttribute('aria-pressed', 'mixed');
    await userEvent.click(bloco(9, '08h', '16h'));
    expect(bloco(9, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar no número do dia marca o dia inteiro (os quatro blocos); de novo, tira todos', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(within(calendario()).getByRole('button', { name: 'Dia 7: marcar o dia inteiro' }));
    for (const b of [{ de: '00h', ate: '08h' }, { de: '08h', ate: '16h' }, { de: '16h', ate: '20h' }, { de: '20h', ate: '24h' }]) expect(bloco(7, b.de, b.ate)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('24 horas em 1 dia.')).toBeInTheDocument();
    await userEvent.click(within(calendario()).getByRole('button', { name: 'Dia 7: desmarcar o dia inteiro' }));
    expect(screen.getByText('Nenhum horário marcado.')).toBeInTheDocument();
  });

  it('o horário do bloco fica visível ao passar o mouse (não só no título)', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const b = bloco(5, '16h', '20h');
    expect(within(b).getByRole('tooltip')).toHaveTextContent('16h às 20h');
  });

  it('a dica de horário não é cortada pela faixa do dia (nenhum ancestral até o calendário tem overflow-hidden)', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const dica = within(bloco(5, '16h', '20h')).getByRole('tooltip');
    const cortados: string[] = [];
    for (let el = dica.parentElement; el && el !== calendario(); el = el.parentElement) {
      if (el.classList.contains('overflow-hidden')) cortados.push(el.outerHTML.slice(0, 80));
    }
    expect(cortados).toEqual([]);
  });

  it('bloco vazio é sempre branco, também à noite e no fim de semana (a cor "bg-noite" nunca existiu no tema)', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const sabado = diasDoMes(MES).find((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 6)!;
    const util = diasDoMes(MES).find((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 2)!;
    for (const d of [sabado, util]) {
      for (const [de, ate] of [['00h', '08h'], ['08h', '16h'], ['16h', '20h'], ['20h', '24h']]) {
        const b = bloco(Number(d.slice(8)), de!, ate!);
        if (b.getAttribute('aria-pressed') === 'false') expect(b).toHaveClass('bg-superficie');
      }
    }
    expect(calendario().querySelector('[data-noturno]')).toBeNull();
    expect(calendario().querySelector('.bg-noite')).toBeNull();
  });

  it('o militar já lançado com horários mostra o que tem marcado nos blocos', async () => {
    api(doMilitarComo('m1', { faixas: [faixa(dia(5), '08:00', '20:00')] }));
    abrir('/voluntariado?militar=m1');
    await screen.findByRole('heading', { name: 'SD BM CABRAL' });
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
    expect(bloco(5, '16h', '20h')).toHaveAttribute('aria-pressed', 'true');
    expect(bloco(5, '20h', '24h')).toHaveAttribute('aria-pressed', 'false');
  });
});

// celular: a largura da tela passa a ser de celular (matchMedia simulado; sem ele, a tela é de computador)
// o jsdom não tem matchMedia: cada teste termina devolvendo o que havia, para um teste de celular não vazar para o seguinte
const matchMediaOriginal = window.matchMedia;
afterEach(() => {
  window.matchMedia = matchMediaOriginal;
  try {
    window.localStorage.clear();
  } catch {
    /* sem armazenamento */
  }
});

function emCelular(ligado: boolean) {
  window.matchMedia = ((consulta: string) => ({
    matches: ligado && consulta === '(max-width: 767px)',
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('voluntariado: celular', () => {
  it('no celular, a tela mostra um dia por linha e a faixa de rótulos só com os cortes (00h, 08h, 16h, 20h, 00h)', async () => {
    emCelular(true);
    api();
    // no celular a lista vem primeiro (modo foco): o militar é aberto pela URL, como acontece ao tocar no nome
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(calendario()).toHaveAttribute('data-disposicao', 'linhas');
    const rotulos = within(document.querySelector('[data-rotulos-dos-cortes]') as HTMLElement).getAllByText(/^\d\dh$/).map((e) => e.textContent);
    expect(rotulos).toEqual(['00h', '08h', '16h', '20h', '00h']);
    // as pontas ficam na borda da faixa; os do meio, centrados no corte (achado M2 da revisão da 2.2)
    const spans = [...(document.querySelector('[data-rotulos-dos-cortes]') as HTMLElement).querySelectorAll('span')];
    expect(spans[0]).toHaveStyle({ left: '0%' });
    expect(spans[0]).not.toHaveClass('-translate-x-1/2');
    expect(spans.at(-1)).toHaveStyle({ right: '0px' });
    expect(spans.at(-1)).not.toHaveClass('-translate-x-1/2');
    expect(spans[1]).toHaveClass('-translate-x-1/2');
  });

  it('no celular, a régua fica e o guia fala de toque, com a barra de salvar fixa (Review Focus 5)', async () => {
    emCelular(true);
    api();
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(document.querySelector('[data-rotulos-dos-cortes]')).not.toBeNull();
    const guia = screen.getByRole('region', { name: 'Como marcar' });
    expect(within(guia).getByText('Tocar no número marca o dia inteiro.')).toBeInTheDocument();
    expect(within(guia).getByText('Deslizar o dedo rola a página e não marca nada.')).toBeInTheDocument();
    expect(document.querySelector('[data-barra-de-salvar]')).not.toBeNull();
    await userEvent.click(within(guia).getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('region', { name: 'Como marcar' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-rotulos-dos-cortes]')).not.toBeNull();
  });

  it('no celular, a faixa de rótulos fica parada na rolagem e tem as mesmas colunas e bordas das linhas dos dias (rótulos sobre os cortes)', async () => {
    emCelular(true);
    api();
    // no celular a lista vem primeiro (modo foco): o militar é aberto pela URL, como acontece ao tocar no nome
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const rotulos = document.querySelector('[data-rotulos-dos-cortes]') as HTMLElement;
    const linhaDeRotulos = rotulos.parentElement as HTMLElement;
    expect(linhaDeRotulos.parentElement).toHaveClass('sticky', 'top-0');
    expect(linhaDeRotulos).toHaveClass('grid-cols-[3.5rem_1fr]', 'border', 'p-1.5');
    expect(rotulos).toHaveClass('border');
    const linhaDoDia = bloco(5, '08h', '16h').closest('[data-linha-do-dia]') as HTMLElement;
    expect(linhaDoDia).toHaveClass('grid-cols-[3.5rem_1fr]', 'border', 'p-1.5');
    expect((bloco(5, '08h', '16h').parentElement as HTMLElement)).toHaveClass('border');
  });

  it('no celular, a tecla do número do dia tem o tamanho do dedo (40px)', async () => {
    emCelular(true);
    api();
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(within(calendario()).getByRole('button', { name: /^Dia 5: / })).toHaveClass('h-10');
  });

  it('no celular, cada dia é uma linha: o número e o dia da semana à esquerda, os blocos à direita', async () => {
    emCelular(true);
    api();
    // no celular a lista vem primeiro (modo foco): o militar é aberto pela URL, como acontece ao tocar no nome
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const linha = bloco(5, '08h', '16h').closest('[data-linha-do-dia]') as HTMLElement;
    expect(linha).not.toBeNull();
    expect(linha).toHaveAttribute('data-linha-do-dia', dia(5));
    // o número do dia e o dia da semana ficam na linha, antes dos blocos
    expect(within(linha).getByRole('button', { name: /^Dia 5:/ })).toBeInTheDocument();
    // o dia da semana é o do dia 5 do mês do cenário (não de hoje)
    const semana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${dia(5)}T00:00:00Z`).getUTCDay()];
    expect(linha.querySelector('[data-diasemana]')).toHaveTextContent(semana!);
  });

  it('no celular, o toque que vira rolagem não marca nada: nem bloco, nem dia (o clique do toque é que marca)', async () => {
    emCelular(true);
    api();
    // no celular a lista vem primeiro (modo foco): o militar é aberto pela URL, como acontece ao tocar no nome
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const b = bloco(5, '08h', '16h');
    // o dedo encosta no bloco e desliza: o navegador cancela o toque e não há clique
    fireEvent.pointerDown(b, { pointerType: 'touch', pointerId: 1, button: 0 });
    fireEvent.pointerCancel(b, { pointerType: 'touch', pointerId: 1 });
    expect(b).toHaveAttribute('aria-pressed', 'false');
    // o dia também: encostar no número e rolar não marca o dia inteiro
    fireEvent.pointerDown(within(calendario()).getByRole('button', { name: /^Dia 5:/ }), { pointerType: 'touch', pointerId: 2, button: 0 });
    fireEvent.pointerCancel(window, { pointerType: 'touch', pointerId: 2 });
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'false');
  });

  it('no celular, um toque sem rolagem (pointerdown seguido de clique) marca o bloco tocado', async () => {
    emCelular(true);
    api();
    // no celular a lista vem primeiro (modo foco): o militar é aberto pela URL, como acontece ao tocar no nome
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const b = bloco(5, '08h', '16h');
    fireEvent.pointerDown(b, { pointerType: 'touch', pointerId: 1, button: 0 });
    fireEvent.pointerUp(b, { pointerType: 'touch', pointerId: 1 });
    fireEvent.click(b, { detail: 1 });
    expect(b).toHaveAttribute('aria-pressed', 'true');
    expect(bloco(5, '16h', '20h')).toHaveAttribute('aria-pressed', 'false');
  });

  it('no computador, arrastar por cima de outro bloco marca os dois (o contraste com o celular)', async () => {
    emCelular(false);
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    fireEvent.pointerDown(bloco(5, '08h', '16h'), { pointerType: 'mouse', pointerId: 1, button: 0 });
    fireEvent.pointerEnter(bloco(5, '16h', '20h'), { pointerType: 'mouse', pointerId: 1 });
    fireEvent.pointerUp(window, { pointerType: 'mouse', pointerId: 1 });
    expect(bloco(5, '16h', '20h')).toHaveAttribute('aria-pressed', 'true');
  });

  it('no computador, a disposição é o calendário (sem a faixa de rótulos de celular)', async () => {
    emCelular(false);
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(calendario()).toHaveAttribute('data-disposicao', 'calendario');
  });
});

describe('voluntariado: modo foco no celular', () => {
  afterEach(() => emCelular(false));
  const DEPOIS_DO_DANTAS: VoluntariadoDoMes = { ...LISTA, militares: LISTA.militares.map((m) => (m.militarId === 'm4' ? { ...m, lancado: true, horas: 8, dias: 1 } : m)) };
  const listaDeFaltam = () => screen.findByRole('region', { name: 'Faltam lançar' });

  it('ao abrir, só a lista aparece: nenhum militar abre sozinho e não há calendário', async () => {
    emCelular(true);
    api();
    abrir('/voluntariado');
    await listaDeFaltam();
    expect(screen.getByRole('region', { name: 'Já lançados' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Calendário do voluntariado' })).not.toBeInTheDocument();
  });

  it('tocar num nome mostra só o calendário dele, com "‹ Militares" e sem a lista, e a página vai ao topo', async () => {
    emCelular(true);
    const topo = vi.fn();
    window.scrollTo = topo as unknown as typeof window.scrollTo;
    api();
    abrir('/voluntariado');
    await userEvent.click(await screen.findByRole('link', { name: /DANTAS/ }));
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    expect(calendario()).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Faltam lançar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Já lançados' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ Militares' })).toBeInTheDocument();
    expect(topo).toHaveBeenCalled();
  });

  it('o botão é "Salvar": grava e volta à lista, com o militar já lançado (no computador seria "Salvar e ir para o próximo")', async () => {
    emCelular(true);
    const f = api({ [`PUT /api/militares/m4/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_DANTAS } });
    abrir(`/voluntariado?militar=m4`);
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    expect(screen.queryByRole('button', { name: 'Salvar e ir para o próximo' })).not.toBeInTheDocument();
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m4/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(5), '08:00', '16:00')] }));
    const lancados = await screen.findByRole('region', { name: 'Já lançados' });
    expect(within(lancados).getByText('DANTAS').closest('li')).toHaveTextContent('1 dia');
    expect(screen.queryByRole('group', { name: 'Calendário do voluntariado' })).not.toBeInTheDocument();
  });

  it('a barra de baixo fica fixa e traz o resumo e o Salvar', async () => {
    emCelular(true);
    api();
    abrir('/voluntariado?militar=m4');
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    await userEvent.click(bloco(5, '08h', '16h'));
    const barra = screen.getByRole('button', { name: 'Salvar' }).closest('[data-barra-de-salvar]') as HTMLElement;
    expect(barra).not.toBeNull();
    expect(barra).toHaveClass('sticky', 'bottom-0');
    expect(barra).toHaveTextContent('8 horas em 1 dia.');
  });

  it('com marcação pendente, "‹ Militares" pergunta antes de descartar; negar mantém o calendário e confirmar volta à lista (Review Focus 5)', async () => {
    emCelular(true);
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api();
    abrir('/voluntariado?militar=m4');
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(screen.getByRole('link', { name: '‹ Militares' }));
    await waitFor(() => expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE));
    expect(calendario()).toBeInTheDocument();
    confirmar.mockReturnValue(true);
    await userEvent.click(screen.getByRole('link', { name: '‹ Militares' }));
    await listaDeFaltam();
    expect(screen.queryByRole('group', { name: 'Calendário do voluntariado' })).not.toBeInTheDocument();
    confirmar.mockRestore();
  });

  it('no computador nada muda: lista e painel lado a lado, o primeiro que falta abre sozinho e o botão é "Salvar e ir para o próximo"', async () => {
    emCelular(false);
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(screen.getByRole('region', { name: 'Faltam lançar' })).toBeInTheDocument();
    expect(salvar()).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '‹ Militares' })).not.toBeInTheDocument();
  });
});

describe('voluntariado: matchMedia antigo (achado M5 da revisão da 2.2)', () => {
  it('um matchMedia só com addListener (Safari antigo) não derruba a tela e é ouvido', async () => {
    const addListener = vi.fn();
    window.matchMedia = ((consulta: string) => ({ matches: consulta === '(max-width: 767px)', media: consulta, onchange: null, addListener, removeListener: () => {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    api();
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(addListener).toHaveBeenCalled();
  });
});

// Os comportamentos da entrega 2 que seguem valendo com os blocos (a revisão final da 2.2 apontou que saíram na reescrita da tela).
describe('voluntariado: comportamentos da entrega 2 sobre os blocos', () => {
  const numero = (n: number) => within(calendario()).getByRole('button', { name: new RegExp(`^Dia ${n}: `) });
  const mouse = { pointerType: 'mouse', pointerId: 1, button: 0 } as const;
  const anterior = somarMeses(MES, -1);
  const todosOsBlocos = (n: number) => [['00h', '08h'], ['08h', '16h'], ['16h', '20h'], ['20h', '24h']].map(([de, ate]) => bloco(n, de!, ate!));
  const abrirAndrade = async (rota = '/voluntariado') => {
    abrir(rota);
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
  };

  it('"Limpar" zera o que está marcado', async () => {
    api();
    await abrirAndrade();
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('Nenhum horário marcado.')).toBeInTheDocument();
  });

  it('salvar sem nenhum horário também lança (lista vazia)', async () => {
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
    await abrirAndrade();
    await userEvent.click(salvar());
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [] }));
  });

  it('dois cliques em Salvar mandam um pedido só', async () => {
    const { espera, soltar } = trava();
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE, espera } });
    await abrirAndrade();
    const botao = salvar();
    fireEvent.click(botao);
    fireEvent.click(botao);
    soltar();
    await waitFor(() => expect(chamadasA(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toBe(1));
  });

  it('o erro da API aparece e as marcações ficam', async () => {
    api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 409, corpo: { erro: 'Este militar não está lotado na seção.' } } });
    await abrirAndrade();
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(salvar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Este militar não está lotado na seção.');
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
  });

  it('quando não sobra ninguém para lançar, a tela diz isso e fica no militar', async () => {
    const todos: VoluntariadoDoMes = { ...LISTA, militares: LISTA.militares.map((m) => ({ ...m, lancado: true })) };
    api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: todos } }, { ...LISTA, militares: LISTA.militares.map((m) => (m.militarId === 'm3' ? m : { ...m, lancado: true })) });
    await abrirAndrade('/voluntariado?militar=m3');
    await userEvent.click(salvar());
    expect(await screen.findByText('Todos os militares deste mês foram lançados.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SD BM ANDRADE' })).toBeInTheDocument();
  });

  it('trocar de militar com marcação não salva pergunta antes; cancelando, fica no mesmo (Review Focus 5)', async () => {
    api();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const router = abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(within(screen.getByRole('region', { name: 'Faltam lançar' })).getByRole('link', { name: /DANTAS/ }));
    expect(confirmar).toHaveBeenCalledWith(MENSAGEM_PENDENTE);
    expect(screen.getByRole('heading', { name: 'SD BM ANDRADE' })).toBeInTheDocument();
    expect((router.state.location.search as { militar?: string }).militar).not.toBe('m4');
    confirmar.mockReturnValue(true);
    await userEvent.click(within(screen.getByRole('region', { name: 'Faltam lançar' })).getByRole('link', { name: /DANTAS/ }));
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    confirmar.mockRestore();
  });

  it('"Todos os sábados e domingos" marca os blocos dos fins de semana, somando ao que já está marcado', async () => {
    api();
    await abrirAndrade();
    await userEvent.click(bloco(3, '08h', '16h'));
    await userEvent.click(screen.getByRole('button', { name: 'Todos os sábados e domingos' }));
    const fds = diasDoMes(MES).filter((d) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()));
    const tresEhFds = fds.includes(dia(3));
    const horas = fds.length * 24 + (tresEhFds ? 0 : 8);
    expect(screen.getByText(`${horas} horas em ${fds.length + (tresEhFds ? 0 : 1)} dias.`)).toBeInTheDocument();
    expect(bloco(3, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
    for (const d of fds) for (const b of todosOsBlocos(Number(d.slice(8)))) expect(b).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Dias de folga da equipe Alfa" marca o dia inteiro das folgas; sem folgas conhecidas (null), o atalho não aparece', async () => {
    api(doMilitarComo('m3', { folgas: [dia(2), dia(3)] }));
    await abrirAndrade();
    await userEvent.click(await screen.findByRole('button', { name: 'Dias de folga da equipe Alfa' }));
    for (const n of [2, 3]) for (const b of todosOsBlocos(n)) expect(b).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('48 horas em 2 dias.')).toBeInTheDocument();
  });

  it('sem folgas conhecidas, não há atalho de folgas', async () => {
    api();
    abrir('/voluntariado?militar=m4');
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    expect(screen.queryByRole('button', { name: /Dias de folga/ })).toBeNull();
  });

  it('"Copiar de <mês anterior>" substitui o que está marcado pelo mês anterior, dia por dia', async () => {
    api(doMilitarComo('m3', { doMesAnterior: [faixa(`${anterior}-10`, '08:00', '16:00'), faixa(`${anterior}-12`, '20:00', '24:00')] }));
    await abrirAndrade();
    await userEvent.click(bloco(5, '08h', '16h'));
    await userEvent.click(await screen.findByRole('button', { name: `Copiar de ${mesPorExtenso(anterior)}` }));
    expect(bloco(5, '08h', '16h')).toHaveAttribute('aria-pressed', 'false');
    expect(bloco(10, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
    expect(bloco(12, '20h', '24h')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('12 horas em 2 dias.')).toBeInTheDocument();
  });

  it('sem marcações no mês anterior, "Copiar de …" fica desabilitado', async () => {
    api();
    await abrirAndrade();
    expect(await screen.findByRole('button', { name: `Copiar de ${mesPorExtenso(anterior)}` })).toBeDisabled();
  });

  it('arrastar do dia 3 ao dia 5 com o mouse aplica a mesma ação aos três dias; depois de soltar, passar por cima não marca', async () => {
    api();
    await abrirAndrade();
    const [d3, d4, d5, d6] = [3, 4, 5, 6].map(numero);
    fireEvent.pointerDown(d3!, mouse);
    fireEvent.pointerEnter(d4!, mouse);
    fireEvent.pointerEnter(d5!, mouse);
    fireEvent.pointerUp(d5!, mouse);
    fireEvent.pointerEnter(d6!, mouse);
    for (const n of [3, 4, 5]) for (const b of todosOsBlocos(n)) expect(b).toHaveAttribute('aria-pressed', 'true');
    expect(bloco(6, '08h', '16h')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('72 horas em 3 dias.')).toBeInTheDocument();
  });

  it('o clique simples no número alterna uma vez só (o arrastar não duplica)', async () => {
    api();
    await abrirAndrade();
    await userEvent.click(numero(9));
    expect(bloco(9, '08h', '16h')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('24 horas em 1 dia.')).toBeInTheDocument();
  });

  it('as setas andam pelos dias (esquerda e direita: um dia; cima e baixo: uma semana), sem sair do mês', async () => {
    api();
    await abrirAndrade();
    numero(5).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveAttribute('data-dia', dia(6));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveAttribute('data-dia', dia(13));
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}');
    expect(document.activeElement).toHaveAttribute('data-dia', dia(5));
    numero(1).focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(document.activeElement).toHaveAttribute('data-dia', dia(1));
  });

  it('espaço no número alterna o dia inteiro; Enter salva e passa ao próximo, sem alternar o dia', async () => {
    const f = api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
    await abrirAndrade();
    numero(12).focus();
    await userEvent.keyboard(' ');
    for (const b of todosOsBlocos(12)) expect(b).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(corpoEnviado(f, `PUT /api/militares/m3/voluntariado/${MES}`)).toEqual({ faixas: [faixa(dia(12), '00:00', '24:00')] }));
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
  });

  it('a dica de teclado está na tela', async () => {
    api();
    abrir('/voluntariado');
    expect(await screen.findByText('Atalhos de teclado: setas movem, espaço marca, Enter salva e passa ao próximo.')).toBeInTheDocument();
  });

  it('depois de salvar e ir para o próximo, o foco vai para o dia 1 do próximo militar (o teclado segue)', async () => {
    api({ [`PUT /api/militares/m3/voluntariado/${MES}`]: { status: 200, corpo: DEPOIS_DO_ANDRADE } });
    await abrirAndrade();
    numero(5).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-dia', dia(1)));
  });

  it('abrir sem ?militar= e lançar o último que falta: a tela fica nele, com o aviso (não pula para outro militar)', async () => {
    const soDantas: VoluntariadoDoMes = { ...LISTA, militares: LISTA.militares.map((m) => ({ ...m, lancado: m.militarId !== 'm4', horas: m.militarId === 'm4' ? 0 : 24, dias: m.militarId === 'm4' ? 0 : 2 })) };
    const todos: VoluntariadoDoMes = { ...soDantas, militares: soDantas.militares.map((m) => ({ ...m, lancado: true })) };
    api({ [`PUT /api/militares/m4/voluntariado/${MES}`]: { status: 200, corpo: todos } }, soDantas);
    const router = abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM DANTAS' });
    await waitFor(() => expect((router.state.location.search as { militar?: string }).militar).toBe('m4'));
    await userEvent.click(salvar());
    expect(await screen.findByText('Todos os militares deste mês foram lançados.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'SD BM DANTAS' })).toBeInTheDocument();
  });

  it('soltar o mouse logo depois de entrar no último dia não desmarca esse dia (a ação é lida na hora do evento)', async () => {
    api();
    await abrirAndrade();
    const [d3, d4] = [numero(3), numero(4)];
    fireEvent.pointerDown(d3, mouse);
    act(() => {
      fireEvent.pointerEnter(d4, mouse);
      fireEvent.pointerUp(window, mouse);
    });
    for (const b of todosOsBlocos(4)) expect(b).toHaveAttribute('aria-pressed', 'true');
  });

  it('arrastar para desmarcar sobre um bloco parcial tira o pedaço, em vez de marcar o bloco inteiro (M1)', async () => {
    // os serviços mudaram: o bloco das 16h às 24h agora é um só, e o dia 6 só tem 16h às 20h marcado (parcial)
    const blocosNovos = [{ inicio: '00:00', fim: '08:00' }, { inicio: '08:00', fim: '16:00' }, { inicio: '16:00', fim: '24:00' }];
    api(doMilitarComo('m3', { blocos: blocosNovos, faixas: [faixa(dia(5), '16:00', '24:00'), faixa(dia(6), '16:00', '20:00')] }));
    await abrirAndrade();
    expect(bloco(6, '16h', '24h')).toHaveAttribute('aria-pressed', 'mixed');
    fireEvent.pointerDown(bloco(5, '16h', '24h'), mouse); // cheio: a ação é "desmarcar"
    fireEvent.pointerEnter(bloco(6, '16h', '24h'), mouse);
    fireEvent.pointerUp(window, mouse);
    expect(bloco(5, '16h', '24h')).toHaveAttribute('aria-pressed', 'false');
    expect(bloco(6, '16h', '24h')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('voluntariado: campo de mês (ajuste)', () => {
  const atual = mesAtual();
  const rotaDoMes = (m: string) => `GET /api/unidades/u-1sb/voluntariado/${m}`;
  const noMesAtual = (extra: Parameters<typeof simularApi>[0] = {}) => api({ [rotaDoMes(atual)]: { status: 200, corpo: { mes: atual, militares: [] } }, ...extra });

  it('"Mês anterior" volta um mês e consulta o mês novo; "Próximo mês" avança', async () => {
    const f = noMesAtual();
    const router = abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await waitFor(() => expect((router.state.location.search as { mes?: string }).mes).toBe(atual));
    await waitFor(() => expect(chamadasA(f, rotaDoMes(atual))).toBe(1));
    expect(screen.getByLabelText('Mês')).toHaveValue(atual);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => expect((router.state.location.search as { mes?: string }).mes).toBe(MES));
  });

  it('em navegador que mostra o campo como texto, digitar um mês pela metade não volta ao padrão', async () => {
    noMesAtual();
    const router = abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    const campo = screen.getByLabelText('Mês');
    // como o Firefox de computador, que não tem o campo de mês e o mostra como texto (o React reaplica type="month" a cada renderização: trava a propriedade)
    campo.setAttribute('type', 'text');
    Object.defineProperty(campo, 'type', { get: () => 'text', set: () => {}, configurable: true });
    fireEvent.change(campo, { target: { value: `${atual.slice(0, 4)}-1` } });
    expect(campo).toHaveValue(`${atual.slice(0, 4)}-1`);
    fireEvent.change(campo, { target: { value: atual } });
    await waitFor(() => expect((router.state.location.search as { mes?: string }).mes).toBe(atual));
    expect(campo).toHaveValue(atual);
  });
});
