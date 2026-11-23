import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, chamadasA, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.17 (parte 2), Task 6, item 1: fechar um diálogo de criação com algo digitado pergunta "Descartar o que foi digitado?".
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PERGUNTA = 'Descartar o que foi digitado?';

function apiEscalas() {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [] },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
  });
}

describe('Nova escala (campo sem estado, não controlado)', () => {
  async function abrirNova() {
    apiEscalas();
    abrir('/escalas');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova escala' }));
    return screen.findByRole('dialog', { name: 'Nova escala' });
  }

  it('sem nada digitado, Esc fecha na hora, sem perguntar', async () => {
    await abrirNova();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText(PERGUNTA)).toBeNull();
  });

  it('com o nome digitado, Esc pergunta; "Continuar editando" mantém o diálogo e o texto', async () => {
    const d = await abrirNova();
    await userEvent.type(within(d).getByLabelText('Nome da escala'), 'CPRH');
    await userEvent.keyboard('{Escape}');
    const pergunta = await screen.findByRole('alertdialog', { name: PERGUNTA });
    await userEvent.click(within(pergunta).getByRole('button', { name: 'Continuar editando' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByLabelText('Nome da escala')).toHaveValue('CPRH');
  });

  it('"Descartar" fecha o diálogo e não grava nada', async () => {
    const d = await abrirNova();
    await userEvent.type(within(d).getByLabelText('Nome da escala'), 'CPRH');
    await userEvent.keyboard('{Escape}');
    const pergunta = await screen.findByRole('alertdialog', { name: PERGUNTA });
    await userEvent.click(within(pergunta).getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText(PERGUNTA)).toBeNull();
  });

  it('o X do canto ("Fechar") também pergunta', async () => {
    const d = await abrirNova();
    await userEvent.type(within(d).getByLabelText('Nome da escala'), 'CPRH');
    await userEvent.click(within(d).getByRole('button', { name: 'Fechar' }));
    expect(await screen.findByRole('alertdialog', { name: PERGUNTA })).toBeInTheDocument();
  });

  it('criar com sucesso não pergunta nada (o diálogo fecha sozinho)', async () => {
    const f = simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [] },
      'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] },
      'POST /api/unidades/u-1sb/escalas': { status: 201, corpo: { id: 'e9' } },
      'GET /api/escalas/e9': { status: 200, corpo: { id: 'e9', nome: 'CPRH', titulo: 'T', militaresDoc: 'todos', diasDoc: 'todos', ativa: true, montaBlocosVoluntariado: true, distribuicao: 'pre_escala', servicos: [], faixas: [], comLetra: false, vinculos: [] } },
    });
    abrir('/escalas');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova escala' }));
    const d = await screen.findByRole('dialog', { name: 'Nova escala' });
    await userEvent.type(within(d).getByLabelText('Nome da escala'), 'CPRH');
    await userEvent.click(within(d).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/unidades/u-1sb/escalas')).toBe(1));
    expect(screen.queryByText(PERGUNTA)).toBeNull();
  });
});

describe('Novo feriado (campos controlados)', () => {
  const ano = new Date().getFullYear();
  async function abrirNovo() {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/unidades/u-1sb/feriados': { status: 200, corpo: [] } });
    abrir('/feriados');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo feriado' }));
    return screen.findByRole('dialog', { name: 'Novo feriado' });
  }

  it('sem digitar, fecha na hora; com a descrição digitada, pergunta', async () => {
    const d = await abrirNovo();
    expect(within(d).getByLabelText('Data')).toHaveValue(`${ano}-01-01`);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const d2 = await (async () => { await userEvent.click(screen.getByRole('button', { name: 'Novo feriado' })); return screen.findByRole('dialog', { name: 'Novo feriado' }); })();
    await userEvent.type(within(d2).getByLabelText('Descrição'), 'Dia do bombeiro');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('alertdialog', { name: PERGUNTA })).toBeInTheDocument();
  });
});

describe('Novo serviço e Adicionar cota', () => {
  it('Novo serviço: o nome digitado faz o Esc perguntar', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [] } });
    abrir('/servicos');
    await userEvent.click(await screen.findByRole('button', { name: 'Novo serviço' }));
    const d = await screen.findByRole('dialog', { name: 'Novo serviço' });
    await userEvent.type(within(d).getByLabelText('Nome do serviço'), 'Bioma');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('alertdialog', { name: PERGUNTA })).toBeInTheDocument();
  });

  it('Adicionar cota: a quantidade digitada faz o Esc perguntar', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/cotas': { status: 200, corpo: [] },
      'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [{ id: 'sv', nome: 'JES', tipo: 'pjes', operacao: null, rotuloImpressao: null, cor: '#6E56A8', ativo: true, fixo: false, turnos: [] }] },
    });
    abrir('/cotas');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar cota' }));
    const d = await screen.findByRole('dialog', { name: 'Adicionar cota' });
    await userEvent.type(within(d).getByLabelText('Quantidade'), '30');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('alertdialog', { name: PERGUNTA })).toBeInTheDocument();
  });
});
