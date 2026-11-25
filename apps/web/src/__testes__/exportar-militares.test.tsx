import type { LinhaDaBusca, ResultadoDaBusca } from 'contratos';
import { COLUNAS_DA_EXPORTACAO } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hoje } from '@/lib/meses';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.54, Task 3: o botão "Exportar" e a janela dos campos, em Pesquisar militares. Dados fictícios (D7).
const NIVEL = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }] };
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const linha = (id: string, nomeGuerra: string): LinhaDaBusca => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: `Fulano ${nomeGuerra}`, matricula: '990001-1', lotacao: '1ª SB', quadro: 'QBMG', equipe: null, jornada: 'adm', situacao: 'Ativa', unidadeId: 'u-1sb', podeAlterar: true,
});
const resultado = (militares: LinhaDaBusca[]): ResultadoDaBusca => ({ militares, haMais: false, naoEncontradas: [] });
const BUSCA = resultado([linha('m1', 'ANDRADE'), linha('m2', 'BARRETO')]);
// a lista inteira do filtro: um já selecionado (m2) e dois que não estão na seleção (m3, m4)
const TODOS = resultado([linha('m2', 'BARRETO'), linha('m3', 'CABRAL'), linha('m4', 'DUARTE')]);
const EXPORTAR = '/api/consulta/militares/exportar';

function api(eu: unknown = NIVEL, exportada: { status: number; corpo?: unknown } = { status: 200 }) {
  const f = simularApi({
    '/api/eu': { status: 200, corpo: eu },
    'GET /api/consulta/unidades': { status: 200, corpo: [] },
    'GET /api/consulta/militares': { status: 200, corpo: BUSCA },
    'POST /api/consulta/militares/buscar': { status: 200, corpo: BUSCA },
    'POST /api/consulta/militares/buscar/todos': { status: 200, corpo: TODOS },
  });
  const padrao = f.getMockImplementation()!;
  f.mockImplementation(async (entrada, init) => {
    if (String(entrada).endsWith(EXPORTAR)) {
      if (exportada.status !== 200) return new Response(JSON.stringify(exportada.corpo), { status: exportada.status, headers: { 'Content-Type': 'application/json' } });
      return new Response(new Uint8Array([80, 75, 3, 4]), { status: 200, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    }
    return padrao(entrada, init);
  });
  return f;
}
const corpoExportado = (f: ReturnType<typeof simularApi>) => {
  const c = f.mock.calls.find(([e, i]) => String(e).endsWith(EXPORTAR) && i?.method === 'POST');
  return c ? JSON.parse(String(c[1]!.body)) : undefined;
};
const buscar = async (texto = 'abc') => {
  await userEvent.type(await screen.findByLabelText('Nome, nome de guerra ou matrícula'), texto);
  await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByRole('list', { name: 'Militares encontrados' });
};
const selecionarEstes = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 2' }));
  await screen.findByRole('heading', { name: 'Selecionados (2)' });
};
const abrirJanela = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
  return within(await screen.findByRole('dialog', { name: 'Exportar para Excel' }));
};

