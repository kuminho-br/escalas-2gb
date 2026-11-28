import type { LinhaDaConsulta, ListaDoPeculio } from 'contratos';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { mesAtual } from '@/lib/meses';
import { abrir, escolherNaArvore, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.50, Task 3: o Pecúlio da unidade com "Incluir as unidades de baixo" à escolha e a lista com divisória (a mesma peça da pesquisa). Dados fictícios (D7).
const MES = mesAtual();
const GESTOR_GB: EuDaApi = {
  ...EU_EXEMPLO,
  papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }],
  unidades: [{ id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento', maeId: null }, ...EU_EXEMPLO.unidades],
};
const LISTA: ListaDoPeculio = {
  militares: [
    { militarId: 'm1', matricula: '990001-1', posto: 'SD', nomeGuerra: 'ANDRADE', nomeCompleto: 'João da Silva Andrade', lotacao: '1ª SB', lotacaoId: 'u-1sb', telefone: null, email: null, pendencias: [] },
    { militarId: 'm2', matricula: '990002-2', posto: 'CB', nomeGuerra: 'BARRETO', nomeCompleto: null, lotacao: '2º GB', lotacaoId: 'u-gb', telefone: null, email: null, pendencias: [] },
  ],
};
const SO_DO_GB: ListaDoPeculio = { militares: [LISTA.militares[1]!] };
const ROTA = '/api/unidades/u-gb/peculio';

/** A lista de baixo (ligado) e a só da unidade (abaixo=nao) são duas respostas: a simulação ignora a query, então o pedido é olhado aqui. */
function api(soDireto: ListaDoPeculio = SO_DO_GB, comAsDeBaixo: ListaDoPeculio = LISTA, espera?: Promise<unknown>) {
  const f = simularApi({ '/api/eu': { status: 200, corpo: GESTOR_GB }, [`GET ${ROTA}`]: { status: 200, corpo: comAsDeBaixo } });
  const padrao = f.getMockImplementation()!;
  f.mockImplementation(async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (url.includes(ROTA) && url.includes('abaixo=nao')) {
      await espera;
      return new Response(JSON.stringify(soDireto), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return padrao(entrada, init);
  });
  return f;
}
const pedidos = (f: ReturnType<typeof simularApi>) => f.mock.calls.map(([e]) => String(e)).filter((u) => u.includes(ROTA));
const interruptor = () => screen.findByRole('checkbox', { name: 'Incluir as unidades de baixo' });

afterEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* sem armazenamento */
  }
  vi.restoreAllMocks();
});

describe('Incluir as unidades de baixo (6.50)', () => {
  it('começa ligado: a lista traz as unidades de baixo, e o pedido não leva "abaixo"', async () => {
    const f = api();
    abrir('/peculio');
    expect(await interruptor()).toBeChecked();
    await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(pedidos(f).every((u) => !u.includes('abaixo='))).toBe(true);
    expect(pedidos(f)[0]).toContain(`mes=${MES}`);
  });

  it('desligar pede só os lotados direto na unidade (abaixo=nao) e mostra o que veio', async () => {
    const f = api();
    abrir('/peculio');
    await userEvent.click(await interruptor());
    await waitFor(() => expect(pedidos(f).some((u) => u.includes('abaixo=nao'))).toBe(true));
    const lista = await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    await waitFor(() => expect(within(lista).getAllByRole('listitem')).toHaveLength(1));
    expect(within(lista).getByText('BARRETO')).toBeInTheDocument();
    expect(await interruptor()).not.toBeChecked();
  });

  it('a escolha fica lembrada no navegador: ao voltar à tela, ela começa como a pessoa deixou', async () => {
    const f = api();
    abrir('/peculio');
    await userEvent.click(await interruptor());
    await waitFor(() => expect(window.localStorage.getItem('peculio:incluir-as-de-baixo')).toBe('nao'));
    cleanup();
    const g = api();
    abrir('/peculio');
    expect(await interruptor()).not.toBeChecked();
    await waitFor(() => expect(pedidos(g)[0]).toContain('abaixo=nao'));
    expect(pedidos(f).length).toBeGreaterThan(0);
  });

  it('sem armazenamento (o localStorage lança erro), a tela abre ligada e muda sem quebrar', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sem armazenamento');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sem armazenamento');
    });
    api();
    abrir('/peculio');
    expect(await interruptor()).toBeChecked();
    await userEvent.click(await interruptor());
    expect(await interruptor()).not.toBeChecked();
  });

  it('(pool 30 f) religar "Incluir as unidades de baixo" não traz de volta a lotação escolhida antes: o filtro volta a "Todas"', async () => {
    api();
    abrir('/peculio');
    const itens = async () => within(await screen.findByRole('list', { name: 'Militares do Pecúlio' }));
    await escolherNaArvore(await screen.findByLabelText('Lotação'), /1ª SB/);
    await waitFor(async () => expect((await itens()).getAllByRole('listitem')).toHaveLength(1));
    expect((await itens()).getByText('ANDRADE')).toBeInTheDocument();
    // desliga (o filtro sai de cena) e religa: a lista inteira, e não a de antes
    await userEvent.click(await interruptor());
    await waitFor(async () => expect((await itens()).queryByText('ANDRADE')).toBeNull());
    await userEvent.click(await interruptor());
    await waitFor(async () => expect((await itens()).getAllByRole('listitem')).toHaveLength(2));
    expect((await itens()).getByText('ANDRADE')).toBeInTheDocument();
    expect((await itens()).getByText('BARRETO')).toBeInTheDocument();
  });

  it('Review Focus 4: desligado numa unidade sem ninguém lotado direto nela, a lista diz isso e como achar os de baixo', async () => {
    api({ militares: [] });
    abrir('/peculio');
    await userEvent.click(await interruptor());
    expect(await screen.findByText('Nenhum militar lotado direto em 2º GB. Ligue "Incluir as unidades de baixo".')).toBeInTheDocument();
  });

  it('ligado e sem ninguém, a frase é a de sempre (cadastrar ou importar)', async () => {
    api(undefined, { militares: [] });
    abrir('/peculio');
    expect(await screen.findByText(/Nenhum militar lotado\. Cadastre com "Novo militar" ou use "Importar"\./)).toBeInTheDocument();
  });
});

