import type { FichaDeConsulta, LinhaDaConsulta, UnidadeDaConsulta } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, chamadasA, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.11, Task 7: a consulta de militares (todo militar com conta) e a ficha de consulta, só para leitura. Dados fictícios (D7).
const COMUM = { ...EU_EXEMPLO, papeis: [], lotacao: EU_EXEMPLO.unidades[0]! };
const MENSAGEM_CURTA = 'Digite pelo menos 3 letras ou escolha uma unidade.';
const AVISO_MAIS = 'Há mais militares. Refine a busca.';

const linha = (id: string, nomeGuerra: string, extra: Partial<LinhaDaConsulta> = {}): LinhaDaConsulta => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: `Fulano de Tal ${nomeGuerra}`, matricula: '990001-1', lotacao: '1ª SB', quadro: 'QBMG', ...extra,
});
const UNIDADES: UnidadeDaConsulta[] = [
  { id: 'u-cbmpe', sigla: 'CBMPE', nivel: 0 }, { id: 'u-gb', sigla: '2º GB', nivel: 3 }, { id: 'u-divop', sigla: 'DivOp', nivel: 4 }, { id: 'u-1sb', sigla: '1ª SB', nivel: 5 },
];
const BUSCA = 'GET /api/consulta/militares';

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: COMUM },
    'GET /api/consulta/unidades': { status: 200, corpo: UNIDADES },
    [BUSCA]: { status: 200, corpo: { militares: [linha('m1', 'ANDRADE'), linha('m2', 'BARRETO', { postoGrad: '3º SGT', lotacao: null, quadro: null, nomeCompleto: null })], haMais: false } },
    ...extra,
  });
}
/** Os endereços (com a busca) que a tela pediu à rota da busca. */
const pedidos = (f: ReturnType<typeof simularApi>) =>
  f.mock.calls.map(([e]) => String(typeof e === 'string' ? e : e instanceof URL ? e.href : (e as Request).url)).filter((u) => u.startsWith('/api/consulta/militares?')).map((u) => new URL(u, 'http://x').searchParams);
const campoDaBusca = () => screen.findByLabelText('Nome, nome de guerra ou matrícula');

