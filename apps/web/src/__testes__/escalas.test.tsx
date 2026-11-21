import type { Escala, LinhaEscala, LinhaGuarnicao } from 'contratos';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { mesPorExtenso } from 'contratos';
import { atualizarEscalas } from '@/api/escalas';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

const LISTA: LinhaEscala[] = [
  { id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto', 'JES'], montaBlocosVoluntariado: true },
  { id: 'e2', nome: 'Nova', ativa: true, servicos: [], montaBlocosVoluntariado: true },
  { id: 'e3', nome: 'Velha', ativa: false, servicos: [], montaBlocosVoluntariado: true },
];
const guarnicao = (g: Partial<LinhaGuarnicao>): LinhaGuarnicao => ({
  id: 'g1', nome: 'ABT', viatura: null, prioridade: 1, ativa: true, minimo: 2, maximo: 4, aPartirDe: null, ...g,
});
const GUARNICOES = [guarnicao({}), guarnicao({ id: 'g2', nome: 'APH', prioridade: 2 }), guarnicao({ id: 'g3', nome: 'AR', ativa: false, prioridade: 3 })];
const DIA = { inicio: '08:00', fim: '20:00', letras: ['A' as const], servicos: ['Pronto', 'JES'] };
const NOITE = { inicio: '20:00', fim: '08:00', letras: ['B' as const], servicos: ['Pronto'] };
const escala = (e: Partial<Escala> = {}): Escala => ({
  id: 'e1', nome: 'Ordinário', titulo: 'ESCALA ORDINÁRIO', militaresDoc: 'todos', diasDoc: 'todos', ativa: true, montaBlocosVoluntariado: true,
  servicos: [{ id: 's1', nome: 'Pronto', cor: '#2F8F5B', ativo: true }, { id: 's2', nome: 'JES', cor: '#6E56A8', ativo: true }],
  faixas: [DIA, NOITE],
  comLetra: true,
  vinculos: [],
  ...e,
});
const mes = mesAtual();

function api(ficha: Escala = escala(), extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: GUARNICOES },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
    'GET /api/escalas/e1': { status: 200, corpo: ficha },
    [`PUT /api/escalas/e1/vinculos/${mes}`]: { status: 200, corpo: ficha },
    'PUT /api/escalas/e1/servicos': { status: 200, corpo: ficha },
    ...extra,
  });
}
const salvarMatriz = () => userEvent.click(screen.getByRole('button', { name: `Salvar a partir de ${mesPorExtenso(mes)}` }));

