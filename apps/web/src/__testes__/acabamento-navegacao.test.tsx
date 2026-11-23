import type { LinhaMilitar } from 'contratos';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.16, Task 3: unidade de trabalho e navegação.
const GB = { id: 'u-gb', sigla: '2º GB', nivel: 3, caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], tipo: 'grupamento' };
const SB1 = EU_EXEMPLO.unidades[0]!;
const SB2 = { id: 'u-2sb', sigla: '2ª SB', nivel: 4, caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '2ª SB'], tipo: 'secao' };
const GESTOR: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidades: [GB, SB1, SB2] };
const linha = (id: string, nome: string): LinhaMilitar => ({
  id, matricula: `990${id.slice(1).padStart(3, '0')}-1`, posto: 'SD', quadro: null, nomeGuerra: nome, equipe: null, jornada: 'adm', motorista: null, voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [],
});

afterEach(() => localStorage.clear());

describe('o seletor de unidade (6.16, Task 3)', () => {
  it('item 1: trocar de unidade mantém o ?mes= da tela (a ficha aberta, como hoje, fecha)', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [] }, 'GET /api/unidades/u-2sb/escalas': { status: 200, corpo: [] } });
    const router = abrir('/escala-do-mes?mes=2026-10');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /^2ª SB/ }));
    await waitFor(() => expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-2sb'));
    expect(router.state.location.pathname).toBe('/escala-do-mes');
    expect(router.state.location.search).toMatchObject({ mes: '2026-10' });
  });

  it('item 2: cada opção diz ao leitor de tela dentro de que unidade fica ("1ª SB, dentro de 2º GB")', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [] } });
    abrir('/militares');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    expect(await screen.findByRole('menuitem', { name: '1ª SB, dentro de 2º GB' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '2º GB, dentro de DInter/1' })).toBeInTheDocument();
  });

  it('item 6: o item "Oficiais" do trilho olha o nível de acesso na unidade escolhida, e não em qualquer unidade', async () => {
    const eu: EuDaApi = {
      ...EU_EXEMPLO,
      papeis: [{ papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }, { papel: 'gestor', unidadeId: 'u-2sb', unidadeSigla: '2ª SB' }],
      unidades: [SB1, SB2],
    };
    simularApi({ '/api/eu': { status: 200, corpo: eu } });
    localStorage.setItem('unidade-de-trabalho', 'u-1sb');
    abrir('/grade');
    const trilho = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(trilho).queryByRole('link', { name: 'Oficiais' })).toBeNull();
  });

  it('item 6 (conferência): escolhida a unidade onde a pessoa é gestor, o "Oficiais" aparece', async () => {
    const eu: EuDaApi = {
      ...EU_EXEMPLO,
      papeis: [{ papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }, { papel: 'gestor', unidadeId: 'u-2sb', unidadeSigla: '2ª SB' }],
      unidades: [SB1, SB2],
    };
    simularApi({ '/api/eu': { status: 200, corpo: eu } });
    localStorage.setItem('unidade-de-trabalho', 'u-2sb');
    abrir('/grade');
    const trilho = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(await within(trilho).findByRole('link', { name: 'Oficiais' })).toBeInTheDocument();
  });
});

describe('o vazio da Escala do mês (6.16, Task 3)', () => {
  it('6.25: numa unidade de qualquer tipo sem escalas (um grupamento), o vazio é o de sempre, com o caminho para criar uma', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR }, 'GET /api/unidades/u-gb/escalas': { status: 200, corpo: [] } });
    localStorage.setItem('unidade-de-trabalho', 'u-gb');
    abrir('/escala-do-mes');
    expect(await screen.findByText(/Nenhuma escala ativa\./)).toHaveTextContent('Nenhuma escala ativa. Crie uma em Escalas.');
    expect(within(screen.getByText(/Nenhuma escala ativa\./)).getByRole('link', { name: 'Escalas' })).toBeInTheDocument();
    expect(screen.queryByText(/Escolha uma seção/)).toBeNull();
  });

  it('item 3 (conferência): numa seção sem escala ativa, o texto de sempre', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [] } });
    abrir('/escala-do-mes');
    expect(await screen.findByText(/Nenhuma escala ativa/)).toBeInTheDocument();
  });
});

describe('o aviso "Essa área é de outro nível de acesso." (6.16, Task 3)', () => {
  it('item 4: aparece uma vez, sai do endereço e não volta ao recarregar', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    const router = abrir('/militares');
    expect(await screen.findByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
    await waitFor(() => expect((router.state.location.search as { aviso?: string }).aviso).toBeUndefined());
    // continua na tela, mesmo sem estar mais no endereço
    expect(screen.getByText('Essa área é de outro nível de acesso.')).toBeInTheDocument();
    // recarregar a página, com o endereço de agora, não mostra o aviso
    const de = router.state.location.href;
    cleanup();
    abrir(de);
    await screen.findAllByText(/Minha ficha/);
    expect(screen.queryByText('Essa área é de outro nível de acesso.')).toBeNull();
  });
});

describe('a ficha aberta pelo Pecúlio (6.16, Task 3)', () => {
  it('item 5: clicar em outro militar da lista mantém ?de=peculio, e o trilho continua o do Pecúlio', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [linha('m1', 'ANDRADE'), linha('m2', 'BARRETO')] },
      'GET /api/militares/m1': { status: 404, corpo: { erro: 'Militar não encontrado.' } },
      'GET /api/militares/m2': { status: 404, corpo: { erro: 'Militar não encontrado.' } },
    });
    const router = abrir('/militares/m1?de=peculio');
    await userEvent.click(await screen.findByRole('link', { name: /BARRETO/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/militares/m2'));
    expect(router.state.location.search).toMatchObject({ de: 'peculio' });
    const trilho = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(trilho).getByRole('link', { name: 'Pecúlio' })).toBeInTheDocument();
    expect(within(trilho).queryByRole('link', { name: 'Grade geral' })).toBeNull();
  });
});
