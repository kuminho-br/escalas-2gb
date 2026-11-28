import type { LinhaDaBusca, ResultadoDaBusca, UnidadeDaConsulta } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lerMatriculas } from '@/lib/matriculas-do-arquivo';
import { abrir, abrirCriterios, clicarBuscar, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.51, Task 2: "Pesquisar militares" com filtros, árvore e arquivo de matrículas. Dados fictícios (D7): matrículas 990xxx-x.
const NIVEL = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }] };
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const UNIDADES: UnidadeDaConsulta[] = [
  { id: 'u-cbmpe', sigla: 'CBMPE', nivel: 0, maeId: null }, { id: 'u-gb', sigla: '2º GB', nivel: 3, maeId: 'u-cbmpe' }, { id: 'u-divop', sigla: 'DivOp', nivel: 4, maeId: 'u-gb' },
  { id: 'u-1sb', sigla: '1ª SB', nivel: 5, maeId: 'u-divop' }, { id: 'u-3gb', sigla: '3º GB', nivel: 3, maeId: 'u-cbmpe' },
];
const linha = (id: string, nomeGuerra: string, extra: Partial<LinhaDaBusca> = {}): LinhaDaBusca => ({
  id, postoGrad: 'SD', nomeGuerra, nomeCompleto: `Fulano ${nomeGuerra}`, matricula: '990001-1', lotacao: '1ª SB', quadro: 'QBMG', equipe: 'Alfa', jornada: 'pronto', situacao: 'Ativa', unidadeId: 'u-1sb', lotacaoCaminho: '1ª SB', podeAlterar: true, ...extra,
});
const RESULTADO: ResultadoDaBusca = { militares: [linha('m1', 'ANDRADE'), linha('m2', 'BARRETO')], haMais: false, naoEncontradas: [] };
const BUSCAR = 'POST /api/consulta/militares/buscar';

function api(extra: Parameters<typeof simularApi>[0] = {}, eu: unknown = NIVEL) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    'GET /api/consulta/unidades': { status: 200, corpo: UNIDADES },
    'GET /api/postos': { status: 200, corpo: [{ id: 'p-sd', sigla: 'SD', nome: 'Soldado', ordem: 1 }, { id: 'p-cb', sigla: 'CB', nome: 'Cabo', ordem: 2 }] },
    'GET /api/quadros': { status: 200, corpo: [{ id: 'q-bmg', sigla: 'QBMG', nome: 'Praças', oficial: false }] },
    'GET /api/situacoes-do-militar': { status: 200, corpo: [{ id: 's-ativa', nome: 'Ativa', escalavel: true, ativo: true }] },
    'GET /api/funcoes-do-militar': { status: 200, corpo: [{ id: 'f-chefe', nome: 'Chefe de seção', ativo: true }] },
    [BUSCAR]: { status: 200, corpo: RESULTADO },
    ...extra,
  });
}
/** O corpo (JSON) de cada POST da busca, na ordem. */
const corpos = (f: ReturnType<typeof simularApi>) =>
  f.mock.calls.filter(([e, i]) => String(e).includes('/api/consulta/militares/buscar') && i?.method === 'POST').map(([, i]) => JSON.parse(String(i!.body)));
const campoDoTexto = () => screen.findByLabelText('Matrícula ou nome de guerra');

describe('lerMatriculas: o arquivo de matrículas (Review Focus 3)', () => {
  it('primeira coluna, cabeçalho opcional fora, sem linhas vazias, sem repetidas (com ou sem pontuação)', () => {
    const arquivo = 'Matrícula;Nome\r\n990012-3;Fulano\r\n\r\n9900123;Repetido\r\n"990013-4",x\r\n  990014-5  \r\n990012-3\r\n';
    expect(lerMatriculas(arquivo)).toEqual(['990012-3', '990013-4', '990014-5']);
  });

  it('sem cabeçalho, a primeira linha já é matrícula; a marca de ordem de bytes e o texto vazio não atrapalham', () => {
    expect(lerMatriculas('﻿990012-3\n990013-4')).toEqual(['990012-3', '990013-4']);
    expect(lerMatriculas('')).toEqual([]);
    expect(lerMatriculas('Matrícula\n')).toEqual([]);
  });

  it('separa por vírgula, ponto e vírgula ou tabulação, e fica com a primeira coluna', () => {
    expect(lerMatriculas('990012-3,a\n990013-4\tb\n990014-5;c')).toEqual(['990012-3', '990013-4', '990014-5']);
  });
});