describe('a consulta de militares', () => {
  it('o militar comum abre a consulta; antes de buscar, a tela orienta e nada é pedido', async () => {
    const f = api();
    abrir('/consulta');
    expect(await screen.findByRole('heading', { level: 1, name: 'Consulta de militares' })).toBeInTheDocument();
    expect(screen.getByText(/Busque pelo nome, pelo nome de guerra ou pela matrícula/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
    await waitFor(() => expect(chamadasA(f, 'GET /api/consulta/unidades')).toBe(1));
    expect(pedidos(f)).toHaveLength(0);
  });

  it('o seletor de unidade traz "Toda a corporação" e a árvore, com recuo', async () => {
    api();
    abrir('/consulta');
    const unidade = await screen.findByLabelText('Lotados em');
    await waitFor(() => expect(within(unidade).getAllByRole('option')).toHaveLength(5));
    expect(within(unidade).getAllByRole('option').map((o) => o.textContent?.trim())).toEqual(['Toda a corporação', 'CBMPE', '2º GB', 'DivOp', '1ª SB']);
    expect(unidade).toHaveValue('');
  });

  it('o recuo da árvore usa espaço que o navegador não junta: as divisões de cada grupamento têm a mesma sigla e só o recuo diz de qual é', async () => {
    api();
    abrir('/consulta');
    const unidade = await screen.findByLabelText('Lotados em');
    await waitFor(() => expect(within(unidade).getAllByRole('option')).toHaveLength(5));
    const nbsp = (n: number) => ' '.repeat(n);
    expect(within(unidade).getAllByRole('option').map((o) => o.textContent)).toEqual(['Toda a corporação', 'CBMPE', `${nbsp(6)}2º GB`, `${nbsp(8)}DivOp`, `${nbsp(10)}1ª SB`]);
  });

  it('busca por texto: mostra a identificação de cada militar, e a lotação e o quadro quando há', async () => {
    const f = api();
    abrir('/consulta');
    await userEvent.type(await campoDaBusca(), 'andr');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    const lista = await screen.findByRole('list', { name: 'Militares encontrados' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('SD');
    expect(itens[0]).toHaveTextContent('ANDRADE');
    expect(itens[0]).toHaveTextContent('Fulano de Tal ANDRADE');
    expect(itens[0]).toHaveTextContent('990001-1');
    expect(itens[0]).toHaveTextContent('1ª SB');
    expect(itens[0]).toHaveTextContent('QBMG');
    // quem está sem lotação hoje aparece mesmo assim, e a linha diz isso
    expect(itens[1]).toHaveTextContent('3º SGT');
    expect(itens[1]).toHaveTextContent('Sem lotação');
    expect([...pedidos(f)[0]!.entries()]).toEqual([['texto', 'andr']]);
    // a lista não mostra nenhum dado além da identificação
    expect(lista.textContent).not.toMatch(/CPF|nascimento|endereço|telefone/i);
  });

  it('com a unidade escolhida, manda a unidade; só a unidade já basta', async () => {
    const f = api();
    abrir('/consulta');
    await waitFor(() => expect(within(screen.getByLabelText('Lotados em')).getAllByRole('option')).toHaveLength(5));
    await userEvent.selectOptions(screen.getByLabelText('Lotados em'), 'u-divop');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect([...pedidos(f)[0]!.entries()]).toEqual([['unidadeId', 'u-divop']]);
  });

  it('texto curto e nenhuma unidade: mostra a mensagem fixa e não pede nada à API', async () => {
    const f = api();
    abrir('/consulta');
    await userEvent.type(await campoDaBusca(), 'an');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    const erro = await screen.findByRole('alert');
    expect(erro).toHaveTextContent(MENSAGEM_CURTA);
    await expect(campoDaBusca()).resolves.toHaveAccessibleDescription(MENSAGEM_CURTA);
    expect(pedidos(f)).toHaveLength(0);
    // com 3 letras a mensagem some e a busca roda
    await userEvent.type(screen.getByLabelText('Nome, nome de guerra ou matrícula'), 'd');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(screen.queryByText(MENSAGEM_CURTA)).toBeNull();
  });

  it('com mais de 50, o aviso "Há mais militares. Refine a busca." aparece acima da lista', async () => {
    api({ [BUSCA]: { status: 200, corpo: { militares: [linha('m1', 'ANDRADE')], haMais: true } } });
    abrir('/consulta?texto=andrade');
    expect(await screen.findByRole('status')).toHaveTextContent(AVISO_MAIS);
    expect(screen.getByRole('list', { name: 'Militares encontrados' })).toBeInTheDocument();
  });

  it('sem o aviso quando não há mais; sem resultado, a tela orienta', async () => {
    api({ [BUSCA]: { status: 200, corpo: { militares: [], haMais: false } } });
    abrir('/consulta?texto=zzz');
    expect(await screen.findByText(/Nenhum militar encontrado\. Confira o nome ou a matrícula/)).toBeInTheDocument();
    expect(screen.queryByText(AVISO_MAIS)).toBeNull();
  });

  it('a busca fica no endereço: abrir /consulta?texto=...&unidade=... já mostra o resultado e preenche os campos', async () => {
    const f = api();
    abrir('/consulta?texto=andrade&unidade=u-divop');
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect([...pedidos(f)[0]!.entries()]).toEqual([['texto', 'andrade'], ['unidadeId', 'u-divop']]);
    expect(screen.getByLabelText('Nome, nome de guerra ou matrícula')).toHaveValue('andrade');
    await waitFor(() => expect(screen.getByLabelText('Lotados em')).toHaveValue('u-divop'));
  });

  it('um endereço com texto curto e sem unidade não pede nada', async () => {
    const f = api();
    abrir('/consulta?texto=ab');
    await screen.findByRole('heading', { level: 1, name: 'Consulta de militares' });
    expect(screen.getByText(/Busque pelo nome/)).toBeInTheDocument();
    expect(pedidos(f)).toHaveLength(0);
  });

  it('erro da API aparece na tela', async () => {
    api({ [BUSCA]: { status: 404, corpo: { erro: 'Unidade não encontrada.' } } });
    abrir('/consulta?unidade=x');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unidade não encontrada.');
  });

  it('cada linha leva à ficha de consulta, e o endereço guarda a busca para o "Voltar"', async () => {
    api();
    const router = abrir('/consulta?texto=andrade');
    const link = (await screen.findAllByRole('link', { name: /ANDRADE/ }))[0]!;
    expect(link).toHaveAttribute('href', '/consulta/m1?texto=andrade');
    await userEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/consulta/m1'));
  });
});

describe('a ficha de consulta', () => {
  const FICHA_MINIMA: FichaDeConsulta = { ...linha('m1', 'ANDRADE'), podeAbrirFichaCompleta: false };
  const FICHA_COMPLETA: FichaDeConsulta = {
    ...linha('m1', 'ANDRADE'),
    contato: { telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br' },
    situacao: {
      equipe: 'Alfa', jornada: 'pronto', situacaoDoMilitar: 'Ativa',
      historico: [
        { desde: '2026-11-01', ate: null, lotacao: '1ª SB', equipe: 'Alfa', jornada: 'pronto', quadro: 'QBMG', situacaoDoMilitar: 'Ativa' },
        { desde: '2026-01-05', ate: '2026-10-31', lotacao: '3ª SB', equipe: null, jornada: 'adm', quadro: 'QBMG', situacaoDoMilitar: 'Ativa' },
      ],
    },
    afastamentos: [{ tipo: 'LTS', inicio: '2026-12-10', fim: '2026-12-20', motivo: 'Tratamento de saúde', boletim: 'BG 99/2026' }],
    dadosDaEscala: { motorista: true, cnh: ['D'], voluntarioJes: true },
    comportamento: { comportamento: 'Bom', boletim: 'BG 12/2026' },
    podeAbrirFichaCompleta: true,
  };
  const ficha = (corpo: FichaDeConsulta, rota = 'GET /api/consulta/militares/m1') => api({ [rota]: { status: 200, corpo } });
  const blocos = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);

  it('o militar comum recebe só a identificação: nenhum outro bloco, nenhum botão de editar, nenhuma frase de "sem acesso"', async () => {
    ficha(FICHA_MINIMA);
    abrir('/consulta/m1');
    await screen.findByRole('heading', { level: 2, name: /ANDRADE/ });
    expect(blocos()).toEqual(['Identificação']);
    expect(screen.getByText('Fulano de Tal ANDRADE')).toBeInTheDocument();
    // a matrícula aparece no cabeçalho e na Identificação
    expect(screen.getAllByText('990001-1')).toHaveLength(2);
    // só leitura: nenhum campo e nenhum botão de gravar
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    for (const nome of [/Salvar/, /Editar/, /Alterar/, /Incluir/, /Remover/, /Gerar/, /Desativar/]) expect(screen.queryByRole('button', { name: nome }), String(nome)).toBeNull();
    expect(document.body.textContent).not.toMatch(/sem acesso|não tem acesso|sem permissão/i);
    // sem o atalho da ficha completa
    expect(screen.queryByRole('link', { name: 'Abrir a ficha completa' })).toBeNull();
  });

  it('com todos os blocos, mostra contato, situação com o histórico, afastamentos, dados da escala e comportamento', async () => {
    ficha(FICHA_COMPLETA);
    abrir('/consulta/m1');
    await screen.findByRole('heading', { level: 2, name: /ANDRADE/ });
    expect(blocos()).toEqual(['Identificação', 'Contato', 'Situação', 'Afastamentos', 'Dados da escala', 'Comportamento']);
    expect(screen.getByText('(81) 99999-0001')).toBeInTheDocument();
    expect(screen.getByText('andrade@bombeiros.pe.gov.br')).toBeInTheDocument();
    const historico = within(screen.getByRole('list', { name: 'Histórico de lotação' })).getAllByRole('listitem');
    expect(historico).toHaveLength(2);
    expect(historico[0]).toHaveTextContent('1ª SB');
    expect(historico[0]).toHaveTextContent('desde 01/11/2026');
    expect(historico[1]).toHaveTextContent('3ª SB');
    expect(historico[1]).toHaveTextContent('de 05/01/2026 a 31/10/2026');
    const afastamentos = within(screen.getByRole('list', { name: 'Afastamentos' })).getAllByRole('listitem');
    expect(afastamentos[0]).toHaveTextContent('LTS');
    expect(afastamentos[0]).toHaveTextContent('de 10/12/2026 a 20/12/2026');
    expect(afastamentos[0]).toHaveTextContent('Tratamento de saúde');
    expect(afastamentos[0]).toHaveTextContent('BG 99/2026');
    expect(screen.getByText('Voluntário JES').nextElementSibling).toHaveTextContent('Sim');
    expect(screen.getByText('CNH').nextElementSibling).toHaveTextContent('D');
    expect(screen.getByText('Comportamento', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Bom');
    expect(screen.getByText('BG 12/2026')).toBeInTheDocument();
  });

  it('afastamentos sem motivo nem boletim (o oficial): só o tipo e o período', async () => {
    ficha({ ...FICHA_MINIMA, afastamentos: [{ tipo: 'LTS', inicio: '2026-12-10', fim: '2026-12-20' }] });
    abrir('/consulta/m1');
    const itens = within(await screen.findByRole('list', { name: 'Afastamentos' })).getAllByRole('listitem');
    expect(itens[0]!.textContent).toBe('LTSde 10/12/2026 a 20/12/2026');
  });

  it('"Abrir a ficha completa" só aparece quando a API diz que pode, e leva à ficha (a quem tem nível de acesso)', async () => {
    // quem tem nível de acesso na lotação do militar: o auxiliar (a barreira do módulo de escalas deixa passar)
    api({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/consulta/militares/m1': { status: 200, corpo: FICHA_COMPLETA } });
    const router = abrir('/consulta/m1');
    const link = await screen.findByRole('link', { name: 'Abrir a ficha completa' });
    expect(link).toHaveAttribute('href', '/militares/m1');
    await userEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/militares/m1'));
  });

  it('"Voltar à busca" leva ao mesmo resultado', async () => {
    ficha(FICHA_MINIMA);
    abrir('/consulta/m1?texto=andrade&unidade=u-divop');
    const voltar = await screen.findByRole('link', { name: 'Voltar à busca' });
    expect(voltar).toHaveAttribute('href', '/consulta?texto=andrade&unidade=u-divop');
  });

  it('o militar sem lotação hoje: o resumo diz isso e só a identificação aparece', async () => {
    ficha({ ...FICHA_MINIMA, lotacao: null, quadro: null });
    abrir('/consulta/m1');
    expect(await screen.findByText('Sem lotação hoje')).toBeInTheDocument();
    expect(blocos()).toEqual(['Identificação']);
  });

  it('militar que não existe mostra a mensagem da API', async () => {
    api({ 'GET /api/consulta/militares/m1': { status: 404, corpo: { erro: 'Militar não encontrado.' } } });
    abrir('/consulta/m1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Militar não encontrado.');
  });

  it('o título da aba é o da consulta, sem o nome do militar', async () => {
    ficha(FICHA_MINIMA);
    abrir('/consulta/m1');
    await screen.findByRole('heading', { level: 2, name: /ANDRADE/ });
    await waitFor(() => expect(document.title).toBe('Consulta de militares · Sistema de Gestão - 2º GB'));
    expect(document.title).not.toMatch(/ANDRADE/);
  });
});
