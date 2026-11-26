import type { ListaDoPeculio } from 'contratos';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Eu, EuDaApi } from '@/api/eu';
import { podeCadastrarMilitar, secoesDoCadastro, unidadeDoPeculio } from '@/api/peculio';
import { hoje, mesAtual } from '@/lib/meses';
import { guardarUnidade } from '@/lib/unidade-de-trabalho';
import { abrir, chamadasA, corpoEnviado, escolherNaArvore, EU_EXEMPLO, nosDaArvore, simularApi } from './apoio';

const MES = mesAtual();
const comUnidade = (e: EuDaApi): Eu => ({ ...e, unidade: e.unidades[0]!, soConsulta: false });
const GESTOR_GB: EuDaApi = {
  ...EU_EXEMPLO,
  papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }, { papel: 'escalante', unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }],
  unidades: [{ id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento', maeId: null }, ...EU_EXEMPLO.unidades],
};
const LISTA: ListaDoPeculio = {
  militares: [
    { militarId: 'm1', matricula: '990001-1', posto: 'SD', nomeGuerra: 'ANDRADE', nomeCompleto: 'João da Silva Andrade', lotacao: '1ª SB', lotacaoId: 'u-1sb', telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br', pendencias: [] },
    { militarId: 'm2', matricula: '990002-2', posto: 'CB', nomeGuerra: 'BARRETO', nomeCompleto: null, lotacao: '2ª SB', lotacaoId: 'u-2sb', telefone: null, email: null, pendencias: ['Nome completo em falta'] },
    { militarId: 'm3', matricula: '990003-3', posto: 'SD', nomeGuerra: 'CÁBRAL', nomeCompleto: 'Carlos Cabral Neto', lotacao: '1ª SB', lotacaoId: 'u-1sb', telefone: null, email: null, pendencias: [] },
  ],
  aniversariantes: [
    { militarId: 'm2', posto: 'CB', nomeGuerra: 'BARRETO', dia: 5, lotacao: '2ª SB' },
    { militarId: 'm1', posto: 'SD', nomeGuerra: 'ANDRADE', dia: 20, lotacao: '1ª SB' },
  ],
};

function api(eu: EuDaApi = GESTOR_GB, lista: ListaDoPeculio = LISTA, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    [`GET /api/unidades/u-gb/peculio`]: { status: 200, corpo: lista },
    [`GET /api/unidades/u-1sb/peculio`]: { status: 200, corpo: lista },
    ...extra,
  });
}
const militares = async () => within(await screen.findByRole('list', { name: 'Militares do Pecúlio' }));
const chamadasDaLista = (f: ReturnType<typeof simularApi>) => f.mock.calls.map(([e]) => String(e)).filter((u) => u.includes('/peculio'));