describe('os filtros na tela', () => {
  it('quem tem nível de acesso vê as quatro abas dos critérios; o militar comum só "Nome e matrícula" e "Pela árvore"', async () => {
    api();
    abrir('/peculio/pesquisar');
    await userEvent.click(await screen.findByRole('button', { name: /^Critérios de pesquisa/ }));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Nome e matrícula', 'Pela árvore', 'Arquivo de matrículas', 'Outros filtros']);
  });

  it('o militar comum não vê os filtros restritos nem o arquivo', async () => {
    api({}, COMUM);
    abrir('/peculio/pesquisar');
    await userEvent.click(await screen.findByRole('button', { name: /^Critérios de pesquisa/ }));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Nome e matrícula', 'Pela árvore']);
  });

  it('"Outros filtros" abre os filtros além do texto e da lotação', async () => {
    api();
    abrir('/peculio/pesquisar');
    await abrirCriterios('Outros filtros');
    for (const rotulo of ['Posto ou graduação', 'Quadro', 'Jornada', 'Equipe', 'Situação do militar', 'Voluntário JES', 'No quadro de motoristas', 'Função', 'Afastado hoje', 'Cadastro incompleto']) {
      expect(screen.getByLabelText(rotulo), rotulo).toBeInTheDocument();
    }
    for (const c of ['A', 'B', 'C', 'D', 'E']) expect(screen.getByRole('checkbox', { name: `CNH ${c}` })).toBeInTheDocument();
    // a ajuda do filtro de CNH (6.53): a hierarquia do CTB
    expect(screen.getByText('Inclui quem tem uma categoria que habilita a escolhida.')).toBeInTheDocument();
  });

  it('a busca só sai no "Buscar": mexer nos critérios não pede nada', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await userEvent.type(await campoDoTexto(), 'andr');
    await abrirCriterios('Outros filtros');
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'pronto');
    expect(corpos(f)).toHaveLength(0);
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(corpos(f)).toEqual([{ texto: 'andr', jornada: 'pronto' }]);
  });

  it('o "Buscar" de dentro do painel faz a mesma busca e fecha o painel', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await userEvent.type(await campoDoTexto(), 'andr');
    await abrirCriterios('Outros filtros');
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'pronto');
    const painel = screen.getByRole('region', { name: 'Critérios de pesquisa' });
    await userEvent.click(within(painel).getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(corpos(f)).toEqual([{ texto: 'andr', jornada: 'pronto' }]);
    expect(screen.queryByRole('region', { name: 'Critérios de pesquisa' })).toBeNull();
  });

  it('os filtros somam: posto, quadro, JES, CNH e cadastro incompleto vão juntos no corpo', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await abrirCriterios('Outros filtros');
    await userEvent.selectOptions(await screen.findByLabelText('Posto ou graduação'), 'p-cb');
    await userEvent.selectOptions(screen.getByLabelText('Quadro'), 'q-bmg');
    await userEvent.selectOptions(screen.getByLabelText('Voluntário JES'), 'sim');
    await userEvent.selectOptions(screen.getByLabelText('Cadastro incompleto'), 'nao');
    await userEvent.click(screen.getByRole('checkbox', { name: 'CNH D' }));
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(corpos(f)).toEqual([{ postoGradIds: ['p-cb'], quadroIds: ['q-bmg'], voluntarioJes: true, cadastroIncompleto: false, cnh: ['D'] }]);
  });

  it('a marca âmbar do botão e a contagem da aba dizem quantos critérios; cada um vira uma etiqueta, e o x a tira e busca de novo', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await userEvent.type(await campoDoTexto(), 'andr');
    await abrirCriterios('Outros filtros');
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'pronto');
    await userEvent.type(screen.getByLabelText('Equipe'), 'alfa');
    expect(screen.getByRole('tab', { name: /^Outros filtros.*2/ })).toBeInTheDocument();
    // antes do Buscar nada está em uso: a marca e as etiquetas são do que vale na busca
    expect(screen.queryByRole('group', { name: 'Critérios em uso' })).toBeNull();
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(screen.getByRole('button', { name: /^Critérios de pesquisa.*2 em uso/ })).toBeInTheDocument();
    const etiquetas = screen.getByRole('group', { name: 'Critérios em uso' });
    expect(within(etiquetas).getByText('Jornada:', { exact: false })).toHaveTextContent('Jornada: Pronto');
    expect(within(etiquetas).getByText('Equipe:', { exact: false })).toHaveTextContent('Equipe: ALFA');
    // o x tira a etiqueta e busca de novo, na hora
    await userEvent.click(within(etiquetas).getByRole('button', { name: /^Tirar o critério: Equipe/ }));
    await waitFor(() => expect(corpos(f)).toHaveLength(2));
    expect(corpos(f)[1]).toEqual({ texto: 'andr', jornada: 'pronto' });
    expect(screen.getByRole('button', { name: /^Critérios de pesquisa.*1 em uso/ })).toBeInTheDocument();
    // com um critério só, não há "Limpar critérios"
    expect(screen.queryByRole('button', { name: 'Limpar critérios' })).toBeNull();
  });

  it('"Limpar critérios" (com dois ou mais) tira todos, mantém o texto da barra e busca de novo', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await userEvent.type(await campoDoTexto(), 'andr');
    await abrirCriterios('Outros filtros');
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'pronto');
    await userEvent.selectOptions(screen.getByLabelText('Voluntário JES'), 'sim');
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    await userEvent.click(within(screen.getByRole('group', { name: 'Critérios em uso' })).getByRole('button', { name: 'Limpar critérios' }));
    await waitFor(() => expect(corpos(f)).toHaveLength(2));
    expect(corpos(f)[1]).toEqual({ texto: 'andr' });
    expect(screen.getByLabelText('Matrícula ou nome de guerra')).toHaveValue('andr');
    expect(screen.queryByRole('group', { name: 'Critérios em uso' })).toBeNull();
  });

  it('Review Focus 2: tirar a última etiqueta, sem texto na barra, pede um critério e não apaga o texto nem a seleção', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await abrirCriterios('Outros filtros');
    await userEvent.selectOptions(screen.getByLabelText('Jornada'), 'pronto');
    await clicarBuscar();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar SD ANDRADE' }));
    await userEvent.type(screen.getByLabelText('Matrícula ou nome de guerra'), 'an');
    await userEvent.click(within(screen.getByRole('group', { name: 'Critérios em uso' })).getByRole('button', { name: /^Tirar o critério: Jornada/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escolha pelo menos um filtro.');
    expect(screen.getByLabelText('Matrícula ou nome de guerra')).toHaveValue('an');
    expect(screen.getByRole('heading', { name: 'Selecionados (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Militares encontrados' })).toBeNull();
    // só a busca com a jornada saiu: a de depois do x não foi pedida
    expect(corpos(f)).toEqual([{ jornada: 'pronto' }]);
  });

  it('a busca com filtros mostra a situação de cada militar na linha, e "Mais de 500 militares. Afine a busca." quando passa do teto', async () => {
    api({ [BUSCAR]: { status: 200, corpo: { ...RESULTADO, haMais: true, militares: Array.from({ length: 500 }, (_, i) => linha(`m${i}`, `M${i}`)) } } });
    abrir('/peculio/pesquisar');
    await userEvent.type(await campoDoTexto(), 'abc');
    await clicarBuscar();
    expect(await screen.findByText('Mais de 500 militares. Afine a busca.')).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Militares encontrados' });
    expect(within(lista).getAllByRole('listitem')[0]).toHaveTextContent('Alfa');
  });
});