describe('serviços da escala: "Incluir serviço" com botão', () => {
  const BIOMA = { id: 's3', nome: 'Bioma', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#C08A1E', ativo: true, fixo: false, turnos: [] };
  const comBioma = { 'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [BIOMA] } };

  it('escolher na lista não põe o serviço; o botão "Incluir" põe, e só "Salvar serviços" grava', async () => {
    const f = api(escala(), comBioma);
    abrir('/escalas/e1');
    const lista = await screen.findByLabelText('Incluir serviço');
    const incluir = screen.getByRole('button', { name: 'Incluir' });
    expect(incluir).toBeDisabled();
    await userEvent.selectOptions(lista, 's3');
    expect(screen.queryByRole('link', { name: 'Bioma' })).toBeNull();
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
    expect(incluir).toBeEnabled();
    await userEvent.click(incluir);
    expect(screen.getByRole('link', { name: 'Bioma' })).toBeInTheDocument();
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
    // a lista volta a "Incluir serviço…" e nada foi gravado ainda
    expect(screen.queryByLabelText('Incluir serviço')).toBeNull();
    expect(chamadasA(f, 'PUT /api/escalas/e1/servicos')).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar serviços' }));
    await waitFor(() => expect(corpoEnviado(f, 'PUT /api/escalas/e1/servicos')).toEqual({ servicoIds: ['s1', 's2', 's3'] }));
  });
});

describe('escalas', () => {
  it('a contagem da lista diz "1 escala" no singular e "2 escalas" no plural', async () => {
    api();
    abrir('/escalas');
    expect(await screen.findByText('2 escalas')).toBeInTheDocument();
    cleanup();
    api(escala(), { 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA.slice(0, 1) } });
    abrir('/escalas');
    expect(await screen.findByText('1 escala')).toBeInTheDocument();
    expect(screen.queryByText('1 escalas')).toBeNull();
  });

  it('lista mostra os serviços e esconde as desativadas', async () => {
    api();
    abrir('/escalas');
    expect((await screen.findByText('Ordinário')).closest('li')).toHaveTextContent('Pronto, JES');
    expect(screen.getByText('Nova').closest('li')).toHaveTextContent('sem serviços');
    expect(screen.queryByText('Velha')).toBeNull();
    await userEvent.click(screen.getByLabelText('Mostrar desativadas'));
    expect(await screen.findByText('Velha')).toBeInTheDocument();
  });

  it('nova escala envia só o nome', async () => {
    const f = api(escala(), { 'POST /api/unidades/u-1sb/escalas': { status: 201, corpo: escala() } });
    abrir('/escalas');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova escala' }));
    const dialogo = await screen.findByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Nome da escala'), 'CPRH');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-1sb/escalas')).toEqual({ nome: 'CPRH' }));
  });

  it('subir serviço muda a ordem enviada', async () => {
    const f = api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByRole('button', { name: 'Subir JES' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar serviços' }));
    await waitFor(() => expect(corpoEnviado(f, 'PUT /api/escalas/e1/servicos')).toEqual({ servicoIds: ['s2', 's1'] }));
  });

  it('colunas mostram letra e faixa quando não há ambiguidade', async () => {
    api();
    abrir('/escalas/e1');
    const coluna = (await screen.findByText('08h–20h')).closest('th')!;
    expect(within(coluna).getByText('A')).toBeInTheDocument();
    const noite = screen.getByText('20h–08h').closest('th')!;
    expect(within(noite).getByText('B')).toBeInTheDocument();
  });

  it('com letra ambígua, colunas mostram só a faixa', async () => {
    const madrugada = { inicio: '00:00', fim: '08:00', letras: ['A' as const], servicos: ['Bioma'] };
    api(escala({ faixas: [madrugada, DIA], comLetra: false }));
    abrir('/escalas/e1');
    const coluna = (await screen.findByText('00h–08h')).closest('th')!;
    expect(within(coluna).queryByText('A')).toBeNull();
    expect(screen.getByLabelText('ABT em 00h–08h')).toBeInTheDocument();
  });

  it('não há coluna Todos os turnos', async () => {
    api();
    abrir('/escalas/e1');
    await screen.findByText('08h–20h');
    expect(screen.queryByText('Todos os turnos')).toBeNull();
    expect(screen.queryByLabelText(/em todos os turnos/)).toBeNull();
  });

  it('marcar envia a faixa', async () => {
    const f = api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    await userEvent.click(screen.getByLabelText('ABT em B (20h–08h)'));
    await salvarMatriz();
    await waitFor(() =>
      expect(corpoEnviado(f, `PUT /api/escalas/e1/vinculos/${mes}`)).toEqual({
        itens: [{ guarnicaoId: 'g1', inicio: '08:00', fim: '20:00' }, { guarnicaoId: 'g1', inicio: '20:00', fim: '08:00' }],
      }),
    );
  });

  it('mínimo da coluna soma as guarnições marcadas', async () => {
    api();
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    expect(screen.getAllByText('mín. 0')).toHaveLength(1); // só a coluna da noite continua em zero
    await userEvent.click(screen.getByLabelText('APH em A (08h–20h)'));
    expect(screen.getByText('mín. 4')).toBeInTheDocument();
  });

  it('linha mostra o tamanho da guarnição', async () => {
    api();
    abrir('/escalas/e1');
    const linha = (await screen.findByLabelText('ABT em A (08h–20h)')).closest('tr')!;
    expect(within(linha).getByText('de 2 a 4 militares')).toBeInTheDocument();
  });

  it('guarnição desativada só aparece vinculada, com a etiqueta', async () => {
    api(escala({ vinculos: [{ vigencia: mes, itens: [{ guarnicaoId: 'g3', guarnicao: 'AR', ativaNoMes: false, ...NOITE }] }] }));
    abrir('/escalas/e1');
    const caixa = await screen.findByLabelText('AR em B (20h–08h)');
    expect(caixa).toBeChecked();
    expect(within(caixa.closest('tr')!).getByText('desativada')).toBeInTheDocument();
  });

  it('guarnição desativada sem vínculo não aparece na matriz', async () => {
    api();
    abrir('/escalas/e1');
    await screen.findByLabelText('ABT em A (08h–20h)');
    expect(screen.queryByLabelText('AR em A (08h–20h)')).toBeNull();
  });

  it('faixa que saiu da escala mostra o aviso', async () => {
    api(escala({ vinculos: [{ vigencia: mes, itens: [{ guarnicaoId: 'g1', guarnicao: 'ABT', ativaNoMes: true, inicio: '16:00', fim: '00:00' }] }] }));
    abrir('/escalas/e1');
    expect(await screen.findByText('A faixa 16h–00h não existe mais nos serviços desta escala: ABT. Salve a matriz para tirá-la.')).toBeInTheDocument();
  });
});

