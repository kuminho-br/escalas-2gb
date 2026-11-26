import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Aviso, QuadroDeAvisos } from 'contratos';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// 6.56: o quadro de avisos na tela inicial (o painel dentro da cena, a janela de publicar e editar). Nomes e datas fictícios.
const ROTA = 'GET /api/avisos';
const aviso = (n: number, extra: Partial<Aviso> = {}): Aviso => ({
  id: `av-${n}`, unidadeId: 'u-1sb', unidadeSigla: '1ª SB', titulo: `Aviso ${n}`, texto: `Texto do aviso ${n}.`, fixado: false, valeAte: null, publicadoEm: '2026-11-24T15:00:00.000Z',
  autor: { patente: 'CAP', nomeGuerra: 'FOTO' }, podeAlterar: false, ...extra,
});
const quadro = (avisos: Aviso[], podePublicar = false): QuadroDeAvisos => ({ avisos, podePublicar });
const abrirComAvisos = async (q: QuadroDeAvisos, extra: Record<string, unknown> = {}) => {
  const fetchFalso = simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA]: { status: 200, corpo: q }, ...extra } as Parameters<typeof simularApi>[0]);
  abrir('/');
  const titulo = await screen.findByRole('heading', { level: 1 });
  return { fetchFalso, cena: titulo.closest<HTMLElement>('[data-faixa-boas-vindas]')! };
};
/** Uma data que ainda não passou, seja qual for o dia em que o teste roda (a janela recusa a que já passou). */
const FUTURA = `${new Date().getFullYear() + 1}-06-30`;
const painel = () => screen.findByRole('region', { name: 'Avisos' });