describe('pela árvore', () => {
  it('marcar nós preenche a lotação com várias unidades, cada uma com ou sem "e as de baixo"', async () => {
    const f = api();
    abrir('/peculio/pesquisar');
    await abrirCriterios('Pela árvore');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar 2º GB' }));
    // marcar liga o "e as de baixo"; a pessoa pode desligar
    expect(screen.getByRole('checkbox', { name: '2º GB: e as de baixo' })).toBeChecked();
    // uma unidade sem filhas não tem o que incluir: o controle nem aparece
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar 3º GB' }));
    expect(screen.queryByRole('checkbox', { name: '3º GB: e as de baixo' })).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar 3º GB' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '2º GB: e as de baixo' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar 3º GB' }));
    expect(screen.getByRole('tab', { name: /^Pela árvore.*2/ })).toBeInTheDocument();
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(corpos(f)).toEqual([{ unidades: [{ id: 'u-gb', comAsDeBaixo: false }, { id: 'u-3gb', comAsDeBaixo: true }] }]);
    // cada unidade marcada vira uma etiqueta, pelo menor caminho que a identifica
    const etiquetas = screen.getByRole('group', { name: 'Critérios em uso' });
    expect(within(etiquetas).getByRole('button', { name: 'Tirar o critério: Lotação: 2º GB' })).toBeInTheDocument();
    expect(within(etiquetas).getByRole('button', { name: 'Tirar o critério: Lotação: 3º GB e as de baixo' })).toBeInTheDocument();
  });

  it('desmarcar tira o nó; o militar comum também usa a árvore (a lotação vale para toda conta)', async () => {
    const f = api({}, COMUM);
    abrir('/peculio/pesquisar');
    await abrirCriterios('Pela árvore');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar 3º GB' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar 3º GB' }));
    expect(screen.getByRole('tab', { name: 'Pela árvore' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar 3º GB' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar 2º GB' }));
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(corpos(f)).toEqual([{ unidades: [{ id: 'u-3gb', comAsDeBaixo: true }, { id: 'u-gb', comAsDeBaixo: true }] }]);
  });
});

