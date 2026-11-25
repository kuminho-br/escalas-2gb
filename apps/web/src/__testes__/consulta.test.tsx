import type { FichaDeConsulta, LinhaDaConsulta, UnidadeDaConsulta } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, chamadasA, escolherNaArvore, EU_EXEMPLO, nosDaArvore, simularApi } from './apoio';

// Entrega 6.11, Task 7: a consulta de militares (todo militar com conta) e a ficha de consulta, só para leitura. Dados fictícios (D7).
const COMUM = { ...EU_EXEMPLO, papeis: [], lotacao: EU_EXEMPLO.unidades[0]! };
const MENSAGEM_CURTA = 'Digite pelo menos 3 letras ou escolha uma unidade.';
const AVISO_MAIS = 'Há mais militares. Refine a busca.';

const linha = (id: string, nomeGuerra: string, extra: Partial<LinhaDaConsulta> = {}): LinhaDaConsulta => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: `Fulano de Tal ${nomeGuerra}`, matricula: '990001-1', lotacao: '1ª SB', quadro: 'QBMG', ...extra,
});
const UNIDADES: UnidadeDaConsulta[] = [
  { id: 'u-cbmpe', sigla: 'CBMPE', nivel: 0, maeId: null }, { id: 'u-gb', sigla: '2º GB', nivel: 3, maeId: 'u-cbmpe' }, { id: 'u-divop', sigla: 'DivOp', nivel: 4, maeId: 'u-gb' }, { id: 'u-1sb', sigla: '1ª SB', nivel: 5, maeId: 'u-divop' },
];
const BUSCA = 'GET /api/consulta/militares';

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: COMUM },
    'GET /api/consulta/unidades': { status: 200, corpo: UNIDADES },
    // quem não tem nível de acesso sobre o militar recebe 403 na ficha completa, e a tela mostra a de consulta (6.50)
    'GET /api/militares/m1': { status: 403, corpo: { erro: 'Você não tem permissão nesta seção.' } },
    'GET /api/militares/m9': { status: 403, corpo: { erro: 'Você não tem permissão nesta seção.' } },
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
    abrir('/peculio/pesquisar');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pesquisar militares' })).toBeInTheDocument();
    expect(screen.getByText(/Busque pelo nome, pelo nome de guerra ou pela matrícula/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
    await waitFor(() => expect(chamadasA(f, 'GET /api/consulta/unidades')).toBe(1));
    expect(pedidos(f)).toHaveLength(0);
  });

  it('6.45: "Lotados em" começa em "Toda a corporação" e abre a árvore nó a nó, com "Abrir tudo"; nenhuma lista plana', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    const unidade = await screen.findByLabelText('Lotados em');
    expect(unidade).toHaveTextContent('Toda a corporação');
    expect(unidade.tagName).not.toBe('SELECT');
    await waitFor(() => expect(chamadasA(f, 'GET /api/consulta/unidades')).toBe(1));
    await userEvent.click(unidade);
    await screen.findByRole('tree', { name: 'Lotados em' });
    await waitFor(() => expect(nosDaArvore()).toEqual(['CBMPE', '2º GB, em CBMPE']));
    await userEvent.click(screen.getByRole('button', { name: 'Abrir tudo' }));
    expect(nosDaArvore()).toEqual(['CBMPE', '2º GB, em CBMPE', 'DivOp, em 2º GB', '1ª SB, em DivOp']);
  });

  it('6.45: "Limpar" tira a unidade e volta a "Toda a corporação"', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await waitFor(() => expect(chamadasA(f, 'GET /api/consulta/unidades')).toBe(1));
    await escolherNaArvore(await screen.findByLabelText('Lotados em'), 'DivOp, em 2º GB');
    expect(screen.getByLabelText('Lotados em')).toHaveTextContent('2º GB / DivOp');
    await userEvent.click(screen.getByLabelText('Lotados em'));
    await userEvent.click(await screen.findByRole('button', { name: 'Limpar' }));
    expect(screen.getByLabelText('Lotados em')).toHaveTextContent('Toda a corporação');
  });

  it('busca por texto: mostra a identificação de cada militar, e a lotação e o quadro quando há', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
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
    abrir('/peculio/pesquisar');
    await waitFor(() => expect(chamadasA(f, 'GET /api/consulta/unidades')).toBe(1));
    await escolherNaArvore(screen.getByLabelText('Lotados em'), 'DivOp, em 2º GB');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect([...pedidos(f)[0]!.entries()]).toEqual([['unidadeId', 'u-divop']]);
  });

  it('texto curto e nenhuma unidade: mostra a mensagem fixa e não pede nada à API', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
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
    abrir('/peculio/pesquisar?texto=andrade');
    expect(await screen.findByRole('status')).toHaveTextContent(AVISO_MAIS);
    expect(screen.getByRole('list', { name: 'Militares encontrados' })).toBeInTheDocument();
  });

  it('sem o aviso quando não há mais; sem resultado, a tela orienta', async () => {
    api({ [BUSCA]: { status: 200, corpo: { militares: [], haMais: false } } });
    abrir('/peculio/pesquisar?texto=zzz');
    expect(await screen.findByText(/Nenhum militar encontrado\. Confira o nome ou a matrícula/)).toBeInTheDocument();
    expect(screen.queryByText(AVISO_MAIS)).toBeNull();
  });

  it('a busca fica no endereço: abrir /consulta?texto=...&unidade=... já mostra o resultado e preenche os campos', async () => {
    const f = api();
    abrir('/peculio/pesquisar?texto=andrade&unidade=u-divop');
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect([...pedidos(f)[0]!.entries()]).toEqual([['texto', 'andrade'], ['unidadeId', 'u-divop']]);
    expect(screen.getByLabelText('Nome, nome de guerra ou matrícula')).toHaveValue('andrade');
    await waitFor(() => expect(screen.getByLabelText('Lotados em')).toHaveTextContent('2º GB / DivOp'));
  });

  it('um endereço com texto curto e sem unidade não pede nada', async () => {
    const f = api();
    abrir('/peculio/pesquisar?texto=ab');
    await screen.findByRole('heading', { level: 1, name: 'Pesquisar militares' });
    expect(screen.getByText(/Busque pelo nome/)).toBeInTheDocument();
    expect(pedidos(f)).toHaveLength(0);
  });

  it('erro da API aparece na tela', async () => {
    api({ [BUSCA]: { status: 404, corpo: { erro: 'Unidade não encontrada.' } } });
    abrir('/peculio/pesquisar?unidade=x');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unidade não encontrada.');
  });

  it('cada linha leva à ficha de consulta, e o endereço guarda a busca para o "Voltar"', async () => {
    api();
    const router = abrir('/peculio/pesquisar?texto=andrade');
    const link = (await screen.findAllByRole('link', { name: /ANDRADE/ }))[0]!;
    expect(link).toHaveAttribute('href', '/peculio/militar/m1?de=pesquisa&texto=andrade');
    await userEvent.click(link);
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/militar/m1'));
  });
});