describe('ficha da escala em painel único', () => {
  it('o resumo da escala diz o título no documento', async () => {
    api();
    abrir('/escalas/e1');
    const ficha = (await screen.findByRole('heading', { level: 2, name: 'Ordinário' })).closest('[data-ficha]') as HTMLElement;
    expect(within(ficha).getByText('Título no documento: ESCALA ORDINÁRIO.')).toBeInTheDocument();
  });

  it('escala ativa só mostra Desativar, e pergunta antes', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const f = api(escala(), { 'POST /api/escalas/e1/situacao': { status: 200, corpo: escala({ ativa: false }) } });
    abrir('/escalas/e1');
    await screen.findByRole('heading', { level: 2, name: 'Ordinário' });
    expect(screen.queryByText(/Desativada/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(confirmar).toHaveBeenCalledWith('Desativar a escala Ordinário? Ela some da lista.');
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/escalas/e1/situacao')).toEqual({ ativa: false }));
    confirmar.mockRestore();
  });

  it('escala desativada mostra a etiqueta e Reativar', async () => {
    api(escala({ ativa: false }));
    abrir('/escalas/e1');
    const ficha = (await screen.findByRole('heading', { level: 2, name: 'Ordinário' })).closest('[data-ficha]') as HTMLElement;
    expect(within(ficha).getByText('desativada')).toBeInTheDocument();
    expect(within(ficha).getByRole('button', { name: 'Reativar' })).toBeInTheDocument();
  });

  it('o item aberto na lista fica marcado', async () => {
    api();
    abrir('/escalas/e1');
    const link = (await screen.findAllByText('Ordinário')).map((e) => e.closest('a')).find(Boolean)!;
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.className).toContain('shadow-[inset_3px_0_0');
  });

  it('todas desativadas, a lista explica o que marcar', async () => {
    api(escala(), { 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA.map((e) => ({ ...e, ativa: false })) } });
    abrir('/escalas');
    expect(await screen.findByText('Todas as escalas estão desativadas. Marque "Mostrar desativadas" para vê-las.')).toBeInTheDocument();
  });
});