describe('o painel de avisos', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('mostra um aviso por vez, na ordem da API, com a linha do autor, a unidade e a marca "Fixado"', async () => {
    const { cena } = await abrirComAvisos(quadro([aviso(1, { fixado: true }), aviso(2), aviso(3)]));
    const p = await painel();
    // no computador, o painel mora na cena, no lugar que a 6.55 deixou à direita
    expect(cena.contains(p)).toBe(true);
    expect(cena.querySelector('[data-lugar-dos-avisos]')!.contains(p)).toBe(true);
    expect(within(p).getByRole('heading', { name: 'Avisos' })).toBeInTheDocument();
    expect(p).toHaveTextContent('1 de 3');
    expect(within(p).getByText('Aviso 1')).toBeInTheDocument();
    expect(within(p).getByText('Texto do aviso 1.')).toBeInTheDocument();
    expect(p).toHaveTextContent('CAP FOTO, 24/11, 1ª SB');
    expect(within(p).getByText('Fixado')).toBeInTheDocument();
    expect(within(p).queryByText('Aviso 2')).toBeNull();
  });

  it('as setas passam e dão a volta no último e no primeiro; os pontos mostram onde está e levam ao aviso', async () => {
    await abrirComAvisos(quadro([aviso(1), aviso(2), aviso(3)]));
    const p = await painel();
    await userEvent.click(within(p).getByRole('button', { name: 'Próximo aviso' }));
    expect(within(p).getByText('Aviso 2')).toBeInTheDocument();
    await userEvent.click(within(p).getByRole('button', { name: 'Próximo aviso' }));
    await userEvent.click(within(p).getByRole('button', { name: 'Próximo aviso' }));
    expect(within(p).getByText('Aviso 1')).toBeInTheDocument();
    await userEvent.click(within(p).getByRole('button', { name: 'Aviso anterior' }));
    expect(within(p).getByText('Aviso 3')).toBeInTheDocument();
    await userEvent.click(within(p).getByRole('button', { name: 'Ir ao aviso 2' }));
    expect(within(p).getByText('Aviso 2')).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Ir ao aviso 2' })).toHaveAttribute('aria-current', 'true');
  });

  it('com dez avisos, os pontos são dez e não passam da largura do painel; com um só, não há setas', async () => {
    await abrirComAvisos(quadro(Array.from({ length: 10 }, (_, i) => aviso(i + 1))));
    const p = await painel();
    const pontos = within(p).getAllByRole('button', { name: /^Ir ao aviso/ });
    expect(pontos).toHaveLength(10);
    expect(pontos[0]!.parentElement!.className).toMatch(/flex-wrap|overflow-hidden/);
    expect(p).toHaveTextContent('1 de 10');
  });

  it('com um aviso só, sem setas nem pontos', async () => {
    await abrirComAvisos(quadro([aviso(1)]));
    const p = await painel();
    expect(within(p).queryByRole('button', { name: 'Próximo aviso' })).toBeNull();
    expect(within(p).queryByRole('button', { name: /^Ir ao aviso/ })).toBeNull();
  });

  it('nada passa sozinho: o tempo andando não muda o aviso', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'], shouldAdvanceTime: true });
    await abrirComAvisos(quadro([aviso(1), aviso(2)]));
    const p = await painel();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(within(p).getByText('Aviso 1')).toBeInTheDocument();
  });

  it('o texto longo, com linhas em branco, não estoura a cena: rola dentro do aviso e guarda as quebras', async () => {
    const longo = `${'Linha comprida. '.repeat(20)}\n\nSegundo parágrafo.\n\nTerceiro parágrafo.`;
    const { cena } = await abrirComAvisos(quadro([aviso(1, { texto: longo, titulo: 'T'.repeat(80) })]));
    const p = await painel();
    const texto = within(p).getByText(/Segundo parágrafo/);
    expect(texto.className).toMatch(/overflow-y-auto/);
    expect(texto.className).toMatch(/max-h-/);
    expect(texto.className).toMatch(/whitespace-pre-line/);
    // o título também é contido (duas linhas, no máximo)
    expect(within(p).getByText('T'.repeat(80)).className).toMatch(/line-clamp-2/);
    // a altura da cena continua a que o quadro mede (400 px sem rolagem), e não a do conteúdo
    expect(cena.style.height).toBe('400px');
  });

  it('sem aviso e sem poder publicar, o painel não aparece', async () => {
    await abrirComAvisos(quadro([], false));
    await screen.findByRole('navigation', { name: 'Módulos' });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('region', { name: 'Avisos' })).toBeNull();
  });

  it('sem aviso, quem pode publicar vê o painel com "Nenhum aviso." e "Publicar aviso"', async () => {
    await abrirComAvisos(quadro([], true));
    const p = await painel();
    expect(within(p).getByText('Nenhum aviso.')).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Publicar aviso' })).toBeInTheDocument();
  });

  it('quem não pode publicar não vê "Publicar aviso"; quem pode vê, mesmo com avisos', async () => {
    await abrirComAvisos(quadro([aviso(1)], false));
    const p = await painel();
    expect(within(p).queryByRole('button', { name: 'Publicar aviso' })).toBeNull();
  });

  it('o painel dentro da cena cabe nela: a altura é limitada à da cena e o texto rola dentro do aviso (1024 a 1200 px)', async () => {
    await abrirComAvisos(quadro([aviso(1, { podeAlterar: true, titulo: 'T'.repeat(80), texto: 'x '.repeat(200) })], true));
    const p = await painel();
    expect(p.className).toMatch(/max-h-full/);
    expect(p.className).toMatch(/grid-rows-\[auto_minmax\(0,1fr\)_auto\]/);
    const texto = within(p).getByText(/x x x/);
    expect(texto.className).toMatch(/min-h-0/);
    expect(texto.className).toMatch(/overflow-y-auto/);
  });

  it('ao encolher, o painel sai da cena: some e deixa de receber foco e clique (a cena ganha data-encolhida)', async () => {
    const { cena } = await abrirComAvisos(quadro([aviso(1)], true));
    await painel();
    expect(cena).not.toHaveAttribute('data-encolhida');
    Object.defineProperty(window, 'scrollY', { value: 5000, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(cena).toHaveAttribute('data-encolhida'));
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    await waitFor(() => expect(cena).not.toHaveAttribute('data-encolhida'));
  });

  it('Editar e Retirar só aparecem no aviso que a conta pode alterar', async () => {
    await abrirComAvisos(quadro([aviso(1, { podeAlterar: true }), aviso(2)], true));
    const p = await painel();
    expect(within(p).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Retirar' })).toBeInTheDocument();
    await userEvent.click(within(p).getByRole('button', { name: 'Próximo aviso' }));
    expect(within(p).queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(within(p).queryByRole('button', { name: 'Retirar' })).toBeNull();
  });

  it('API sem resposta (404 ou erro): nenhum painel e a tela inicial segue igual', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA]: { status: 500, corpo: { erro: 'falhou' } } });
    abrir('/');
    await screen.findByRole('navigation', { name: 'Módulos' });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('region', { name: 'Avisos' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a barra encolhida e o celular', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a barra encolhida mostra o título do primeiro aviso só no computador', async () => {
    const { cena } = await abrirComAvisos(quadro([aviso(1, { titulo: 'Reunião geral' }), aviso(2)]));
    const barra = await waitFor(() => {
      const b = cena.querySelector<HTMLElement>('[data-barra-do-aviso]');
      expect(b).not.toBeNull();
      return b!;
    });
    expect(barra).toHaveTextContent('Reunião geral');
    expect(barra.className).toMatch(/hidden md:inline/);
  });

  it('no celular o painel fica logo abaixo da cena, e não dentro dela', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    const { cena } = await abrirComAvisos(quadro([aviso(1)]));
    const p = await painel();
    expect(cena.contains(p)).toBe(false);
    // vem depois da cena e antes dos atalhos
    expect(cena.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(p.compareDocumentPosition(screen.getByRole('navigation', { name: 'Módulos' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // sem rolagem de lado: o painel tem a largura da coluna
    expect(p.className).not.toMatch(/w-\[\d/);
  });
});

describe('a janela de publicar, editar e retirar', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('publica com os campos e textos fixos, fecha e busca os avisos de novo', async () => {
    const { fetchFalso } = await abrirComAvisos(quadro([aviso(1)], true), { 'POST /api/avisos': { status: 201, corpo: aviso(9) } });
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Publicar aviso' }));
    const janela = await screen.findByRole('dialog', { name: 'Publicar aviso' });
    expect(within(janela).getByRole('combobox', { name: 'Unidade' })).toHaveTextContent('1ª SB');
    await userEvent.type(within(janela).getByLabelText('Título'), 'Reunião às 9h');
    await userEvent.type(within(janela).getByLabelText('Texto'), 'Na sala de reuniões.');
    await userEvent.click(within(janela).getByRole('checkbox', { name: 'Fixar no topo' }));
    await userEvent.type(within(janela).getByLabelText('Vale até (opcional)'), FUTURA);
    const antes = chamadasA(fetchFalso, ROTA);
    await userEvent.click(within(janela).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(corpoEnviado(fetchFalso, 'POST /api/avisos')).toEqual({ unidadeId: 'u-1sb', titulo: 'Reunião às 9h', texto: 'Na sala de reuniões.', fixado: true, valeAte: FUTURA });
    await waitFor(() => expect(chamadasA(fetchFalso, ROTA)).toBeGreaterThan(antes));
  });

  it('sem data, "valeAte" não vai preenchido; "Cancelar" fecha sem enviar', async () => {
    const { fetchFalso } = await abrirComAvisos(quadro([], true), { 'POST /api/avisos': { status: 201, corpo: aviso(9) } });
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Publicar aviso' }));
    const janela = await screen.findByRole('dialog', { name: 'Publicar aviso' });
    await userEvent.click(within(janela).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(fetchFalso, 'POST /api/avisos')).toBe(0);
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Publicar aviso' }));
    const outra = await screen.findByRole('dialog', { name: 'Publicar aviso' });
    await userEvent.type(within(outra).getByLabelText('Título'), 'Sem data');
    await userEvent.type(within(outra).getByLabelText('Texto'), 'Corpo.');
    await userEvent.click(within(outra).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(chamadasA(fetchFalso, 'POST /api/avisos')).toBe(1));
    expect(corpoEnviado(fetchFalso, 'POST /api/avisos')).toMatchObject({ fixado: false, valeAte: null });
  });

  it('o erro da API aparece na janela, que fica aberta', async () => {
    await abrirComAvisos(quadro([], true), { 'POST /api/avisos': { status: 403, corpo: { erro: 'Você não tem nível de acesso nesta unidade.' } } });
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Publicar aviso' }));
    const janela = await screen.findByRole('dialog', { name: 'Publicar aviso' });
    await userEvent.type(within(janela).getByLabelText('Título'), 'X');
    await userEvent.type(within(janela).getByLabelText('Texto'), 'Y');
    await userEvent.click(within(janela).getByRole('button', { name: 'Publicar' }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Você não tem nível de acesso nesta unidade.');
    expect(screen.getByRole('dialog', { name: 'Publicar aviso' })).toBeInTheDocument();
  });

  it('o erro de um campo (a data que já passou) aparece junto do campo', async () => {
    await abrirComAvisos(quadro([], true), { 'POST /api/avisos': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { valeAte: 'A data já passou.' } } } });
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Publicar aviso' }));
    const janela = await screen.findByRole('dialog', { name: 'Publicar aviso' });
    await userEvent.type(within(janela).getByLabelText('Título'), 'X');
    await userEvent.type(within(janela).getByLabelText('Texto'), 'Y');
    await userEvent.type(within(janela).getByLabelText('Vale até (opcional)'), '2020-01-01');
    await userEvent.click(within(janela).getByRole('button', { name: 'Publicar' }));
    expect(await within(janela).findByText('A data já passou.')).toBeInTheDocument();
    expect(within(janela).getByLabelText('Vale até (opcional)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('o título e o texto têm o limite dito antes de enviar (80 e 400)', async () => {
    const { fetchFalso } = await abrirComAvisos(quadro([], true), { 'POST /api/avisos': { status: 201, corpo: aviso(9) } });
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Publicar aviso' }));
    const janela = await screen.findByRole('dialog', { name: 'Publicar aviso' });
    await userEvent.type(within(janela).getByLabelText('Título'), 'T'.repeat(81));
    await userEvent.type(within(janela).getByLabelText('Texto'), 'x');
    await userEvent.click(within(janela).getByRole('button', { name: 'Publicar' }));
    expect(await within(janela).findByText('O título tem até 80 caracteres.')).toBeInTheDocument();
    expect(chamadasA(fetchFalso, 'POST /api/avisos')).toBe(0);
  });

  it('Editar abre "Editar aviso" com os valores, a unidade parada, e salva pelo PATCH', async () => {
    const { fetchFalso } = await abrirComAvisos(quadro([aviso(1, { podeAlterar: true, fixado: true, valeAte: FUTURA })]), { 'PATCH /api/avisos/av-1': { status: 200, corpo: aviso(1) } });
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Editar' }));
    const janela = await screen.findByRole('dialog', { name: 'Editar aviso' });
    expect(within(janela).getByLabelText('Título')).toHaveValue('Aviso 1');
    expect(within(janela).getByLabelText('Texto')).toHaveValue('Texto do aviso 1.');
    expect(within(janela).getByRole('checkbox', { name: 'Fixar no topo' })).toBeChecked();
    expect(within(janela).getByLabelText('Vale até (opcional)')).toHaveValue(FUTURA);
    // a unidade não muda na edição
    expect(within(janela).getByRole('combobox', { name: 'Unidade' })).toBeDisabled();
    await userEvent.clear(within(janela).getByLabelText('Título'));
    await userEvent.type(within(janela).getByLabelText('Título'), 'Título novo');
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(corpoEnviado(fetchFalso, 'PATCH /api/avisos/av-1')).toEqual({ titulo: 'Título novo', texto: 'Texto do aviso 1.', fixado: true, valeAte: FUTURA });
  });

  it('Retirar pede a confirmação na própria janela; confirmar retira, cancelar não', async () => {
    const { fetchFalso } = await abrirComAvisos(quadro([aviso(1, { podeAlterar: true })]), { 'POST /api/avisos/av-1/retirar': { status: 204 } });
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Retirar' }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByText('Retirar este aviso? Ele sai da tela inicial de todos.')).toBeInTheDocument();
    await userEvent.click(within(janela).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(fetchFalso, 'POST /api/avisos/av-1/retirar')).toBe(0);
    await userEvent.click(within(await painel()).getByRole('button', { name: 'Retirar' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retirar' }));
    await waitFor(() => expect(chamadasA(fetchFalso, 'POST /api/avisos/av-1/retirar')).toBe(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