describe('a unidade do módulo', () => {
  const noTopo = (e: EuDaApi, id: string): Eu => ({ ...e, unidade: e.unidades.find((u) => u.id === id)!, soConsulta: false });
  const ADMIN: EuDaApi = { ...GESTOR_GB, papeis: [{ papel: 'administrador', unidadeId: 'u-cbmpe', unidadeSigla: 'CBMPE' }], unidades: [{ id: 'u-cbmpe', sigla: 'CBMPE', caminho: ['CBMPE'], nivel: 0, tipo: 'corporacao', maeId: null }, ...GESTOR_GB.unidades] };

  it('é a unidade de trabalho escolhida no Topo, quando a pessoa tem nível de acesso nela ou acima (nunca sobe sozinha)', () => {
    // o administrador da raiz com a 1ª SB no Topo: só a 1ª SB, não a corporação inteira (Review Focus 1)
    expect(unidadeDoPeculio(noTopo(ADMIN, 'u-1sb'))).toEqual({ id: 'u-1sb', sigla: '1ª SB' });
    // trocar o Topo para o 2º GB muda a unidade
    expect(unidadeDoPeculio(noTopo(ADMIN, 'u-gb'))).toEqual({ id: 'u-gb', sigla: '2º GB' });
    expect(unidadeDoPeculio(noTopo(ADMIN, 'u-cbmpe'))).toEqual({ id: 'u-cbmpe', sigla: 'CBMPE' });
    // o gestor com nível no 2º GB e na 1ª SB, com a 1ª SB no Topo: a 1ª SB, não a de cima (Review Focus 2)
    expect(unidadeDoPeculio(noTopo(GESTOR_GB, 'u-1sb'))).toEqual({ id: 'u-1sb', sigla: '1ª SB' });
    expect(unidadeDoPeculio(noTopo(GESTOR_GB, 'u-gb'))).toEqual({ id: 'u-gb', sigla: '2º GB' });
    expect(unidadeDoPeculio(comUnidade(EU_EXEMPLO))).toEqual({ id: 'u-1sb', sigla: '1ª SB' });
  });

  it('Review Focus 4 (achado da revisão): com a mesma sigla em dois grupamentos, quem só consulta a seção do outro vale pelo nível mais alto dele, e não pela sigla que coincide', () => {
    // nível na "1ª SB" do 3º GB; no Topo, para consulta, a "1ª SB" do 2º GB (a sigla coincide, a unidade não é dele)
    const eu: Eu = {
      ...GESTOR_GB,
      papeis: [{ papel: 'escalante', unidadeId: 'u-1sb-gb3', unidadeSigla: '1ª SB' }],
      unidades: [{ id: 'u-1sb-gb3', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '3º GB', '1ª SB'], nivel: 4, tipo: 'secao', maeId: null }],
      unidade: { id: 'u-1sb-gb2', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4, tipo: 'secao', maeId: null },
      soConsulta: true,
    };
    expect(unidadeDoPeculio(eu)).toEqual({ id: 'u-1sb-gb3', sigla: '1ª SB' });
  });

  it('o militar comum e quem só consulta seguem como antes: a unidade dele, e o nível mais alto na unidade só de consulta', () => {
    expect(unidadeDoPeculio(comUnidade({ ...EU_EXEMPLO, papeis: [] }))).toEqual({ id: 'u-1sb', sigla: '1ª SB' });
    const soConsulta: Eu = { ...GESTOR_GB, papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidade: { id: 'u-3sb', sigla: '3ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '3º GB', '3ª SB'], nivel: 4, tipo: 'secao', maeId: null }, soConsulta: true };
    expect(unidadeDoPeculio(soConsulta)).toEqual({ id: 'u-gb', sigla: '2º GB' });
  });
});

describe('módulo Pecúlio', () => {
  // o Pecúlio abre na unidade do Topo: estes testes são de quem trabalha no 2º GB (o gestor do 2º GB, que também tem nível na 1ª SB)
  beforeEach(() => guardarUnidade('u-gb'));
  afterAll(() => guardarUnidade(''));

  it('o administrador da raiz com a 1ª SB no Topo vê o Pecúlio só da 1ª SB (a lista pede a 1ª SB, não a corporação)', async () => {
    const admin: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador', unidadeId: 'u-cbmpe', unidadeSigla: 'CBMPE' }], unidades: [{ id: 'u-cbmpe', sigla: 'CBMPE', caminho: ['CBMPE'], nivel: 0, tipo: 'corporacao', maeId: null }, ...EU_EXEMPLO.unidades] };
    const f = simularApi({ '/api/eu': { status: 200, corpo: admin }, 'GET /api/unidades/u-1sb/peculio': { status: 200, corpo: LISTA } });
    guardarUnidade('u-1sb');
    try {
      abrir('/peculio');
      await militares();
      expect(chamadasDaLista(f)[0]).toContain('/api/unidades/u-1sb/peculio');
      expect(chamadasDaLista(f).some((u) => u.includes('u-cbmpe'))).toBe(false);
    } finally {
      guardarUnidade('u-gb');
    }
  });

  it('o menu mostra "Pecúlio da unidade" para quem tem papel de cadastro e não para o militar comum', async () => {
    api();
    abrir('/peculio');
    expect(await screen.findByRole('link', { name: 'Pecúlio da unidade' })).toHaveAttribute('href', '/peculio');
  });

  it('o militar comum não vê o item no menu', async () => {
    api({ ...EU_EXEMPLO, papeis: [] });
    abrir('/');
    await screen.findByText('SD ANDRADE');
    expect(screen.queryByRole('link', { name: 'Pecúlio da unidade' })).toBeNull();
  });

  it('lista os militares da unidade e das de baixo com posto, nome de guerra, nome completo, lotação, telefone, e-mail e as pendências', async () => {
    const f = api();
    abrir('/peculio');
    const lista = await militares();
    const andrade = lista.getByText('ANDRADE').closest('li')!;
    expect(chamadasDaLista(f)[0]).toContain(`/api/unidades/u-gb/peculio?mes=${MES}`);
    expect(within(andrade).getByText('SD')).toBeInTheDocument();
    expect(within(andrade).getByText('João da Silva Andrade')).toBeInTheDocument();
    expect(within(andrade).getByText('1ª SB')).toBeInTheDocument();
    expect(within(andrade).getByText('(81) 99999-0001')).toBeInTheDocument();
    expect(within(andrade).getByText('andrade@bombeiros.pe.gov.br')).toBeInTheDocument();
    const barreto = lista.getByText('BARRETO').closest('li')!;
    expect(within(barreto).getByText('2ª SB')).toBeInTheDocument();
    expect(within(barreto).getByLabelText('Cadastro incompleto: Nome completo em falta')).toBeInTheDocument();
    expect(screen.getByText('3 de 3 militares')).toBeInTheDocument();
  });

  it('a busca acha por nome (sem acento) ou matrícula e o filtro por lotação restringe', async () => {
    api();
    abrir('/peculio');
    const lista = await militares();
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), 'cabral');
    expect(lista.queryByText('ANDRADE')).toBeNull();
    expect(lista.getByText('CÁBRAL')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Buscar por nome ou matrícula'));
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), '990002');
    expect(lista.getByText('BARRETO')).toBeInTheDocument();
    expect(lista.queryByText('CÁBRAL')).toBeNull();
    await userEvent.clear(screen.getByLabelText('Buscar por nome ou matrícula'));
    // o filtro é pela árvore (6.45): a lotação que a pessoa não tem na árvore dela (a 2ª SB) entra pela lista, e nunca some
    await escolherNaArvore(screen.getByLabelText('Lotação'), '2ª SB, em 2º GB');
    expect(lista.getByText('BARRETO')).toBeInTheDocument();
    expect(lista.queryByText('ANDRADE')).toBeNull();
    expect(screen.getByText('1 de 3 militares')).toBeInTheDocument();
  });

  it('6.45: o filtro "Lotação" é a árvore, nó a nó: escolher um nó filtra por ele e pelos de baixo, e "Limpar" volta a "Todas"; nenhuma lista plana', async () => {
    const comArvore: EuDaApi = {
      ...GESTOR_GB,
      unidades: [
        { id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento', maeId: 'u-di' },
        { id: 'u-divop', sigla: 'DivOp', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', 'DivOp'], nivel: 4, tipo: 'divisao', maeId: 'u-gb' },
        { id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', 'DivOp', '1ª SB'], nivel: 5, tipo: 'secao', maeId: 'u-divop' },
        { id: 'u-2sb', sigla: '2ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '2ª SB'], nivel: 4, tipo: 'secao', maeId: 'u-gb' },
      ],
    };
    api(comArvore);
    abrir('/peculio');
    const lista = await militares();
    const filtro = screen.getByLabelText('Lotação');
    expect(filtro.tagName).not.toBe('SELECT');
    expect(filtro).toHaveTextContent('Todas');
    await userEvent.click(filtro);
    await screen.findByRole('tree', { name: 'Lotação' });
    // nó a nó: o grupamento e o primeiro nível; a 1ª SB (dentro da DivOp) só aparece ao abrir a divisão
    expect(nosDaArvore()).toEqual(['2º GB', '2ª SB, em 2º GB', 'DivOp, em 2º GB']);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir DivOp' }));
    expect(nosDaArvore()).toEqual(['2º GB', '2ª SB, em 2º GB', 'DivOp, em 2º GB', '1ª SB, em DivOp']);
    // a divisão pega a seção de baixo: ANDRADE e CÁBRAL são da 1ª SB
    await userEvent.click(screen.getByRole('treeitem', { name: 'DivOp, em 2º GB' }));
    expect(screen.getByText('2 de 3 militares')).toBeInTheDocument();
    expect(lista.queryByText('BARRETO')).toBeNull();
    expect(screen.getByLabelText('Lotação')).toHaveTextContent('2º GB / DivOp');
    // o grupamento pega tudo
    await escolherNaArvore(screen.getByLabelText('Lotação'), '2º GB');
    expect(screen.getByText('3 de 3 militares')).toBeInTheDocument();
    await escolherNaArvore(screen.getByLabelText('Lotação'), '2ª SB, em 2º GB');
    expect(screen.getByText('1 de 3 militares')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Lotação'));
    await userEvent.click(await screen.findByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('3 de 3 militares')).toBeInTheDocument();
    expect(screen.getByLabelText('Lotação')).toHaveTextContent('Todas');
  });

  it('6.45: a lotação que não está na árvore da pessoa (uma unidade encerrada, por exemplo) fica debaixo da unidade do Pecúlio: filtrar por ela não esconde ninguém', async () => {
    const comAntiga: ListaDoPeculio = { ...LISTA, militares: [...LISTA.militares, { ...LISTA.militares[0]!, militarId: 'm4', matricula: '990004-4', nomeGuerra: 'DUARTE', lotacao: 'SB-ANTIGA', lotacaoId: 'u-antiga' }] };
    api(GESTOR_GB, comAntiga);
    abrir('/peculio');
    await militares();
    expect(screen.getByText('4 de 4 militares')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Lotação'));
    await userEvent.click(await screen.findByRole('treeitem', { name: 'SB-ANTIGA, em 2º GB' }));
    expect(screen.getByText('1 de 4 militares')).toBeInTheDocument();
  });

  it('clicar no militar abre a ficha dele (a mesma ficha)', async () => {
    api(GESTOR_GB, LISTA, { 'GET /api/militares/m1': { status: 404 } });
    const router = abrir('/peculio');
    await userEvent.click((await militares()).getByText('ANDRADE').closest('a')!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/militar/m1'));
  });

  it('o botão "Importar" só aparece para quem pode importar (nível acima das seções); o auxiliar só da seção não o vê (6.17, item 22)', async () => {
    api(EU_EXEMPLO);
    abrir('/peculio');
    await militares();
    expect(screen.queryByRole('button', { name: /^Importar/ })).toBeNull();
    cleanup();
    api(GESTOR_GB);
    abrir('/peculio');
    expect(await screen.findByRole('button', { name: /^Importar/ })).toBeInTheDocument();
  });

  it('o botão "Importar" abre a importação do Pecúlio, com o modelo do Pecúlio da unidade do módulo', async () => {
    api();
    abrir('/peculio');
    await userEvent.click(await screen.findByRole('button', { name: /^Importar/ }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByText('Importar o Pecúlio da planilha')).toBeInTheDocument();
    expect(dialogo.getByRole('link', { name: 'Baixar modelo' })).toHaveAttribute('href', '/api/unidades/u-gb/importacao/peculio/modelo');
    // a janela diz em que unidade a importação cai (a do Topo)
    expect(dialogo.getByText('Unidade da importação: 2º GB e as de baixo.')).toBeInTheDocument();
  });

  describe('a prévia da importação do Pecúlio (6.13)', () => {
    const PREVIA = {
      novos: [], alterados: [{ chave: '990001-1', descricao: 'SD ANDRADE', mudancas: ['telefone: vazio → (81) 99999-0000'] }], iguais: 0, avisos: [],
      problemas: [{ aba: 'PECÚLIO', linha: 4, mensagem: 'Militar novo sem lotação: não foi criado.', solucao: 'Preencha a coluna LOTAÇÃO.' }],
      ignoradas: [
        { linha: 2, chave: '990001-1', coluna: 'E-MAIL', motivo: 'Use o e-mail institucional (@bombeiros.pe.gov.br).' },
        { linha: 3, chave: '990002-2', coluna: 'NASCIMENTO', motivo: 'Use dd/mm/aaaa ou dd/mm, em formato de texto.' },
      ],
    };
    const verPrevia = async (previa: object) => {
      api(GESTOR_GB, LISTA, { 'POST /api/unidades/u-gb/importacao/peculio': { status: 200, corpo: previa } });
      abrir('/peculio');
      await userEvent.click(await screen.findByRole('button', { name: /^Importar/ }));
      const dialogo = within(await screen.findByRole('dialog'));
      await userEvent.upload(dialogo.getByLabelText('Arquivo da planilha (.xlsx)'), new File(['x'], 'peculio.xlsx'));
      await userEvent.click(dialogo.getByRole('button', { name: 'Ver o que vai entrar' }));
      return dialogo;
    };

    it('mostra o bloco "Dados ignorados", uma linha por célula: a linha, o militar, a coluna e o motivo', async () => {
      const dialogo = await verPrevia(PREVIA);
      const bloco = within(await dialogo.findByRole('region', { name: 'Dados ignorados (2)' }));
      const linhas = bloco.getAllByRole('listitem').map((l) => l.textContent);
      expect(linhas).toEqual([
        'Linha 2, 990001-1, E-MAIL: Use o e-mail institucional (@bombeiros.pe.gov.br).',
        'Linha 3, 990002-2, NASCIMENTO: Use dd/mm/aaaa ou dd/mm, em formato de texto.',
      ]);
    });

    it('o botão "Importar" fica ligado com células ignoradas e linhas de fora, se há algo a gravar', async () => {
      const dialogo = await verPrevia(PREVIA);
      expect(await dialogo.findByRole('button', { name: 'Importar 1, pular 1' })).toBeEnabled();
    });

    it('sem célula ignorada, o bloco não aparece', async () => {
      const dialogo = await verPrevia({ ...PREVIA, ignoradas: [] });
      await dialogo.findByRole('button', { name: /^Importar 1/ });
      expect(dialogo.queryByRole('region', { name: /Dados ignorados/ })).toBeNull();
    });
  });

  it('sem militar lotado, a tela diz o que fazer', async () => {
    api(GESTOR_GB, { militares: [], aniversariantes: [] });
    abrir('/peculio');
    expect(await screen.findByText(/Nenhum militar lotado/)).toBeInTheDocument();
  });

  it('a lista que falha mostra o erro', async () => {
    api(GESTOR_GB, LISTA, { 'GET /api/unidades/u-gb/peculio': { status: 500, corpo: { erro: 'Falha ao ler o Pecúlio.' } } });
    abrir('/peculio');
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao ler o Pecúlio.');
  });
});

describe('Enter na busca do Pecúlio', () => {
  const buscar = async (texto: string) => userEvent.type(await screen.findByLabelText('Buscar por nome ou matrícula'), texto);
  const doBarreto = (lista: HTMLElement) => within(lista).getByRole('link', { name: /BARRETO/ });

  it('com um resultado só, ele fica em destaque e o Enter abre a ficha dele, dentro do Pecúlio', async () => {
    api();
    const router = abrir('/peculio');
    await buscar('barr');
    const lista = await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(doBarreto(lista)).toHaveAttribute('aria-current', 'true');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/militar/m2'));
  });

  it('com dois resultados, nada fica em destaque e o Enter não abre nada', async () => {
    api();
    const router = abrir('/peculio');
    await buscar('b');
    const lista = await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(within(lista).getAllByRole('link')).toHaveLength(2);
    expect(within(lista).getAllByRole('link').some((l) => l.getAttribute('aria-current') === 'true')).toBe(false);
    await userEvent.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe('/peculio');
  });

  it('com zero resultados, o Enter não faz nada', async () => {
    api();
    const router = abrir('/peculio');
    await buscar('zzzz');
    await userEvent.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe('/peculio');
  });

  it('a ficha nunca abre sozinha: só digitar, mesmo ficando um resultado, não navega', async () => {
    api();
    const router = abrir('/peculio');
    await buscar('barr');
    await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(router.state.location.pathname).toBe('/peculio');
  });

  it('digitar até sobrar um e apagar uma letra: o destaque some e o Enter não abre', async () => {
    api();
    const router = abrir('/peculio');
    await buscar('ba');
    const lista = await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(doBarreto(lista)).toHaveAttribute('aria-current', 'true');
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(within(lista).getAllByRole('link')).toHaveLength(2));
    expect(within(lista).getAllByRole('link').some((l) => l.getAttribute('aria-current') === 'true')).toBe(false);
    await userEvent.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe('/peculio');
  });

  it('sem texto na busca, o único militar da lista não vira destaque nem abre com Enter', async () => {
    api(GESTOR_GB, { militares: [LISTA.militares[0]!], aniversariantes: [] });
    const router = abrir('/peculio');
    const lista = await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(within(lista).getByRole('link', { name: /ANDRADE/ })).not.toHaveAttribute('aria-current', 'true');
    await userEvent.type(screen.getByLabelText('Buscar por nome ou matrícula'), '{Enter}');
    expect(router.state.location.pathname).toBe('/peculio');
  });
});

describe('quem cadastra militar: nível de acesso numa unidade acima da seção', () => {
  const DI = { id: 'u-di', sigla: 'DInter/1', caminho: ['CBMPE', 'DGO', 'DInter/1'], nivel: 2, tipo: 'diretoria_integrada', maeId: null };
  it('o auxiliar só da seção não pode, esteja a seção no nível que estiver da árvore', () => {
    const daSecao = (nivel: number): EuDaApi => ({
      ...EU_EXEMPLO,
      papeis: [{ papel: 'escalante', unidadeId: 'u-sec', unidadeSigla: 'SEC-X' }],
      unidades: [{ id: 'u-sec', sigla: 'SEC-X', caminho: ['CBMPE', 'DGO', 'DInter/1', 'SEC-X'].slice(0, nivel + 1), nivel, tipo: 'secao', maeId: null }],
    });
    expect(podeCadastrarMilitar(daSecao(3))).toBe(false);
    expect(podeCadastrarMilitar(daSecao(4))).toBe(false);
  });

  it('quem tem nível de acesso numa unidade com outras abaixo pode', () => {
    const gestorDaDiretoria: EuDaApi = {
      ...EU_EXEMPLO,
      papeis: [{ papel: 'gestor', unidadeId: 'u-di', unidadeSigla: 'DInter/1' }],
      unidades: [DI, { id: 'u-sec', sigla: 'SEC-X', caminho: ['CBMPE', 'DGO', 'DInter/1', 'SEC-X'], nivel: 3, tipo: 'grupamento', maeId: null }],
    };
    expect(podeCadastrarMilitar(gestorDaDiretoria)).toBe(true);
    expect(podeCadastrarMilitar(GESTOR_GB)).toBe(true);
  });

  it('6.31: quem tem nível de acesso na raiz (que não tem unidade de cima) também cadastra na própria raiz; fora da raiz, a própria unidade do nível continua de fora', () => {
    const RAIZ = { id: 'u-raiz', sigla: 'CBMPE', caminho: ['CBMPE'], nivel: 0, tipo: 'corporacao', maeId: null };
    const adminDaRaiz: EuDaApi = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador', unidadeId: 'u-raiz', unidadeSigla: 'CBMPE' }], unidades: [RAIZ] };
    expect(podeCadastrarMilitar(adminDaRaiz)).toBe(true);
    expect(secoesDoCadastro(adminDaRaiz, [{ id: 'u-raiz', sigla: 'CBMPE', nome: '' }]).map((x) => x.sigla)).toEqual(['CBMPE']);
    // o gestor do 2º GB não alcança a própria unidade como seção de cadastro (o 2º GB não é raiz)
    expect(secoesDoCadastro(GESTOR_GB, [{ id: 'u-gb', sigla: '2º GB', nome: '' }])).toEqual([]);
  });

  it('as seções do diálogo são só as que estão abaixo de um nível de acesso da pessoa', () => {
    const eu: EuDaApi = { ...GESTOR_GB, papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }, { papel: 'escalante', unidadeId: 'u-outra', unidadeSigla: '9ª SB' }],
      unidades: [GESTOR_GB.unidades[0]!, { id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4, tipo: 'secao', maeId: null }, { id: 'u-outra', sigla: '9ª SB', caminho: ['CBMPE', 'DGO', 'DInter/9', '9º GB', '9ª SB'], nivel: 4, tipo: 'secao', maeId: null }] };
    const secoes = [{ id: 'u-1sb', sigla: '1ª SB', nome: '' }, { id: 'u-outra', sigla: '9ª SB', nome: '' }, { id: 'u-x', sigla: 'X', nome: '' }];
    expect(secoesDoCadastro(eu, secoes).map((x) => x.sigla)).toEqual(['1ª SB']);
  });
});

describe('o Novo militar, no Pecúlio', () => {
  const POSTOS = [{ id: 'p-sd', sigla: 'SD', nome: 'Soldado', ordem: 1 }, { id: 'p-cb', sigla: 'CB', nome: 'Cabo', ordem: 2 }, { id: 'p-maj', sigla: 'MAJ', nome: 'Major', ordem: 11 }];
  const QUADROS = [
    { id: 'q-qoc', sigla: 'QOC', nome: 'Oficiais Combatentes', postoGradIds: ['p-maj'] },
    { id: 'q-qoa', sigla: 'QOA', nome: 'Oficiais da Administração', postoGradIds: ['p-maj'] },
    { id: 'q-qbmg', sigla: 'QBMG', nome: 'Qualificação Bombeiro Militar Geral', postoGradIds: ['p-sd', 'p-cb'] },
  ];
  const SECOES = [{ id: 'u-1sb', sigla: '1ª SB', nome: '1ª Seção de Bombeiros' }, { id: 'u-2sb', sigla: '2ª SB', nome: '2ª Seção de Bombeiros' }];
  const FICHA_CRIADA = { id: 'm9' };
  // o gestor do 2º GB alcança as duas seções (a lista de unidades dele traz a árvore de baixo)
  const GB_COM_SECOES: EuDaApi = { ...GESTOR_GB, unidades: [...GESTOR_GB.unidades, { id: 'u-2sb', sigla: '2ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '2ª SB'], nivel: 4, tipo: 'secao', maeId: null }] };
  const rotas = (extra: Parameters<typeof simularApi>[0] = {}) =>
    api(GB_COM_SECOES, LISTA, { 'GET /api/postos': { status: 200, corpo: POSTOS }, 'GET /api/quadros': { status: 200, corpo: QUADROS }, 'GET /api/unidades-de-lotacao': { status: 200, corpo: SECOES }, ...extra });
  async function abrirODialogo() {
    await userEvent.click(await screen.findByRole('button', { name: 'Novo militar' }));
    return within(await screen.findByRole('dialog'));
  }

  it('quem tem nível de acesso na unidade de cima vê "Novo militar"; o auxiliar só da seção não vê', async () => {
    rotas();
    abrir('/peculio');
    expect(await screen.findByRole('button', { name: 'Novo militar' })).toBeInTheDocument();
    cleanup();
    api(EU_EXEMPLO);
    abrir('/peculio');
    await screen.findByRole('list', { name: 'Militares do Pecúlio' });
    expect(screen.queryByRole('button', { name: 'Novo militar' })).toBeNull();
  });

  it('item 8 (6.17): se a lista de unidades não carregou, "Criar" fica apagado e o campo diz "Não deu para carregar a lista. Recarregue a página."', async () => {
    rotas({ 'GET /api/unidades-de-lotacao': { status: 500, corpo: { erro: 'Falhou.' } } });
    abrir('/peculio');
    const dialogo = await abrirODialogo();
    await waitFor(() => expect(dialogo.getByText('Não deu para carregar a lista. Recarregue a página.')).toBeInTheDocument());
    expect(dialogo.getByRole('button', { name: 'Criar' })).toBeDisabled();
  });

  it('o diálogo pede os dados do Pecúlio e a lotação, e não pede equipe, jornada, motorista, CNH nem voluntário', async () => {
    rotas();
    abrir('/peculio');
    const dialogo = await abrirODialogo();
    for (const campo of ['Matrícula', 'Posto-graduação', 'Quadro', 'Nome completo', 'Nome de guerra', 'Antiguidade', 'Unidade', 'Lotado desde']) expect(dialogo.getByLabelText(campo)).toBeInTheDocument();
    for (const campo of ['Equipe', 'Jornada', 'Motorista', 'CNH', 'Voluntário JES']) expect(dialogo.queryByLabelText(campo)).toBeNull();
    expect(dialogo.getByLabelText('Lotado desde')).toHaveAttribute('type', 'date');
    expect(dialogo.getByLabelText('Lotado desde')).toHaveValue(hoje());
  });

  it('salvar cria na seção escolhida, como Pronto sem equipe, e abre a ficha', async () => {
    const f = rotas({ 'POST /api/unidades/u-2sb/militares': { status: 201, corpo: FICHA_CRIADA } });
    const router = abrir('/peculio');
    const dialogo = await abrirODialogo();
    await userEvent.type(dialogo.getByLabelText('Matrícula'), '990010-0');
    await userEvent.selectOptions(dialogo.getByLabelText('Posto-graduação'), 'CB');
    await userEvent.type(dialogo.getByLabelText('Nome completo'), 'Novo da Silva');
    await userEvent.type(dialogo.getByLabelText('Nome de guerra'), 'novo');
    // 6.45: a unidade é escolhida pela árvore, e nenhuma vem escolhida por acaso
    expect(dialogo.getByLabelText('Unidade')).toHaveTextContent('Escolha a unidade');
    expect(dialogo.getByRole('button', { name: 'Criar' })).toBeDisabled();
    await escolherNaArvore(dialogo.getByLabelText('Unidade'), '2ª SB');
    fireEvent.change(dialogo.getByLabelText('Lotado desde'), { target: { value: '2026-12-15' } });
    await userEvent.click(dialogo.getByRole('button', { name: 'Criar' }));
    await waitFor(() =>
      expect(corpoEnviado(f, 'POST /api/unidades/u-2sb/militares')).toEqual({
        matricula: '990010-0', postoGradId: 'p-cb', quadroId: 'q-qbmg', nomeCompleto: 'Novo da Silva', nomeGuerra: 'NOVO', antiguidade: null, motorista: false, cnh: [], voluntarioJes: false,
        lotacao: { equipeId: null, jornada: 'pronto', desde: '2026-12-15' },
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/peculio/militar/m9'));
  });

  it('o quadro mostra só os do posto-graduação, e com mais de um deixa para depois', async () => {
    rotas();
    abrir('/peculio');
    const dialogo = await abrirODialogo();
    await userEvent.selectOptions(dialogo.getByLabelText('Posto-graduação'), 'MAJ');
    const quadro = within(dialogo.getByLabelText('Quadro'));
    expect(quadro.getByRole('option', { name: 'Escolher depois' })).toBeInTheDocument();
    expect(quadro.getByRole('option', { name: 'QOC' })).toBeInTheDocument();
    expect(quadro.getByRole('option', { name: 'QOA' })).toBeInTheDocument();
    expect(quadro.queryByRole('option', { name: 'QBMG' })).toBeNull();
  });

  it('exige o nome completo: sem ele o cadastro não é enviado', async () => {
    const f = rotas({ 'POST /api/unidades/u-1sb/militares': { status: 201, corpo: FICHA_CRIADA } });
    abrir('/peculio');
    const dialogo = await abrirODialogo();
    expect(dialogo.getByLabelText('Nome completo')).toBeRequired();
    await userEvent.type(dialogo.getByLabelText('Matrícula'), '990010-0');
    await userEvent.type(dialogo.getByLabelText('Nome de guerra'), 'NOVO');
    await userEvent.click(dialogo.getByRole('button', { name: 'Criar' }));
    expect(chamadasA(f, 'POST /api/unidades/u-1sb/militares')).toBe(0);
  });

  it('o erro da data de lotação aparece ao lado do campo', async () => {
    rotas({ 'POST /api/unidades/u-1sb/militares': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { 'lotacao.desde': 'Use uma data que exista no calendário.', postoGradId: 'Escolha o posto.' } } } });
    abrir('/peculio');
    const dialogo = await abrirODialogo();
    await userEvent.type(dialogo.getByLabelText('Matrícula'), '990010-0');
    await userEvent.type(dialogo.getByLabelText('Nome completo'), 'Novo da Silva');
    await userEvent.type(dialogo.getByLabelText('Nome de guerra'), 'NOVO');
    await escolherNaArvore(dialogo.getByLabelText('Unidade'), '1ª SB');
    await userEvent.click(dialogo.getByRole('button', { name: 'Criar' }));
    const desde = dialogo.getByLabelText('Lotado desde');
    expect(await dialogo.findByText('Use uma data que exista no calendário.')).toBeInTheDocument();
    expect(desde.parentElement).toContainElement(dialogo.getByText('Use uma data que exista no calendário.'));
    expect(dialogo.getByLabelText('Posto-graduação').parentElement).toContainElement(dialogo.getByText('Escolha o posto.'));
  });

  it('postos em 500: o diálogo mostra o aviso no campo', async () => {
    rotas({ 'GET /api/postos': { status: 500, corpo: { erro: 'Falha.' } } });
    abrir('/peculio');
    const dialogo = await abrirODialogo();
    expect(await dialogo.findByText('Não deu para carregar a lista. Recarregue a página.')).toBeInTheDocument();
  });
});

describe('a lista com mais de 100 militares (6.17, item 23)', () => {
  const muitos: ListaDoPeculio = {
    militares: Array.from({ length: 250 }, (_, i) => ({
      militarId: `m${i}`, matricula: `99${String(1000 + i).padStart(4, '0')}-${i % 10}`, posto: 'SD', nomeGuerra: `NOME${String(i).padStart(3, '0')}`, nomeCompleto: `Fulano ${i}`, lotacao: '1ª SB', lotacaoId: 'u-1sb', telefone: null, email: null, pendencias: [],
    })),
  };
  const linhas = async () => (await militares()).getAllByRole('listitem');

  it('mostra de 100 em 100, com "Mostrar mais" e o total; o último trecho some o botão', async () => {
    api(EU_EXEMPLO, muitos);
    abrir('/peculio');
    expect(await linhas()).toHaveLength(100);
    expect(screen.getByText('Mostrando 100 de 250 militares')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(await linhas()).toHaveLength(200);
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(await linhas()).toHaveLength(250);
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull();
  });

  it('a busca olha a lista inteira, e voltar ao filtro começa de novo nos 100 primeiros', async () => {
    api(EU_EXEMPLO, muitos);
    abrir('/peculio');
    await linhas();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(await linhas()).toHaveLength(200);
    fireEvent.change(screen.getByLabelText('Buscar por nome ou matrícula'), { target: { value: 'NOME249' } });
    await waitFor(async () => expect(await linhas()).toHaveLength(1));
    fireEvent.change(screen.getByLabelText('Buscar por nome ou matrícula'), { target: { value: '' } });
    await waitFor(async () => expect(await linhas()).toHaveLength(100));
  });
});