describe('a ficha de consulta', () => {
  const FICHA_MINIMA: FichaDeConsulta = { ...linha('m1', 'ANDRADE'), podeAbrirFichaCompleta: false };
  const FICHA_COMPLETA: FichaDeConsulta = {
    ...linha('m1', 'ANDRADE'),
    contato: { telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br', emailPessoal: 'andrade.pessoal@exemplo.test' },
    situacao: {
      equipe: 'Alfa', jornada: 'pronto', situacaoDoMilitar: 'Ativa', funcao: 'Chefe de seção',
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
    abrir('/peculio/militar/m1');
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
    abrir('/peculio/militar/m1');
    await screen.findByRole('heading', { level: 2, name: /ANDRADE/ });
    expect(blocos()).toEqual(['Identificação', 'Contato', 'Situação', 'Afastamentos', 'Dados da escala', 'Comportamento']);
    expect(screen.getByText('(81) 99999-0001')).toBeInTheDocument();
    expect(screen.getByText('andrade@bombeiros.pe.gov.br')).toBeInTheDocument();
    // o e-mail institucional e o pessoal aparecem com o nome de cada um (6.18, item 23)
    expect(screen.getByText('E-mail institucional').nextElementSibling).toHaveTextContent('andrade@bombeiros.pe.gov.br');
    expect(screen.getByText('E-mail pessoal').nextElementSibling).toHaveTextContent('andrade.pessoal@exemplo.test');
    expect(screen.getByText('Função').nextSibling).toHaveTextContent('Chefe de seção');
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
    abrir('/peculio/militar/m1');
    const itens = within(await screen.findByRole('list', { name: 'Afastamentos' })).getAllByRole('listitem');
    expect(itens[0]!.textContent).toBe('LTSde 10/12/2026 a 20/12/2026');
  });

  it('"Abrir a ficha completa" só aparece quando a API diz que pode, e leva à ficha (a quem tem nível de acesso)', async () => {
    // quem tem nível de acesso na lotação do militar: o auxiliar (a barreira do módulo de escalas deixa passar)
    api({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, 'GET /api/consulta/militares/m1': { status: 200, corpo: FICHA_COMPLETA } });
    abrir('/peculio/militar/m1');
    const link = await screen.findByRole('link', { name: 'Abrir a ficha completa' });
    expect(link).toHaveAttribute('href', '/peculio/militar/m1');
  });

  it('"Voltar à busca" leva ao mesmo resultado', async () => {
    ficha(FICHA_MINIMA);
    abrir('/peculio/militar/m1?de=pesquisa&texto=andrade&unidade=u-divop');
    const voltar = await screen.findByRole('link', { name: 'Voltar' });
    expect(voltar).toHaveAttribute('href', '/peculio/pesquisar?texto=andrade&unidade=u-divop');
  });

  it('o militar sem lotação hoje: o resumo diz isso e só a identificação aparece', async () => {
    ficha({ ...FICHA_MINIMA, lotacao: null, quadro: null });
    abrir('/peculio/militar/m1');
    expect(await screen.findByText('Sem lotação hoje')).toBeInTheDocument();
    expect(blocos()).toEqual(['Identificação']);
  });

  it('militar que não existe mostra a mensagem da API', async () => {
    api({ 'GET /api/consulta/militares/m1': { status: 404, corpo: { erro: 'Militar não encontrado.' } } });
    abrir('/peculio/militar/m1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Militar não encontrado.');
  });

  it('o título da aba é o da consulta, sem o nome do militar', async () => {
    ficha(FICHA_MINIMA);
    abrir('/peculio/militar/m1');
    await screen.findByRole('heading', { level: 2, name: /ANDRADE/ });
    await waitFor(() => expect(document.title).toBe('Militar · Sistema de Gestão - 2º GB'));
    expect(document.title).not.toMatch(/ANDRADE/);
  });
});

describe('o militar externo não é mais trazido pela ficha de consulta (6.36)', () => {
  it('mesmo quando a API manda a chave externo, a ficha não tem os botões de trazer e de tirar da escala (isso agora é nas configurações da escala)', async () => {
    const FICHA: FichaDeConsulta = { ...linha('m1', 'ANDRADE', { lotacao: '2ª SB' }), podeAbrirFichaCompleta: false, externo: { unidadeSigla: '1ª SB', vinculoId: null } };
    api({ 'GET /api/consulta/militares/m1': { status: 200, corpo: FICHA } });
    abrir('/peculio/militar/m1');
    await screen.findByRole('heading', { level: 2, name: /ANDRADE/ });
    expect(screen.queryByRole('button', { name: /Trazer para a escala/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Tirar da escala/ })).toBeNull();
  });
});