describe('matriz: mês, faixas, coluna parada e links', () => {
  it('a matriz segue o mês do Vale a partir de', async () => {
    const f = api(escala({ faixas: [DIA, NOITE] }));
    abrir('/escalas/e1');
    await screen.findByLabelText('ABT em A (08h–20h)');
    fireEvent.change(screen.getByLabelText('Vale a partir de'), { target: { value: '2099-01' } });
    await waitFor(() =>
      expect(f.mock.calls.some(([e]) => String(typeof e === 'string' ? e : e instanceof URL ? e.href : (e as Request).url).includes('/guarnicoes?mes=2099-01'))).toBe(true),
    );
  });

  it('escala sem faixas não desenha a tabela', async () => {
    api(escala({ faixas: [], servicos: [] }));
    abrir('/escalas/e1');
    expect(await screen.findByText(/Reúna os serviços primeiro/)).toBeInTheDocument();
    // espera as guarnições chegarem: só então a tabela existiria
    await waitFor(() => expect(screen.queryByText('Carregando…')).toBeNull());
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('a coluna da guarnição fica parada ao rolar para o lado', async () => {
    api(escala({ faixas: [DIA, NOITE] }));
    abrir('/escalas/e1');
    const tabela = (await screen.findByLabelText('ABT em A (08h–20h)')).closest('table')!;
    expect(within(tabela).getByRole('columnheader', { name: 'Guarnição' }).className).toContain('sticky');
    expect(within(tabela).getByText('ABT').closest('td')!.className).toContain('sticky');
  });

  it('os nomes levam às fichas', async () => {
    api(escala({ faixas: [DIA, NOITE] }));
    abrir('/escalas/e1');
    expect(await screen.findByRole('link', { name: 'Pronto' })).toHaveAttribute('href', '/servicos/s1');
    expect(await screen.findByRole('link', { name: 'ABT' })).toHaveAttribute('href', '/configuracoes/modelos-de-guarnicao/g1');
  });

  it('faixa órfã deixa salvar para tirá-la', async () => {
    const velha = { inicio: '10:00', fim: '12:00' };
    api(escala({ faixas: [DIA], vinculos: [{ vigencia: mes, itens: [{ guarnicaoId: 'g1', guarnicao: 'ABT', ...velha, ativaNoMes: true }] }] }));
    abrir('/escalas/e1');
    await screen.findByText(/não existe mais nos serviços desta escala/);
    expect(screen.getByRole('button', { name: `Salvar a partir de ${mesPorExtenso(mes)}` })).toBeEnabled();
  });

  it('salvar num mês novo deixa a versão nova escolhida', async () => {
    const itens = [{ guarnicaoId: 'g1', guarnicao: 'ABT', inicio: '08:00', fim: '20:00', ativaNoMes: true }];
    const base = escala({ faixas: [DIA, NOITE], vinculos: [{ vigencia: mes, itens: [] }] });
    const salva = escala({ faixas: [DIA, NOITE], vinculos: [{ vigencia: '2099-01', itens }, { vigencia: mes, itens: [] }] });
    const rotas: Parameters<typeof simularApi>[0] = {
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: GUARNICOES },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
      'GET /api/escalas/e1': { status: 200, corpo: base },
      'PUT /api/escalas/e1/vinculos/2099-01': { status: 200, corpo: salva },
    };
    simularApi(rotas);
    abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    fireEvent.change(screen.getByLabelText('Vale a partir de'), { target: { value: '2099-01' } });
    rotas['GET /api/escalas/e1'] = { status: 200, corpo: salva };
    await userEvent.click(screen.getByRole('button', { name: 'Salvar a partir de janeiro de 2099' }));
    const chip = await screen.findByRole('button', { name: /^janeiro de 2099/ });
    await waitFor(() => expect(chip).toHaveAttribute('aria-pressed', 'true'));
  });
});

describe('revisão final: matriz', () => {
  const item = (g: string, nome: string, extra = {}) => ({ guarnicaoId: g, guarnicao: nome, inicio: '08:00', fim: '20:00', ativaNoMes: true, ...extra });
  const rotasDe = (e: Escala): Parameters<typeof simularApi>[0] => ({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: GUARNICOES },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
    'GET /api/escalas/e1': { status: 200, corpo: e },
  });

  it('uma importação com a ficha aberta recarrega as marcações', async () => {
    const r = rotasDe(escala({ faixas: [DIA], vinculos: [{ vigencia: mes, itens: [] }] }));
    simularApi(r);
    const router = abrir('/escalas/e1');
    expect(await screen.findByLabelText('ABT em A (08h–20h)')).not.toBeChecked();
    r['GET /api/escalas/e1'] = { status: 200, corpo: escala({ faixas: [DIA], vinculos: [{ vigencia: mes, itens: [item('g1', 'ABT')] }] }) };
    await act(async () => {
      atualizarEscalas(router.options.context.queryClient);
    });
    await waitFor(() => expect(screen.getByLabelText('ABT em A (08h–20h)')).toBeChecked());
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });

  it('com marcação pendente, a importação não apaga o que a pessoa marcou', async () => {
    const r = rotasDe(escala({ faixas: [DIA], vinculos: [{ vigencia: mes, itens: [] }] }));
    simularApi(r);
    const router = abrir('/escalas/e1');
    await userEvent.click(await screen.findByLabelText('ABT em A (08h–20h)'));
    r['GET /api/escalas/e1'] = { status: 200, corpo: escala({ faixas: [DIA], vinculos: [{ vigencia: mes, itens: [item('g2', 'APH')] }] }) };
    await act(async () => {
      atualizarEscalas(router.options.context.queryClient);
    });
    await new Promise((x) => setTimeout(x, 50));
    expect(screen.getByLabelText('ABT em A (08h–20h)')).toBeChecked();
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument();
  });

  it('trazer de volta uma versão antiga deixa salvar a partir do mês escolhido', async () => {
    simularApi(rotasDe(escala({ faixas: [DIA], vinculos: [{ vigencia: '2021-01', itens: [item('g1', 'ABT')] }, { vigencia: '2020-01', itens: [] }] })));
    abrir('/escalas/e1');
    const salvar = () => screen.getByRole('button', { name: `Salvar a partir de ${mesPorExtenso(mes)}` });
    expect(await screen.findByLabelText('ABT em A (08h–20h)')).toBeChecked();
    expect(salvar()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /^janeiro de 2020/ }));
    expect(screen.getByLabelText('ABT em A (08h–20h)')).not.toBeChecked();
    expect(salvar()).toBeEnabled();
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });

  it('a etiqueta desativada segue o mês do "Vale a partir de": guarnição ativa na lista não leva a etiqueta da versão', async () => {
    // a lista (consultada pelo mês do "Vale a partir de") diz que o ABT está ativo; o item foi gravado quando ele estava desativado
    simularApi(rotasDe(escala({ faixas: [DIA], vinculos: [{ vigencia: mes, itens: [item('g1', 'ABT', { ativaNoMes: false })] }] })));
    abrir('/escalas/e1');
    const caixa = await screen.findByLabelText('ABT em A (08h–20h)');
    expect(within(caixa.closest('tr')!).queryByText('desativada')).toBeNull();
  });
});

