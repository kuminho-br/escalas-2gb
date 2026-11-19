import type { FaixaDeDisponibilidade, MilitarDoVoluntariado, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { mesPorExtenso, somarMeses } from 'contratos';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('cada dia mostra os blocos do dia com o horário no nome: 00h às 08h, 08h às 16h, 16h às 20h e 20h às 24h', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(bloco(5, '00h', '08h')).toBeInTheDocument();
    expect(bloco(5, '08h', '16h')).toBeInTheDocument();
    expect(bloco(5, '16h', '20h')).toBeInTheDocument();
    expect(bloco(5, '20h', '24h')).toBeInTheDocument();
  });

  it('a legenda do dia mostra os cortes dos serviços (00h, 08h, 16h, 20h e 24h)', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    for (const c of ['00h', '08h', '16h', '20h', '24h']) expect(screen.getAllByText(c).length).toBeGreaterThan(0);
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

  it('a faixa das 20h às 24h do dia 5 é noturna (sombreada); o dia 5 de dia (08–16) não é', async () => {
    api();
    abrir('/voluntariado');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(bloco(5, '20h', '24h')).toHaveAttribute('data-noturno');
    expect(bloco(5, '08h', '16h')).not.toHaveAttribute('data-noturno');
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
  it('no celular, a tela mostra um dia por linha e a faixa de rótulos só com os cortes (00h, 08h, 16h, 20h, 24h)', async () => {
    emCelular(true);
    api();
    // no celular a lista vem primeiro (modo foco): o militar é aberto pela URL, como acontece ao tocar no nome
    abrir('/voluntariado?militar=m3');
    await screen.findByRole('heading', { name: 'SD BM ANDRADE' });
    expect(calendario()).toHaveAttribute('data-disposicao', 'linhas');
    const rotulos = within(document.querySelector('[data-rotulos-dos-cortes]') as HTMLElement).getAllByText(/^\d\dh$/).map((e) => e.textContent);
    expect(rotulos).toEqual(['00h', '08h', '16h', '20h', '24h']);
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
