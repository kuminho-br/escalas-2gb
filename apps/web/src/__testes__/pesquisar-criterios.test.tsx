import type { LinhaDaBusca, ResultadoDaBusca } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { abrir, abrirCriterios, clicarBuscar, EU_EXEMPLO, simularApi } from './apoio';

// 6.63: "Critérios de pesquisa", onde o texto procura, o trecho marcado na linha e o painel "Selecionados" ao lado. Dados fictícios.
const NIVEL = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }] };
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const linha = (id: string, nomeGuerra: string, extra: Partial<LinhaDaBusca> = {}): LinhaDaBusca => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: 'Fulano de Tal', matricula: '100601-1', lotacao: '1ª SB', quadro: 'QBMG', equipe: 'Alfa', jornada: 'pronto', situacao: 'Ativa', unidadeId: 'u-1sb', lotacaoCaminho: '2º GB / 1ª SB', podeAlterar: true, ...extra,
});
const JULIO = linha('m1', 'JÚLIO');
const MARIA = linha('m2', 'MARIA', { nomeCompleto: 'Maria Júlio da Silva', matricula: '100602-2' });
const BUSCAR = 'POST /api/consulta/militares/buscar';
const resposta = (militares: LinhaDaBusca[]): ResultadoDaBusca => ({ militares, haMais: false, naoEncontradas: [] });

function api(eu: unknown = NIVEL, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    'GET /api/consulta/unidades': { status: 200, corpo: [{ id: 'u-gb', sigla: '2º GB', nivel: 3, maeId: null }] },
    'GET /api/postos': { status: 200, corpo: [{ id: 'p-sd', sigla: 'SD', nome: 'Soldado', ordem: 1 }] },
    'GET /api/quadros': { status: 200, corpo: [{ id: 'q-bmg', sigla: 'QBMG', nome: 'Praças', oficial: false }] },
    'GET /api/situacoes-do-militar': { status: 200, corpo: [{ id: 's-ativa', nome: 'Ativa', escalavel: true, ativo: true }] },
    'GET /api/funcoes-do-militar': { status: 200, corpo: [{ id: 'f-chefe', nome: 'Chefe de seção', ativo: true }] },
    [BUSCAR]: { status: 200, corpo: resposta([JULIO]) },
    ...extra,
  });
}
const corpos = (f: ReturnType<typeof simularApi>) =>
  f.mock.calls.filter(([e, i]) => String(e).endsWith('/api/consulta/militares/buscar') && i?.method === 'POST').map(([, i]) => JSON.parse(String(i!.body)));
const campo = (rotulo = 'Matrícula ou nome de guerra') => screen.findByLabelText(rotulo);
const lista = () => screen.findByRole('list', { name: 'Militares encontrados' });