let baixados: string[];
beforeEach(() => {
  baixados = [];
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    baixados.push(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('o botão Exportar', () => {
  it('quem tem nível de acesso o vê quando há resultado de busca; sem busca nem seleção, não', async () => {
    api();
    abrir('/peculio/pesquisar');
    await screen.findByLabelText('Nome, nome de guerra ou matrícula');
    expect(screen.queryByRole('button', { name: 'Exportar' })).toBeNull();
    await buscar();
    expect(await screen.findByRole('button', { name: 'Exportar' })).toBeInTheDocument();
  });

  it('o militar comum (sem nível de acesso) nunca o vê', async () => {
    api(COMUM);
    abrir('/peculio/pesquisar');
    await buscar();
    expect(screen.queryByRole('button', { name: 'Exportar' })).toBeNull();
  });
});

describe('a janela "Exportar para Excel"', () => {
  it('sem seleção, a janela não pergunta o que sai: "Baixar planilha" exporta a busca, e o arquivo baixa como militares-{data}.xlsx', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await buscar();
    const j = await abrirJanela();
    expect(j.queryByText('O que sai')).toBeNull();
    await userEvent.click(j.getByRole('button', { name: 'Baixar planilha' }));
    await waitFor(() => expect(baixados).toEqual([`militares-${hoje()}.xlsx`]));
    const corpo = corpoExportado(f);
    expect(corpo.filtros).toEqual({ texto: 'abc' });
    expect(corpo.ids).toBeUndefined();
    expect(corpo.colunas).toContain('MATRÍCULA');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Exportar para Excel' })).toBeNull());
  });

  it('com seleção, pergunta o que sai, com a contagem de cada opção (a da busca e a dos dois vêm da lista inteira), "Selecionados" já marcada', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await buscar();
    await selecionarEstes();
    const j = await abrirJanela();
    expect(j.getByText('O que sai')).toBeInTheDocument();
    expect(await j.findByRole('radio', { name: 'Resultado da busca (3)' })).toBeInTheDocument();
    expect(j.getByRole('radio', { name: 'Selecionados (2)' })).toBeChecked();
    // m1 e m2 selecionados; m2, m3 e m4 na busca: juntos, sem repetir, são 4
    expect(j.getByRole('radio', { name: 'Os dois juntos, sem repetir (4)' })).toBeInTheDocument();
    await userEvent.click(j.getByRole('button', { name: 'Baixar planilha' }));
    await waitFor(() => expect(corpoExportado(f)).toBeDefined());
    expect(corpoExportado(f).ids).toEqual(['m1', 'm2']);
    expect(corpoExportado(f).filtros).toBeUndefined();
  });

  it('"Resultado da busca" manda só os filtros; "Os dois juntos" manda os filtros e os ids', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await buscar();
    await selecionarEstes();
    let j = await abrirJanela();
    await userEvent.click(await j.findByRole('radio', { name: 'Resultado da busca (3)' }));
    await userEvent.click(j.getByRole('button', { name: 'Baixar planilha' }));
    await waitFor(() => expect(corpoExportado(f)).toBeDefined());
    expect(corpoExportado(f)).toMatchObject({ filtros: { texto: 'abc' } });
    expect(corpoExportado(f).ids).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    f.mockClear();
    j = await abrirJanela();
    await userEvent.click(await j.findByRole('radio', { name: 'Os dois juntos, sem repetir (4)' }));
    await userEvent.click(j.getByRole('button', { name: 'Baixar planilha' }));
    await waitFor(() => expect(corpoExportado(f)).toBeDefined());
    expect(corpoExportado(f)).toMatchObject({ filtros: { texto: 'abc' }, ids: ['m1', 'm2'] });
  });

  it('sem busca feita (os filtros foram limpos), só a seleção: a janela não pergunta, e sai a seleção', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await buscar();
    await selecionarEstes();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Militares encontrados' })).toBeNull());
    const j = await abrirJanela();
    expect(j.queryByText('O que sai')).toBeNull();
    await userEvent.click(j.getByRole('button', { name: 'Baixar planilha' }));
    await waitFor(() => expect(corpoExportado(f)).toBeDefined());
    expect(corpoExportado(f).ids).toEqual(['m1', 'm2']);
    expect(corpoExportado(f).filtros).toBeUndefined();
  });

  it('os campos: MATRÍCULA marcada e travada, com a nota; "Marcar todos" marca todos; só os marcados vão no pedido', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await buscar();
    const j = await abrirJanela();
    const matricula = j.getByRole('checkbox', { name: 'MATRÍCULA' });
    expect(matricula).toBeChecked();
    expect(matricula).toBeDisabled();
    expect(j.getByText('Sem a matrícula, o arquivo não volta para o sistema.')).toBeInTheDocument();
    expect(j.getByText('Os campos que você não vê na ficha de um militar saem vazios.')).toBeInTheDocument();
    await userEvent.click(j.getByRole('button', { name: 'Marcar todos' }));
    expect(j.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(COLUNAS_DA_EXPORTACAO.length);
    await userEvent.click(j.getByRole('checkbox', { name: 'CPF' }));
    await userEvent.click(j.getByRole('button', { name: 'Baixar planilha' }));
    await waitFor(() => expect(corpoExportado(f)).toBeDefined());
    expect(corpoExportado(f).colunas).toEqual(COLUNAS_DA_EXPORTACAO.map((c) => c.rotulo).filter((r) => r !== 'CPF'));
  });

  it('"Cancelar" fecha a janela sem pedir nada', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await buscar();
    const j = await abrirJanela();
    await userEvent.click(j.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(corpoExportado(f)).toBeUndefined();
    expect(baixados).toEqual([]);
  });

  it('o erro da API aparece na janela, que continua aberta, e nada baixa', async () => {
    api(NIVEL, { status: 400, corpo: { erro: 'Mais de 5000 militares. Afine a busca.' } });
    abrir('/peculio/pesquisar');
    await buscar();
    const j = await abrirJanela();
    await userEvent.click(j.getByRole('button', { name: 'Baixar planilha' }));
    expect(await j.findByRole('alert')).toHaveTextContent('Mais de 5000 militares. Afine a busca.');
    expect(screen.getByRole('dialog', { name: 'Exportar para Excel' })).toBeInTheDocument();
    expect(baixados).toEqual([]);
  });
});