describe('achado da revisão da 6.51', () => {
  it('o militar comum que busca pela árvore (vai pelo POST) não vê marca de seleção nem a frase "ficam de fora"', async () => {
    const dele = { ...RESULTADO, militares: [linha('m1', 'ANDRADE', { podeAlterar: false }), linha('m2', 'BARRETO', { podeAlterar: false })] };
    api({ [BUSCAR]: { status: 200, corpo: dele } }, COMUM);
    abrir('/peculio/pesquisar');
    await abrirCriterios('Pela árvore');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar 2º GB' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar 3º GB' }));
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(screen.getByText('ANDRADE')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/ficam? de fora/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Selecionar estes/ })).toBeNull();
  });
});

describe('por arquivo de matrículas', () => {
  const arquivo = (conteudo: string) => new File([conteudo], 'matriculas.csv', { type: 'text/csv' });

  it('lê o arquivo, diz quantas matrículas leu, manda no corpo e mostra as não encontradas sem travar o resto', async () => {
    const f = api({ [BUSCAR]: { status: 200, corpo: { ...RESULTADO, naoEncontradas: ['990999-9', '990998-8'] } } });
    abrir('/peculio/pesquisar');
    await abrirCriterios('Arquivo de matrículas');
    await userEvent.upload(await screen.findByLabelText('Arquivo de matrículas', { selector: 'input' }), arquivo('Matrícula\n990001-1\n9900011\n\n990002-2\n990999-9\n990998-8\n'));
    expect(await screen.findByText('4 matrículas lidas')).toBeInTheDocument();
    await clicarBuscar();
    await screen.findByRole('list', { name: 'Militares encontrados' });
    expect(corpos(f)).toEqual([{ matriculas: ['990001-1', '990002-2', '990999-9', '990998-8'] }]);
    expect(await screen.findByText('2 matrículas não encontradas')).toBeInTheDocument();
    expect(screen.getByText('990999-9')).toBeInTheDocument();
    // as achadas continuam na lista
    expect(screen.getAllByRole('listitem').some((l) => l.textContent?.includes('ANDRADE'))).toBe(true);
  });

  it('um arquivo com mais de 2.000 matrículas é recusado com a frase, e nada é guardado', async () => {
    api();
    abrir('/peculio/pesquisar');
    await abrirCriterios('Arquivo de matrículas');
    const grande = Array.from({ length: 2001 }, (_, i) => `99${String(i).padStart(4, '0')}-${i % 10}`).join('\n');
    await userEvent.upload(await screen.findByLabelText('Arquivo de matrículas', { selector: 'input' }), arquivo(grande));
    expect(await screen.findByText('O arquivo tem mais de 2.000 matrículas. Divida em dois.')).toBeInTheDocument();
    expect(screen.queryByText(/matrículas lidas/)).toBeNull();
  });

  it('sem nenhuma matrícula legível, diz isso', async () => {
    api();
    abrir('/peculio/pesquisar');
    await abrirCriterios('Arquivo de matrículas');
    await userEvent.upload(await screen.findByLabelText('Arquivo de matrículas', { selector: 'input' }), arquivo('Matrícula\n\n'));
    expect(await screen.findByText('Nenhuma matrícula encontrada no arquivo.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/matrículas lidas/)).toBeNull());
  });
});