describe('onde o texto procura (6.63)', () => {
  it('começa em matrícula e nome de guerra; o rótulo do campo acompanha o que está ligado', async () => {
    api();
    abrir('/peculio/pesquisar');
    expect(await campo()).toBeInTheDocument();
    await abrirCriterios('Nome e matrícula');
    expect(screen.getByRole('checkbox', { name: 'Matrícula' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Nome de guerra' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Nome completo/ })).not.toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: /^Nome completo/ }));
    expect(await campo('Matrícula, nome de guerra ou nome completo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Matrícula' }));
    expect(await campo('Nome de guerra ou nome completo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Nome de guerra' }));
    expect(await campo('Nome completo')).toBeInTheDocument();
  });

  it('não dá para desligar os três: o último ligado fica travado', async () => {
    api();
    abrir('/peculio/pesquisar');
    await abrirCriterios('Nome e matrícula');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Matrícula' }));
    expect(screen.getByRole('checkbox', { name: 'Nome de guerra' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Nome de guerra' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: /^Nome completo/ }));
    expect(screen.getByRole('checkbox', { name: 'Nome de guerra' })).toBeEnabled();
  });

  it('Review Focus 1: com o padrão a busca não leva "procurarEm"; ligando o nome completo, ela leva, a etiqueta aparece e conta como critério', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'julio');
    await clicarBuscar();
    await lista();
    expect(corpos(f)).toEqual([{ texto: 'julio' }]);
    // o padrão não é critério: nada em uso
    expect(screen.queryByRole('group', { name: 'Critérios em uso' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Critérios de pesquisa' })).toBeInTheDocument();
    await abrirCriterios('Nome e matrícula');
    await userEvent.click(screen.getByRole('checkbox', { name: /^Nome completo/ }));
    expect(screen.getByRole('tab', { name: /^Nome e matrícula.*1/ })).toBeInTheDocument();
    await clicarBuscar();
    await waitFor(() => expect(corpos(f)).toHaveLength(2));
    expect(corpos(f)[1]).toEqual({ texto: 'julio', procurarEm: { matricula: true, nomeDeGuerra: true, nomeCompleto: true } });
    const etiquetas = await screen.findByRole('group', { name: 'Critérios em uso' });
    expect(etiquetas).toHaveTextContent('Procura também no nome completo');
    expect(screen.getByRole('button', { name: /^Critérios de pesquisa.*1 em uso/ })).toBeInTheDocument();
    // o x tira o nome completo e busca de novo, no padrão
    await userEvent.click(within(etiquetas).getByRole('button', { name: /^Tirar o critério: Procura também/ }));
    await waitFor(() => expect(corpos(f)).toHaveLength(3));
    expect(corpos(f)[2]).toEqual({ texto: 'julio' });
    expect(screen.queryByRole('group', { name: 'Critérios em uso' })).toBeNull();
  });

  it('o trecho achado fica marcado na linha, sem diferenciar maiúsculas nem acentos, e só nos campos em que a busca procurou', async () => {
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([JULIO, MARIA]) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'julio');
    await clicarBuscar();
    let itens = within(await lista()).getAllByRole('listitem');
    // padrão: marca o nome de guerra (JÚLIO), não o nome completo de Maria
    expect(within(itens[0]!).getByText('JÚLIO', { selector: 'mark' })).toBeInTheDocument();
    expect(itens[1]!.querySelector('mark')).toBeNull();
    // ligando o nome completo e buscando de novo, o "Júlio" do nome completo também é marcado
    await abrirCriterios('Nome e matrícula');
    await userEvent.click(screen.getByRole('checkbox', { name: /^Nome completo/ }));
    await clicarBuscar();
    await screen.findByRole('group', { name: 'Critérios em uso' });
    itens = within(await lista()).getAllByRole('listitem');
    expect(within(itens[1]!).getByText('Júlio', { selector: 'mark' })).toBeInTheDocument();
  });

  it('a matrícula achada fica marcada, com ou sem o traço', async () => {
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([JULIO]) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), '10060');
    await clicarBuscar();
    const item = within(await lista()).getAllByRole('listitem')[0]!;
    expect(within(item).getByText('10060', { selector: 'mark' })).toBeInTheDocument();
  });

  it('sem resultado, a tela lembra que o nome completo está desligado', async () => {
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([]) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'silva');
    await clicarBuscar();
    expect(await screen.findByText(/O nome completo está desligado nos critérios\./)).toBeInTheDocument();
  });
});

describe('revisão do Opus (6.63)', () => {
  it('tirar uma etiqueta refaz a busca que valia (o texto de antes), e o que a pessoa digitou ou mexeu sem buscar fica', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'silva');
    await abrirCriterios('Outros filtros');
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'pronto');
    await userEvent.selectOptions(screen.getByLabelText('Voluntário JES'), 'sim');
    await clicarBuscar();
    await lista();
    // depois da busca: um texto novo na barra e um filtro novo na aba, sem buscar
    await userEvent.clear(await campo());
    await userEvent.type(await campo(), 'costa');
    await abrirCriterios(/^Outros filtros/);
    await userEvent.selectOptions(screen.getByLabelText('Quadro'), 'q-bmg');
    await userEvent.click(within(screen.getByRole('group', { name: 'Critérios em uso' })).getByRole('button', { name: /^Tirar o critério: Jornada/ }));
    await waitFor(() => expect(corpos(f)).toHaveLength(2));
    expect(corpos(f)[1]).toEqual({ texto: 'silva', voluntarioJes: true });
    expect(await campo()).toHaveValue('costa');
    await abrirCriterios(/^Outros filtros/);
    expect(screen.getByLabelText('Quadro')).toHaveValue('q-bmg');
  });
});