describe('a lista com divisória e o lugar dos aniversários (6.50)', () => {
  it('a lista da unidade tem as linhas separadas por uma divisória (a mesma peça da pesquisa)', async () => {
    api();
    abrir('/peculio');
    const lista = await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(lista.className).toContain('divide-y');
    expect(lista.className).toContain('divide-linha');
  });

  it('a pesquisa usa a mesma peça: divisória entre as linhas', async () => {
    const COMUM = { ...EU_EXEMPLO, papeis: [] };
    const linha: LinhaDaConsulta = { id: 'm1', postoGrad: 'SD', nomeGuerra: 'ANDRADE', nomeCompleto: 'Fulano', matricula: '990001-1', lotacao: '1ª SB', lotacaoCaminho: '1ª SB', quadro: 'QBMG' };
    simularApi({
      '/api/eu': { status: 200, corpo: COMUM },
      'GET /api/consulta/unidades': { status: 200, corpo: [] },
      'POST /api/consulta/militares/buscar': { status: 200, corpo: { militares: [linha, { ...linha, id: 'm2', nomeGuerra: 'BARRETO' }], haMais: false, naoEncontradas: [] } },
    });
    abrir('/peculio/pesquisar?texto=andrade');
    const lista = await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(lista.className).toContain('divide-y');
  });

  it('os aniversariantes saíram do lado da lista: eles estão na tela Aniversários', async () => {
    api(undefined, { ...LISTA, aniversariantes: [{ militarId: 'm2', posto: 'CB', nomeGuerra: 'BARRETO', dia: 5, lotacao: '2º GB' }] });
    abrir('/peculio');
    await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(screen.queryByRole('heading', { name: 'Aniversariantes do mês' })).toBeNull();
  });
});

describe('achados da revisão da 6.50', () => {
  it('mudar o interruptor não desmonta a caixa: ela continua na tela, com o foco, enquanto a lista nova chega', async () => {
    let chegou!: () => void;
    const espera = new Promise<void>((r) => (chegou = r));
    api(SO_DO_GB, LISTA, espera);
    abrir('/peculio');
    const caixa = await interruptor();
    await userEvent.click(caixa);
    // a resposta ainda não chegou: a caixa é a mesma (o foco do teclado não se perde) e a busca não some
    expect(caixa).toBeInTheDocument();
    expect(caixa).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Buscar por nome ou matrícula' })).toBeInTheDocument();
    chegou();
    const lista = await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    await waitFor(() => expect(within(lista).getAllByRole('listitem')).toHaveLength(1));
    expect(caixa).toBeInTheDocument();
  });

  it('no trilho, só o item da tela aberta fica destacado: em "Pesquisar militares", o "Pecúlio da unidade" não', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: GESTOR_GB }, 'GET /api/consulta/unidades': { status: 200, corpo: [] } });
    abrir('/peculio/pesquisar');
    const pesquisar = await screen.findByRole('link', { name: 'Pesquisar militares' });
    expect(pesquisar).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Pecúlio da unidade' })).not.toHaveAttribute('aria-current');
  });
});

describe('o filtro de lotação com o interruptor desligado (6.53, item 22)', () => {
  const COM_ARVORE: EuDaApi = {
    ...GESTOR_GB,
    unidades: [
      { id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento', maeId: null },
      { id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4, tipo: 'secao', maeId: 'u-gb' },
    ],
  };
  const abrirOFiltro = async () => {
    await userEvent.click(await screen.findByLabelText('Lotação'));
    await screen.findAllByRole('tree');
    const abrirTudo = screen.queryByRole('button', { name: 'Abrir tudo' });
    if (abrirTudo) await userEvent.click(abrirTudo);
    localStorage.removeItem('arvore:aberta-toda');
    return screen.getAllByRole('treeitem').map((i) => i.getAttribute('aria-label'));
  };

  it('ligado, o filtro oferece a unidade e as de baixo; desligado, só a unidade', async () => {
    const f = simularApi({ '/api/eu': { status: 200, corpo: COM_ARVORE }, [`GET ${ROTA}`]: { status: 200, corpo: LISTA } });
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, i) => (String(e).includes(ROTA) && String(e).includes('abaixo=nao')
      ? new Response(JSON.stringify(SO_DO_GB), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : padrao(e, i)));
    abrir('/peculio');
    const ligado = await abrirOFiltro();
    expect(ligado.some((n) => n?.startsWith('1ª SB'))).toBe(true);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await interruptor());
    await screen.findByText('BARRETO');
    const desligado = await abrirOFiltro();
    expect(desligado).toEqual(['2º GB']);
  });
});
