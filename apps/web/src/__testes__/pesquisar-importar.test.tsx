import type { EuDaApi } from '@/api/eu';
import type { LinhaDaBusca, ResultadoDaBusca } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { esquecerUnidadeDaAba, guardarUnidade } from '@/lib/unidade-de-trabalho';
import { abrir, clicarBuscar, EU_EXEMPLO, simularApi } from './apoio';

// 6.63, Task 4: Importar e Exportar no alto de "Pesquisar militares". O Importar é o do Pecúlio, na unidade do Pecúlio. Dados fictícios.
const GESTOR_GB: EuDaApi = {
  ...EU_EXEMPLO,
  papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }, { papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }],
  unidades: [{ id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento', maeId: null }, ...EU_EXEMPLO.unidades],
};
const SO_DA_SECAO = EU_EXEMPLO; // escalante só na seção: tem nível de acesso, mas não cuida do pessoal
const COMUM: EuDaApi = { ...EU_EXEMPLO, papeis: [] };
const linha = (id: string, nomeGuerra: string, matricula: string, extra: Partial<LinhaDaBusca> = {}): LinhaDaBusca => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: `Fulano ${nomeGuerra}`, matricula, lotacao: '1ª SB', quadro: 'QBMG', equipe: null, jornada: 'adm', situacao: 'Ativa', unidadeId: 'u-1sb', lotacaoCaminho: '2º GB / 1ª SB', podeAlterar: true, ...extra,
});
const ANDRADE = linha('m1', 'ANDRADE', '100801-1');
const BARRETO = linha('m2', 'BARRETO', '100802-2');
const resultado = (militares: LinhaDaBusca[]): ResultadoDaBusca => ({ militares, haMais: false, naoEncontradas: [] });
const PREVIA = { novos: [], alterados: [{ chave: '100801-1', descricao: 'SD ANDRADE', mudancas: ['lotação: 1ª SB → 2ª SB'] }], iguais: 0, avisos: [], problemas: [], ignoradas: [], gravados: 1 };

function api(eu: EuDaApi, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    'GET /api/consulta/unidades': { status: 200, corpo: [] },
    'POST /api/consulta/militares/buscar': { status: 200, corpo: resultado([ANDRADE, BARRETO]) },
    'POST /api/unidades/u-gb/importacao/peculio': { status: 200, corpo: PREVIA },
    ...extra,
  });
}
const buscasPorMatricula = (f: ReturnType<typeof simularApi>) =>
  f.mock.calls.filter(([e, i]) => String(e).endsWith('/militares/buscar') && i?.method === 'POST' && String(i.body).includes('matriculas')).map(([, i]) => JSON.parse(String(i!.body)));
const textoBuscas = (f: ReturnType<typeof simularApi>) =>
  f.mock.calls.filter(([e, i]) => String(e).endsWith('/militares/buscar') && i?.method === 'POST' && !String(i.body).includes('matriculas')).length;

describe('Importar e Exportar no alto (6.63)', () => {
  // a unidade em que as telas trabalham (a do Topo): o gestor do 2º GB trabalha no 2º GB
  beforeEach(() => guardarUnidade('u-gb'));
  afterAll(() => esquecerUnidadeDaAba());
  it('ficam ao lado do título e já estão lá antes da primeira busca: o Exportar desabilitado, com a dica', async () => {
    api(GESTOR_GB);
    abrir('/peculio/pesquisar');
    const titulo = await screen.findByRole('heading', { level: 1, name: 'Pesquisar militares' });
    const cabecalho = titulo.closest('header')!;
    expect(within(cabecalho).getByRole('button', { name: /^Importar/ })).toBeEnabled();
    const exportar = within(cabecalho).getByRole('button', { name: 'Exportar' });
    expect(exportar).toBeDisabled();
    expect(exportar).toHaveAttribute('title', 'Faça uma busca ou selecione militares para exportar.');
  });

  it('o Importar é o do Pecúlio, na unidade do Pecúlio (a do nível de acesso mais alto), com o modelo dela', async () => {
    api(GESTOR_GB);
    abrir('/peculio/pesquisar');
    await userEvent.click(await screen.findByRole('button', { name: /^Importar/ }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByText('Importar o Pecúlio da planilha')).toBeInTheDocument();
    expect(dialogo.getByRole('link', { name: 'Baixar modelo' })).toHaveAttribute('href', '/api/unidades/u-gb/importacao/peculio/modelo');
  });

  it('o Importar só aparece para quem cuida do pessoal; o Exportar, para quem tem nível de acesso; o militar comum não vê nenhum dos dois', async () => {
    api(SO_DA_SECAO);
    abrir('/peculio/pesquisar');
    expect(await screen.findByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Importar/ })).toBeNull();
  });

  it('o militar comum não vê nem Importar nem Exportar', async () => {
    api(COMUM);
    abrir('/peculio/pesquisar');
    await screen.findByRole('heading', { level: 1, name: 'Pesquisar militares' });
    expect(screen.queryByRole('button', { name: /^Importar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exportar' })).toBeNull();
  });

  it('Review Focus 5: ao concluir a importação, a busca é refeita e quem estava selecionado continua, com o dado novo', async () => {
    const NOVO = linha('m1', 'ANDRADE', '100801-1', { lotacao: '2ª SB', lotacaoCaminho: '2º GB / 2ª SB', unidadeId: 'u-2sb' });
    let importou = false;
    const f = api(GESTOR_GB);
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, init) => {
      const url = String(e);
      if (url.includes('/importacao/peculio') && url.includes('confirmar=1')) importou = true;
      if (importou && url.endsWith('/militares/buscar') && init?.method === 'POST') {
        return new Response(JSON.stringify(resultado([NOVO, BARRETO])), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return padrao(e, init);
    });
    abrir('/peculio/pesquisar');
    await userEvent.type(await screen.findByLabelText('Matrícula ou nome de guerra'), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar SD ANDRADE' }));
    const painel = within(await screen.findByRole('complementary', { name: 'Selecionados (1)' }));
    expect(painel.getByRole('region', { name: '2º GB / 1ª SB' })).toBeInTheDocument();
    const buscasAntes = textoBuscas(f);
    await userEvent.click(screen.getByRole('button', { name: /^Importar/ }));
    const dialogo = within(await screen.findByRole('dialog'));
    await userEvent.upload(dialogo.getByLabelText('Arquivo da planilha (.xlsx)'), new File(['x'], 'peculio.xlsx'));
    await userEvent.click(dialogo.getByRole('button', { name: 'Ver o que vai entrar' }));
    await userEvent.click(await dialogo.findByRole('button', { name: /^Importar 1/ }));
    await dialogo.findByText('1 registros gravados.');
    await userEvent.click(dialogo.getAllByRole('button', { name: 'Fechar' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // a seleção foi lida de novo pelas matrículas, e a busca refeita
    await waitFor(() => expect(buscasPorMatricula(f)).toEqual([{ matriculas: ['100801-1'] }]));
    await waitFor(() => expect(textoBuscas(f)).toBeGreaterThan(buscasAntes));
    // o selecionado continua na seleção, agora no grupo da lotação nova
    const depois = within(await screen.findByRole('complementary', { name: 'Selecionados (1)' }));
    await waitFor(() => expect(depois.getByRole('region', { name: '2º GB / 2ª SB' })).toBeInTheDocument());
    expect(within(depois.getByRole('region', { name: '2º GB / 2ª SB' })).getByRole('button', { name: 'Tirar SD ANDRADE' })).toBeInTheDocument();
  });
});