describe('o painel "Selecionados" ao lado (6.63)', () => {
  it('aparece vazio, com a orientação, para quem tem nível de acesso; o militar comum não o vê', async () => {
    api();
    abrir('/peculio/pesquisar');
    const painel = await screen.findByRole('complementary', { name: 'Selecionados (0)' });
    expect(within(painel).getByText('Marque militares na lista para juntá-los aqui. A seleção fica mesmo quando você muda a busca.')).toBeInTheDocument();
    expect(within(painel).getByRole('combobox', { name: 'Agrupar por' })).toHaveValue('unidade');
    expect(within(painel).getByRole('button', { name: 'Atualizar em lote' })).toBeDisabled();
  });

  it('o militar comum não vê o painel', async () => {
    api(COMUM);
    abrir('/peculio/pesquisar');
    await campo();
    expect(screen.queryByRole('complementary', { name: /^Selecionados/ })).toBeNull();
  });

  it('a matrícula vem na frente do nome; agrupado por unidade a lotação sai da linha, e cada grupo tem o título com a quantidade', async () => {
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([JULIO, MARIA, linha('m3', 'ZECA', { unidadeId: 'u-2sb', lotacaoCaminho: '2º GB / 2ª SB', lotacao: '2ª SB', matricula: '100603-3' })]) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 3' }));
    const painel = within(await screen.findByRole('complementary', { name: 'Selecionados (3)' }));
    const grupo = painel.getByRole('region', { name: '2º GB / 1ª SB' });
    const linhas = within(grupo).getAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    // a matrícula primeiro, depois o posto e o nome; a lotação não repete na linha
    expect(linhas[0]!.textContent).toMatch(/^100601-1\s*SD\s*JÚLIO$/);
    expect(grupo.querySelector('h3')).toHaveTextContent('2º GB / 1ª SB2');
    expect(painel.getByRole('region', { name: '2º GB / 2ª SB' })).toBeInTheDocument();
  });

  it('trocar o agrupamento não mexe na lista de resultados nem na seleção: por equipe, por posto e sem grupo', async () => {
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([JULIO, MARIA, linha('m3', 'ZECA', { equipe: null, postoGrad: 'CB' })]) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 3' }));
    const painel = within(await screen.findByRole('complementary', { name: 'Selecionados (3)' }));
    const antes = within(await lista()).getAllByRole('listitem').map((l) => l.textContent);
    await userEvent.selectOptions(painel.getByRole('combobox', { name: 'Agrupar por' }), 'equipe');
    expect(painel.getByRole('region', { name: 'Equipe Alfa' })).toBeInTheDocument();
    // Review Focus 4: sem equipe vai para um grupo no fim, e não some
    const titulos = painel.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(titulos).toEqual(['Equipe Alfa', 'Sem equipe']);
    await userEvent.selectOptions(painel.getByRole('combobox', { name: 'Agrupar por' }), 'nenhum');
    expect(painel.getAllByRole('listitem')).toHaveLength(3);
    expect(within(await lista()).getAllByRole('listitem').map((l) => l.textContent)).toEqual(antes);
    expect(screen.getByRole('heading', { name: 'Selecionados (3)' })).toBeInTheDocument();
  });

  it('Review Focus 4: o militar sem lotação cai em "Sem lotação", no fim, e não some', async () => {
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([JULIO, linha('m4', 'ABREU', { unidadeId: null, lotacao: null, lotacaoCaminho: null, matricula: '100604-4' })]) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 2' }));
    const painel = within(await screen.findByRole('complementary', { name: 'Selecionados (2)' }));
    expect(painel.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['2º GB / 1ª SB', 'Sem lotação']);
  });

  it('Review Focus 3: 300 selecionados em 12 unidades, agrupados por unidade, ficam todos no painel, que rola por dentro', async () => {
    const trezentos = Array.from({ length: 300 }, (_, i) => linha(`m${i}`, `M${String(i).padStart(3, '0')}`, { unidadeId: `u${i % 12}`, lotacao: `${(i % 12) + 1}ª SB`, lotacaoCaminho: `${(i % 12) + 1}º GB / 1ª SB`, matricula: `1007${String(i).padStart(2, '0')}-1` }));
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta(trezentos) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 300' }));
    const painel = within(await screen.findByRole('complementary', { name: 'Selecionados (300)' }));
    expect(painel.getAllByRole('region')).toHaveLength(12);
    expect(painel.getAllByRole('listitem')).toHaveLength(300);
    // a lista rola dentro do painel (a página não cresce com ele)
    expect(painel.getAllByRole('region')[0]!.parentElement!.className).toMatch(/overflow-y-auto/);
  });

  it('(pool 31 g) passar de 5000 selecionados dá a frase do limite, e a seleção não muda', async () => {
    const cinco = Array.from({ length: 5000 }, (_, i) => linha(`m${i}`, `M${i}`, { matricula: `10${String(i).padStart(5, '0')}-1` }));
    const f = api(NIVEL, { [BUSCAR]: { status: 200, corpo: { ...resposta(cinco.slice(0, 500)), haMais: true } } });
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, init) => {
      if (String(e).endsWith('/militares/buscar/todos')) return new Response(JSON.stringify(resposta([...cinco, linha('extra', 'EXTRA')])), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return padrao(e, init);
    });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar todos' }));
    expect(await screen.findByText('Dá para selecionar até 5000 militares de uma vez.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selecionados (0)' })).toBeInTheDocument();
  });

  it('(pool 31 f) "{n} militares ficam de fora" conta pelo total da busca, e não pelos 500 da tela, antes de "Selecionar todos"', async () => {
    const tela = Array.from({ length: 500 }, (_, i) => linha(`m${i}`, `M${i}`));
    const inteira = [...tela, ...Array.from({ length: 30 }, (_, i) => linha(`x${i}`, `X${i}`, { podeAlterar: false }))];
    const f = api(NIVEL, { [BUSCAR]: { status: 200, corpo: { ...resposta(tela), haMais: true } } });
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, init) => {
      if (String(e).endsWith('/militares/buscar/todos')) return new Response(JSON.stringify(resposta(inteira)), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return padrao(e, init);
    });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    expect(await screen.findByText('30 militares ficam de fora: você não tem nível de acesso sobre eles.')).toBeInTheDocument();
  });

  it('(pool 31 e) com a busca acima de 5000, a janela de exportar diz por que não há contagem, em vez de "…"', async () => {
    const f = api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([JULIO, MARIA]) } });
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, init) => {
      if (String(e).endsWith('/militares/buscar/todos')) return new Response(JSON.stringify({ erro: 'Mais de 5000 militares. Afine a busca.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      return padrao(e, init);
    });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar SD JÚLIO' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar' }));
    const janela = within(await screen.findByRole('dialog', { name: 'Exportar para Excel' }));
    await userEvent.click(await janela.findByRole('radio', { name: 'Resultado da busca (sem contagem)' }));
    expect(await janela.findByRole('alert')).toHaveTextContent('A busca passou de 5000 militares: refine os critérios para ver a contagem.');
    expect(janela.queryByText(/…/)).toBeNull();
  });
});