describe('revisão 3: o erro de Desativar fica na ficha em que aconteceu', () => {
  it('escala: voltar a outra escala que já estava no cache não traz o erro da anterior', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api(escala(), {
      'GET /api/escalas/e2': { status: 200, corpo: escala({ id: 'e2', nome: 'Nova', titulo: 'ESCALA NOVA' }) },
      'POST /api/escalas/e1/situacao': { status: 409, corpo: { erro: 'Falhou ao desativar Ordinário.' } },
    });
    const router = abrir('/escalas/e2');
    await screen.findByRole('heading', { name: 'Nova' });
    await act(() => router.navigate({ to: '/escalas/$id', params: { id: 'e1' } }));
    await userEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(await screen.findByText('Falhou ao desativar Ordinário.')).toBeInTheDocument();
    await act(() => router.navigate({ to: '/escalas/$id', params: { id: 'e2' } }));
    await screen.findByRole('heading', { name: 'Nova' });
    expect(screen.queryByText('Falhou ao desativar Ordinário.')).toBeNull();
  });
});

describe('recarregar o bloco com dado novo do servidor (revisão final da revisão 3)', () => {
  type Rota = { status: number; corpo?: unknown };
  const rotasDe = (ficha: Rota): Parameters<typeof simularApi>[0] => ({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: GUARNICOES },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
    'GET /api/escalas/e1': ficha,
  });

  it('Identificação: sem alteração pendente, o nome e o título recarregam', async () => {
    const ficha: Rota = { status: 200, corpo: escala() };
    simularApi(rotasDe(ficha));
    const router = abrir('/escalas/e1');
    expect(await screen.findByLabelText('Nome')).toHaveValue('Ordinário');
    ficha.corpo = escala({ nome: 'Ordinário 2', titulo: 'ESCALA NOVA' });
    await act(async () => {
      atualizarEscalas(router.options.context.queryClient);
    });
    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Ordinário 2'));
    expect(screen.getByLabelText('Título no documento')).toHaveValue('ESCALA NOVA');
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });

  it('Serviços da escala: sem alteração pendente, a lista recarrega', async () => {
    const ficha: Rota = { status: 200, corpo: escala() };
    simularApi(rotasDe(ficha));
    const router = abrir('/escalas/e1');
    expect(await screen.findByRole('link', { name: 'JES' })).toBeInTheDocument();
    ficha.corpo = escala({ servicos: [{ id: 's1', nome: 'Pronto', cor: '#2F8F5B', ativo: true }, { id: 's3', nome: 'Bioma', cor: '#C08A1E', ativo: true }] });
    await act(async () => {
      atualizarEscalas(router.options.context.queryClient);
    });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Bioma' })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'JES' })).toBeNull();
    expect(screen.queryByText('Alterações não salvas')).toBeNull();
  });
});