describe('no celular (6.63)', () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });
  const celular = () => {
    window.matchMedia = vi.fn().mockImplementation((consulta: string) => ({ matches: true, media: consulta, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never;
  };

  it('os critérios abrem numa folha, com as abas e "Buscar"; fechar volta à tela', async () => {
    celular();
    api();
    abrir('/peculio/pesquisar');
    await userEvent.click(await screen.findByRole('button', { name: /^Critérios de pesquisa/ }));
    const folha = within(await screen.findByRole('dialog', { name: 'Critérios de pesquisa' }));
    expect(folha.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Nome e matrícula', 'Pela árvore', 'Arquivo de matrículas', 'Outros filtros']);
    await userEvent.click(folha.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('o que falta para buscar aparece na própria folha dos critérios (a barra com o erro está atrás dela)', async () => {
    celular();
    api();
    abrir('/peculio/pesquisar');
    await userEvent.click(await screen.findByRole('button', { name: /^Critérios de pesquisa/ }));
    const folha = within(await screen.findByRole('dialog', { name: 'Critérios de pesquisa' }));
    await userEvent.click(folha.getByRole('button', { name: 'Buscar' }));
    expect(await folha.findByRole('alert')).toHaveTextContent('Digite pelo menos 3 letras ou escolha uma unidade.');
  });

  it('o aviso do limite de 5000 aparece na barra de baixo, fora da folha', async () => {
    celular();
    const cinco = Array.from({ length: 5000 }, (_, i) => linha(`m${i}`, `M${i}`, { matricula: `10${String(i).padStart(5, '0')}-1` }));
    const f = api(NIVEL, { [BUSCAR]: { status: 200, corpo: { ...resposta(cinco.slice(0, 500)), haMais: true } } });
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, init) => {
      if (String(e).endsWith('/militares/buscar/todos')) return new Response(JSON.stringify(resposta([...cinco, linha('extra', 'EXTRA')])), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return padrao(e, init);
    });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar todos' }));
    expect(await screen.findByText('Dá para selecionar até 5000 militares de uma vez.')).toBeInTheDocument();
    expect(screen.getByText('0 selecionados')).toBeInTheDocument();
  });

  it('os selecionados viram uma barra embaixo ("{n} selecionados" e "Ver") que abre o painel numa folha', async () => {
    celular();
    api(NIVEL, { [BUSCAR]: { status: 200, corpo: resposta([JULIO, MARIA]) } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campo(), 'abc');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('button', { name: 'Selecionar estes 2' }));
    expect(await screen.findByText('2 selecionados')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: /^Selecionados/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }));
    const folha = within(await screen.findByRole('dialog'));
    expect(folha.getByRole('heading', { name: 'Selecionados (2)' })).toBeInTheDocument();
    expect(folha.getByRole('button', { name: 'Atualizar em lote' })).toBeEnabled();
    await userEvent.click(folha.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
